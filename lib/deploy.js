'use strict';
const async = require('async');
const Git = require('./git');
const Docker = require('./docker');
const fs = require('fs');
const path = require('path');
const strf = require('strf');

class Deploy {
  constructor(env, repoPath, username, token, logger) {
    this.env = env;
    this.repoPath = repoPath;
    this.username = username;
    this.token = token;
    this.git = new Git(repoPath, username, token);
    this.docker = new Docker(repoPath);
    this.logger = logger;
  }

  readConfig(repo, branch, env, done) {
    const configPath = path.join(this.repoPath, repo, 'deploy.json');
    fs.stat(configPath, (err, stat) => {
      if (err) {
        return done(null, {});
      }
      fs.readFile(configPath, 'utf8', (readErr, configStr) => {
        if (readErr) {
          return done(readErr);
        }

        const config = JSON.parse(configStr);
        //process dockerargs and virtualHost
        const templateObj = {
          repo,
          branch,
          env,
          vars: process.env
        }
        if (!config.dockerargs) {
          config.dockerargs = '';
        } else {
          config.dockerargs = strf(config.dockerargs, templateObj);
        }
        if (config.virtualHost) {
          config.virtualHost = strf(config.virtualHost, templateObj);
        }
        done(null, config);
      });

    });
  }

  safeBranchName(branch) {
    if (branch.indexOf('/') !== -1) {
      branch = branch.split('/')[0];
    }

    return branch.toLowerCase();
  }

  run(org, repo, branch, allDone) {
    if (typeof branch === 'function') {
      allDone = branch;
      branch = 'master';
    }
    this.logger.log(['deploy', 'start'], `Starting Deployment of ${org}/${repo}/${branch}`);
    async.auto({
      fetchLatest: (done) => {
        this.logger.log(['deploy'], `Fetching Latest from ${repo}/${branch}`);
        this.git.fetchLatest(org, repo, branch, done);
      },
      build: ['fetchLatest', (done, results) => {
        this.logger.log(['deploy'], `Building ${repo}/${branch}`);
        this.docker.build(repo, branch, results.fetchLatest, done);
      }],
      config: ['fetchLatest', (done, results) => {
        this.logger.log(['deploy'], `Reading config from ${repo}/${branch}`);
        this.readConfig(repo, branch, this.env, done);
      }],
      existing: (done, results) => {
        this.docker.find(`${repo}_${branch}`, done);
      },
      run: ['config', 'build', 'existing', (done, results) => {
        const config = results.config;
        config.dockerargs += ` -e REPO_NAME=${repo} -e REPO_BRANCH=${branch} -e REPO_ORG=${org}`;
        if (config.virtualHost) {
          config.dockerargs += ` -e VIRTUAL_HOST=${config.virtualHost}`;
        }
        const scale = config.scale || 1;
        this.logger.log(['deploy'], `Running ${scale} ${repo}/${branch} container(s)`);
        this.docker.run(repo, branch, results.fetchLatest, config, done);
      }],
      names: ['run', (done, results) => {
        async.map(results.run, (id, mapDone) => {
          this.docker.getName(id, mapDone);
        }, done);
      }],
      wait: ['run', (done, results) => {
        if (!results.config.wait) {
          return done();
        }
        this.logger.log(['deploy'], `Waiting ${results.config.wait} seconds to stop other containers`);
        setTimeout(() => {
          done();
        }, results.config.wait * 1000);
      }],
      stopOld: ['wait', (done, results) => {
        this.logger.log(['deploy'], `Stopping old ${repo}/${branch} containers`);
        this.docker.stop(results.existing, done);
      }],
      rmOld: ['stopOld', (done, results) => {
        this.logger.log(['deploy'], `Removing old ${repo}/${branch} containers`);
        this.docker.rm(results.existing, done);
      }]
    }, (err, results) => {
      if (err) {
        this.logger.log(['deploy', 'error'], err);
        return allDone(err);
      }
      const out = {
        ids: results.run,
        names: results.names,
        stoppedContainers: results.existing,
        virtualHost: results.virtualHost
      };
      this.logger.log(['deploy', 'success'], out);
      allDone(null, out);
    });
  }
}

module.exports = Deploy;

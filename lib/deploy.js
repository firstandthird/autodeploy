'use strict';
const async = require('async');
const Git = require('./git');
const Docker = require('./docker');
const fs = require('fs');
const path = require('path');

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

  readConfig(repo, done) {
    const configPath = path.join(this.repoPath, repo, 'autodeploy.json');
    fs.stat(configPath, (err, stat) => {
      if (err) {
        return done(null, {});
      }
      done(null, require(configPath));
    });
  }

  safeBranchName(branch) {
    if (branch.indexOf('/') !== -1) {
      branch = branch.split('/')[0];
    }

    return branch.toLowerCase();
  }

  getVirtualHost(hostTemplate, branch, env) {
    const tmpl = new Function('branch', 'env', 'return `' + hostTemplate + '`');
    return tmpl(this.safeBranchName(branch), env);
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
        this.readConfig(repo, done);
      }],
      existing: (done, results) => {
        this.docker.find(`${repo}_${branch}`, done);
      },
      virtualHost: ['config', (done, results) => {
        if (!results.config.virtualHost) {
          return done();
        }
        const host = this.getVirtualHost(results.config.virtualHost, branch, this.env);
        this.logger.log(['deploy'], `Virtual host set as ${host}`);
        return done(null, host);
      }],
      run: ['config', 'virtualHost', 'build', 'existing', (done, results) => {
        const config = results.config;
        if (!config.dockerargs) {
          config.dockerargs = '';
        }
        config.dockerargs += ` -e REPO_NAME=${repo} -e REPO_BRANCH=${branch} -e REPO_ORG=${org}`;
        if (results.virtualHost) {
          config.dockerargs += ` -e VIRTUAL_HOST=${results.virtualHost}`;
        }
        const scale = config.scale || 1;
        this.logger.log(['deploy'], `Running ${scale} ${repo}/${branch} container(s)`);
        this.docker.run(repo, branch, results.fetchLatest, config, done);
      }],
      name: ['run', (done, results) => {
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
        names: results.name,
        stoppedContainers: results.existing,
        virtualHost: results.virtualHost
      };
      this.logger.log(['deploy', 'success'], out);
      allDone(null, out);
    });
  }
}

module.exports = Deploy;

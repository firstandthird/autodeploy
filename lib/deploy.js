'use strict';
const async = require('async');
const Git = require('./git');
const Docker = require('./docker');
const fs = require('fs');
const path = require('path');

class Deploy {
  constructor(repoPath, username, token, logger) {
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

  run(org, repo, branch, allDone) {
    if (typeof branch === 'function') {
      allDone = branch;
      branch = 'master';
    }
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
      run: ['config', 'build', 'existing', (done, results) => {
        if (!results.config.dockerargs) {
          results.config.dockerargs = '';
        }
        results.config.dockerargs += ` -e REPO_NAME=${repo} -e REPO_BRANCH=${branch} -e REPO_ORG=${org}`;
        this.logger.log(['deploy'], `Running ${repo}/${branch} container`);
        this.docker.run(repo, branch, results.config, done);
      }],
      name: ['run', (done, results) => {
        this.docker.getName(results.run, done);
      }],
      stopOld: ['run', (done, results) => {
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
        id: results.run,
        name: results.name,
        stoppedContainers: results.existing
      };
      this.logger.log(['deploy', 'success'], out);
      allDone(null, out);
    });
  }
}

module.exports = Deploy;

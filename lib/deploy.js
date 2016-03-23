'use strict';
const async = require('async');
const Git = require('./git');
const Docker = require('./docker');
const fs = require('fs');
const path = require('path');
const varson = require('varson');

class Deploy {
  constructor(env, repoPath, username, token, log) {
    this.env = env;
    this.repoPath = repoPath;
    this.username = username;
    this.token = token;
    this.git = new Git(repoPath, username, token);
    this.docker = new Docker(repoPath);
    this.log = log;
    this.currentDeployments = {};
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

        let config = JSON.parse(configStr);
        //process dockerargs and virtualHost
        const context = {
          repo,
          branch,
          safeBranch: this.safeBranchName(branch),
          env,
          vars: process.env
        }
        config = varson(config, context);
        if (!config.dockerargs) {
          config.dockerargs = '';
        }
        done(null, config);
      });

    });
  }

  safeBranchName(branch) {
    if (branch.indexOf('/') !== -1) {
      branch = branch.split('/')[1];
    }

    return branch.toLowerCase();
  }

  checkCurrentDeployments(org, repo, done) {
    const max = 30;
    let count = 0;
    const check = () => {
      if (this.currentDeployments[`${org}_${repo}}`]) {
        this.log(['deploy', 'notice'], `Waiting for existing ${org}/${repo} to finish`);
        if (count == max) {
          return done(new Error('Max retries'));
        }
        count++;
        setTimeout(check, 10 * 1000);
      } else {
        this.currentDeployments[`${org}_${repo}}`] = true;
        done();
      }
    };
    check();
  }

  run(org, repo, branch, allDone) {
    const start = new Date().getTime();
    if (typeof branch === 'function') {
      allDone = branch;
      branch = 'master';
    }
    const safeBranch = this.safeBranchName(branch);
    this.log(['deploy', 'notice'], `Starting Deployment of ${org}/${repo}/${branch}`);
    async.auto({
      checkCurrentDeployments: (done) => {
        this.checkCurrentDeployments(org, repo, done);
      },
      fetchLatest: ['checkCurrentDeployments', (done) => {
        this.log(['deploy'], `Fetching Latest from ${repo}/${branch}`);
        this.git.fetchLatest(org, repo, branch, done);
      }],
      build: ['fetchLatest', (done, results) => {
        this.log(['deploy'], `Building ${repo}/${branch}`);
        this.docker.build(repo, safeBranch, results.fetchLatest, done);
      }],
      config: ['fetchLatest', (done, results) => {
        this.log(['deploy'], `Reading config from ${repo}/${branch}`);
        this.readConfig(repo, branch, this.env, done);
      }],
      existing: ['checkCurrentDeployments', (done, results) => {
        this.docker.find(`${repo}_${safeBranch}:`, true, done);
      }],
      run: ['config', 'build', 'existing', (done, results) => {
        const config = results.config;
        config.dockerargs += ` -e REPO_NAME=${repo} -e REPO_BRANCH=${branch} -e REPO_ORG=${org}`;
        const scale = config.scale || 1;
        this.log(['deploy'], `Running ${scale} ${repo}/${branch} container(s)`);
        this.docker.run(repo, safeBranch, results.fetchLatest, config, done);
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
        this.log(['deploy'], `Waiting ${results.config.wait} seconds to stop other containers`);
        setTimeout(() => {
          done();
        }, results.config.wait * 1000);
      }],
      stopOld: ['wait', (done, results) => {
        this.log(['deploy'], `Stopping old ${repo}/${branch} containers`);
        this.docker.stop(results.existing, done);
      }],
      rmOld: ['stopOld', (done, results) => {
        this.log(['deploy'], `Removing old ${repo}/${branch} containers`);
        this.docker.rm(results.existing, done);
      }],
      rmOldImages: ['rmOld', (done, results) => {
        const keep = 3;
        this.log(['deploy'], `Removing stale ${repo}/${branch} images`);
        this.docker.removeStaleImages(repo, safeBranch, keep, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning'], { message: 'issue removing images', err, stdout, stderr });
          }
          done();
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${org}_${repo}}`] = false;
      if (err) {
        this.log(['deploy', 'error'], err);
        return allDone(err);
      }
      const duration = new Date().getTime() - start;
      const out = {
        ids: results.run,
        names: results.names,
        stoppedContainers: results.existing,
        duration: duration,
        dockerargs: results.config.dockerargs
      };
      this.log(['deploy', 'success'], out);
      allDone(null, out);
    });
  }

  remove(org, repo, branch, allDone) {

    const safeBranch = this.safeBranchName(branch);
    this.log(['deploy', 'remove', 'notice'], `Starting removal of ${org}/${repo}/${branch}`);
    async.auto({
      checkCurrentDeployments: (done) => {
        this.checkCurrentDeployments(org, repo, done);
      },
      exists: ['checkCurrentDeployments', (done) => {
        this.log(['deploy', 'remove'], `Checking if ${repo} exists`);
        this.git.exists(repo, done);
      }],
      containers: ['exists', (done, results) => {
        this.log(['deploy', 'remove'], `Getting ${repo}/${branch} containers`);
        this.docker.find(`${repo}_${safeBranch}:`, true, done);
      }],
      images: ['exists', (done, results) => {
        this.log(['deploy', 'remove'], `Getting ${repo}/${branch} images`);
        this.docker.findImages(`${repo}_${safeBranch} `, done);
      }],
      stopContainers: ['containers', (done, results) => {
        this.log(['deploy', 'remove'], `Stopping ${repo}/${branch} containers`);
        this.docker.stop(results.containers, done);
      }],
      rmContainers: ['stopContainers', (done, results) => {
        this.log(['deploy', 'remove'], `Removing ${repo}/${branch} containers`);
        this.docker.rm(results.containers, done);
      }],
      rmImages: ['rmContainers', (done, results) => {
        this.log(['deploy', 'remove'], `Removing ${repo}/${branch} images`);
        this.docker.rmi(results.images, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning'], { message: 'issue removing images', err, stdout, stderr });
          }
          done();
        });
      }],
      removeRepo: ['rmImages', (done, results) => {
        this.docker.findImages(`${repo}_`, (err, id) => {
          if (err) {
            return done(err);
          }
          //if there are in use images, don't remove repo
          if (id.length !== 0) {
            return done();
          }

          this.log(['deploy', 'remove'], `Removing ${repo} repo`);
          this.git.remove(repo, done);
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${org}_${repo}}`] = false;
      if (err) {
        this.log(['deploy', 'remove', 'error'], err);
        return allDone(err);
      }
      this.log(['deploy', 'remove', 'success'], results);
      allDone(null, results);
    });

  }
}

module.exports = Deploy;

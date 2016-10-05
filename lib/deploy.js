'use strict';
const _ = require('lodash');
const async = require('async');
const Git = require('./git');
const Docker = require('./docker');
const readConfig = require('./read-config');

class Deploy {
  constructor(env, repoPath, sharedConfigPath, username, token, log) {
    this.env = env;
    this.repoPath = repoPath;
    this.sharedConfigPath = sharedConfigPath;
    this.username = username;
    this.token = token;
    this.git = new Git(repoPath, username, token);
    this.docker = new Docker(repoPath);
    this.log = log;
    this.currentDeployments = {};
  }

  safeBranchName(branch) {
    if (branch.indexOf('/') !== -1) {
      branch = branch.split('/')[1];
    }

    return branch.toLowerCase();
  }

  checkCurrentDeployments(org, repo, done) {
    const max = 10;
    let count = 0;
    const check = () => {
      if (this.currentDeployments[`${org}_${repo}}`]) {
        this.log(['deploy', org, repo], `Waiting for existing ${org}/${repo} to finish`);
        if (count === max) {
          this.log(['deploy', 'notice', org, repo], `Max retries waiting for ${org}/${repo} to finish`);
          return done(new Error('Max retries'));
        }
        count++;
        setTimeout(check, 10 * 1000);
      } else {
        this.currentDeployments[`${org}_${repo}}`] = true;
        return done();
      }
    };
    check();
  }

  run(options, allDone) {
    const start = new Date().getTime();
    const safeBranch = this.safeBranchName(options.branch);
    this.log(['deploy', 'notice', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Starting Deployment`);
    async.auto({
      checkCurrentDeployments: (done) => {
        this.checkCurrentDeployments(options.org, options.repo, done);
      },
      fetchLatest: ['checkCurrentDeployments', (results, done) => {
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Fetching Latest`);
        this.git.fetchLatest(options.org, options.repo, options.branch, done);
      }],
      config: ['fetchLatest', (results, done) => {
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Reading ${options.configFile}`);
        readConfig({
          log: this.log,
          repoPath: this.repoPath,
          sharedConfigPath: this.sharedConfigPath,
          configFile: options.configFile,
          repo: options.repo,
          branch: options.branch,
          safeBranch: this.safeBranchName(options.branch),
          env: this.env,
          vars: process.env
        }, done);
      }],
      build: ['config', (results, done) => {
        const dockerfile = results.config.dockerfile || 'Dockerfile';
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Building`);
        this.docker.build(options.repo, dockerfile, safeBranch, results.fetchLatest, done);
      }],
      existing: ['checkCurrentDeployments', (results, done) => {
        this.docker.find(`${options.repo}_${safeBranch}:`, true, done);
      }],
      host: ['config', (results, done) => {
        const rootHost = process.env.DOMAIN;
        if (!rootHost) {
          return done();
        }
        let host = `${results.config.name || ''}-${safeBranch}.${rootHost}`;
        if (!results.config.name) {
          host = host.substr(1);
        }
        if (results.config.masterAsRoot === true && options.branch === 'master') { //if master, set root host
          host += `,${rootHost}`;
        }
        done(null, host);
      }],
      run: ['config', 'build', 'existing', 'host', (results, done) => {
        const config = results.config;

        const defaultArgs = {
          e: {
            REPO_NAME: options.repo,
            REPO_BRANCH: options.branch,
            REPO_ORG: options.org,
            VIRTUAL_HOST: results.host
          },
          restart: 'on-failure:5',
          label: {
            shipment: 'deploy',
            'shipment-repo': options.repo,
            'shipment-branch': options.branch,
            'shipment-org': options.org
          }
        };
        config.dockerargs = _.defaultsDeep(config.dockerargs, defaultArgs);

        if (typeof config.scale === 'object') {
          config.scale = config.scale[this.env];
        }
        config.scale = config.scale || 1;
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Running ${config.scale} container(s)`);
        this.docker.run(options.repo, safeBranch, results.fetchLatest, config, done);
      }],
      names: ['run', (results, done) => {
        async.map(results.run, (id, mapDone) => {
          this.docker.getName(id, mapDone);
        }, done);
      }],
      wait: ['run', (results, done) => {
        if (!results.config.wait) {
          return done();
        }
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Waiting ${results.config.wait} seconds to stop other containers`);
        setTimeout(() => {
          done();
        }, results.config.wait * 1000);
      }],
      stopOld: ['wait', (results, done) => {
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Stopping old containers`);
        this.docker.stop(results.existing, done);
      }],
      rmOld: ['stopOld', (results, done) => {
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Removing old containers`);
        this.docker.rm(results.existing, done);
      }],
      rmOldImages: ['rmOld', (results, done) => {
        const keep = 3;
        this.log(['deploy', options.org, options.repo, options.branch], `${options.org}/${options.repo}#${options.branch}: Removing stale images`);
        this.docker.removeStaleImages(options.repo, safeBranch, keep, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning', options.org, options.repo, options.branch], { message: 'Issue Removing Images', err, stdout, stderr });
          }
          done();
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${options.org}_${options.repo}}`] = false;
      if (err) {
        //TODO: just pass err when logr updated
        this.log(['deploy', 'error', options.org, options.repo, options.branch], {
          message: err.message || err.toString(),
          error: JSON.stringify(err),
          rawErr: err
        });
        return allDone(err);
      }
      const duration = new Date().getTime() - start;
      let url = _.get(results.config.dockerargs, 'e.VIRTUAL_HOST');
      if (url) {
        url = `http://${url}`;
      }
      const out = {
        message: `${options.org}/${options.repo}#${options.branch}: Successfully Deployed`,
        url,
        ids: results.run,
        names: results.names,
        stoppedContainers: results.existing,
        duration,
        dockerargs: results.config.dockerargs
      };
      this.log(['deploy', 'success', options.org, options.repo, options.branch], out);
      allDone(null, out);
    });
  }

  remove(org, repo, branch, allDone) {
    const safeBranch = this.safeBranchName(branch);
    this.log(['deploy', 'remove', 'notice', org, repo, branch], `${org}/${repo}#${branch}: Starting removal`);
    async.auto({
      checkCurrentDeployments: (done) => {
        this.checkCurrentDeployments(org, repo, done);
      },
      exists: ['checkCurrentDeployments', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `Checking if ${repo} exists`);
        this.git.exists(repo, (err, exists) => {
          if (!exists) {
            return done(new Error(`${repo} doesn't exist`));
          }
          done();
        });
      }],
      containers: ['exists', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `${org}/${repo}#${branch}: Getting containers`);
        this.docker.find(`${repo}_${safeBranch}:`, true, done);
      }],
      images: ['exists', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `${org}/${repo}#${branch}: Getting images`);
        this.docker.findImages(`${repo}_${safeBranch} `, done);
      }],
      stopContainers: ['containers', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `${org}/${repo}#${branch}: Stopping containers`);
        this.docker.stop(results.containers, done);
      }],
      rmContainers: ['stopContainers', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `${org}/${repo}#${branch}: Removing containers`);
        this.docker.rm(results.containers, done);
      }],
      rmImages: ['rmContainers', (results, done) => {
        this.log(['deploy', 'remove', org, repo, branch], `${org}/${repo}#${branch}: Removing images`);
        this.docker.rmi(results.images, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning', org, repo, branch], { message: 'Issue Removing Images', err, stdout, stderr });
          }
          done();
        });
      }],
      removeRepo: ['rmImages', (results, done) => {
        this.docker.findImages(`${repo}_`, (err, id) => {
          if (err) {
            return done(err);
          }
          //if there are in use images, don't remove repo
          if (id.length !== 0) {
            return done();
          }

          this.log(['deploy', 'remove', org, repo, branch], `${repo}: Removing repo`);
          this.git.remove(repo, done);
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${org}_${repo}}`] = false;
      if (err) {
        this.log(['deploy', 'remove', 'error', org, repo, branch], { error: err.toString() });
        return allDone(err);
      }
      results.message = `${org}/${repo}#${branch}: Successfully Removed`;
      this.log(['deploy', 'remove', 'success', org, repo, branch], results);
      allDone(null, results);
    });
  }
}

module.exports = Deploy;

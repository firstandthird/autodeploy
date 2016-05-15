'use strict';
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
        this.log(['deploy'], `Waiting for existing ${org}/${repo} to finish`);
        if (count === max) {
          this.log(['deploy', 'notice'], `Max retries waiting for ${org}/${repo} to finish`);
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

  run(options, allDone) {
    const start = new Date().getTime();
    const safeBranch = this.safeBranchName(options.branch);
    this.log(['deploy', 'notice'], `Starting Deployment of ${options.org}/${options.repo}/${options.branch}`);
    async.auto({
      checkCurrentDeployments: (done) => {
        this.checkCurrentDeployments(options.org, options.repo, done);
      },
      fetchLatest: ['checkCurrentDeployments', (results, done) => {
        this.log(['deploy'], `Fetching Latest from ${options.repo}/${options.branch}`);
        this.git.fetchLatest(options.org, options.repo, options.branch, done);
      }],
      build: ['fetchLatest', (results, done) => {
        this.log(['deploy'], `Building ${options.repo}/${options.branch}`);
        this.docker.build(options.repo, safeBranch, results.fetchLatest, done);
      }],
      config: ['fetchLatest', (results, done) => {
        this.log(['deploy'], `Reading ${options.configFile} from ${options.repo}/${options.branch}`);
        readConfig({
          repoPath: this.repoPath,
          sharedConfigPath: this.sharedConfigPath,
          configFile: options.configFile,
          repo: options.repo,
          branch: options.branch,
          safeBranch: this.safeBranchName(options.branch),
          env: this.env
        }, done);
      }],
      existing: ['checkCurrentDeployments', (results, done) => {
        this.docker.find(`${options.repo}_${safeBranch}:`, true, done);
      }],
      run: ['config', 'build', 'existing', (results, done) => {
        const config = results.config;
        config.dockerargs += ` -e REPO_NAME=${options.repo} -e REPO_BRANCH=${options.branch} -e REPO_ORG=${options.org} --restart=always`;
        const scale = config.scale || 1;
        this.log(['deploy'], `Running ${scale} ${options.repo}/${options.branch} container(s)`);
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
        this.log(['deploy'], `Waiting ${results.config.wait} seconds to stop other containers`);
        setTimeout(() => {
          done();
        }, results.config.wait * 1000);
      }],
      stopOld: ['wait', (results, done) => {
        this.log(['deploy'], `Stopping old ${options.repo}/${options.branch} containers`);
        this.docker.stop(results.existing, done);
      }],
      rmOld: ['stopOld', (results, done) => {
        this.log(['deploy'], `Removing old ${options.repo}/${options.branch} containers`);
        this.docker.rm(results.existing, done);
      }],
      rmOldImages: ['rmOld', (results, done) => {
        const keep = 3;
        this.log(['deploy'], `Removing stale ${options.repo}/${options.branch} images`);
        this.docker.removeStaleImages(options.repo, safeBranch, keep, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning'], { message: 'issue removing images', err, stdout, stderr });
          }
          done();
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${options.org}_${options.repo}}`] = false;
      if (err) {
        this.log(['deploy', 'error'], err);
        return allDone(err);
      }
      const duration = new Date().getTime() - start;
      const out = {
        ids: results.run,
        names: results.names,
        stoppedContainers: results.existing,
        duration,
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
        this.git.exists(repo, (err, exists) => {
          if (!exists) {
            return done(new Error(`${repo} doesn't exist`));
          }
          done();
        });
      }],
      containers: ['exists', (results, done) => {
        this.log(['deploy', 'remove'], `Getting ${repo}/${branch} containers`);
        this.docker.find(`${repo}_${safeBranch}:`, true, done);
      }],
      images: ['exists', (results, done) => {
        this.log(['deploy', 'remove'], `Getting ${repo}/${branch} images`);
        this.docker.findImages(`${repo}_${safeBranch} `, done);
      }],
      stopContainers: ['containers', (results, done) => {
        this.log(['deploy', 'remove'], `Stopping ${repo}/${branch} containers`);
        this.docker.stop(results.containers, done);
      }],
      rmContainers: ['stopContainers', (results, done) => {
        this.log(['deploy', 'remove'], `Removing ${repo}/${branch} containers`);
        this.docker.rm(results.containers, done);
      }],
      rmImages: ['rmContainers', (results, done) => {
        this.log(['deploy', 'remove'], `Removing ${repo}/${branch} images`);
        this.docker.rmi(results.images, (err, stdout, stderr) => {
          if (err || stderr) {
            this.log(['deploy', 'remove', 'warning'], { message: 'issue removing images', err, stdout, stderr });
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

          this.log(['deploy', 'remove'], `Removing ${repo} repo`);
          this.git.remove(repo, done);
        });
      }]
    }, (err, results) => {
      this.currentDeployments[`${org}_${repo}}`] = false;
      if (err) {
        this.log(['deploy', 'remove', 'error'], { error: err.toString() });
        return allDone(err);
      }
      this.log(['deploy', 'remove', 'success'], results);
      allDone(null, results);
    });
  }
}

module.exports = Deploy;

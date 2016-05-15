'use strict';
const fs = require('fs');
const path = require('path');
const async = require('async');
const exec = require('child_process').exec;

class Git {
  constructor(repoPath, username, token) {
    this.repoPath = repoPath;
    this.username = username;
    this.token = token;
  }

  cmd(repo, command, done) {
    exec(`cd ${this.repoPath}/${repo} && git ${command}`, done);
  }

  clone(org, repo, done) {
    exec(`cd ${this.repoPath} && git clone https://${this.username}:${this.token}@github.com:/${org}/${repo}.git`, done);
  }

  exists(repo, done) {
    fs.stat(path.join(this.repoPath, repo), (err, stat) => {
      done(null, (!err));
    });
  }

  remove(repo, done) {
    exec(`cd ${this.repoPath} && rm -r ${repo}`, done);
  }

  getLatestCommit(repo, done) {
    this.cmd(repo, 'log --pretty=format:"%h" -n 1', (err, stdout, stderr) => {
      done(err, stdout);
    });
  }

  fetchLatest(org, repo, branch, allDone) {
    if (typeof branch === 'function') {
      allDone = branch;
      branch = 'master';
    }
    async.auto({
      exists: (done) => {
        this.exists(repo, done);
      },
      clone: ['exists', (results, done) => {
        if (results.exists) {
          return done();
        }
        this.clone(org, repo, done);
      }],
      fetch: ['clone', (results, done) => {
        this.cmd(repo, 'fetch', done);
      }],
      checkout: ['fetch', (results, done) => {
        this.cmd(repo, `reset --hard origin/${branch}`, done);
      }],
      submoduleToken: ['checkout', (results, done) => {
        fs.stat(path.join(this.repoPath, repo, '.gitmodules'), (err, stat) => {
          if (err) {
            return done();
          }
          exec(`cd ${this.repoPath}/${repo} && sed -i 's@git\\@github.com:\@https://${this.username}:${this.token}\\@github.com/@' .gitmodules`, done);
        });
      }],
      submodule: ['submoduleToken', (results, done) => {
        this.cmd(repo, 'submodule update --init --recursive', done);
      }],
      commit: ['checkout', (results, done) => {
        this.getLatestCommit(repo, done);
      }]
    }, (err, results) => {
      if (err) {
        return allDone(err);
      }

      allDone(null, results.commit);

    });
  }
}

module.exports = Git;

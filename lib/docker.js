'use strict';
const exec = require('child_process').exec;
const async = require('async');

class Docker {
  constructor(repoPath) {
    this.repoPath = repoPath;
  }

  cmd(repo, command, done) {
    exec(`cd ${this.repoPath}/${repo} && docker ${command}`, {maxBuffer: 1024 * 1000}, done);
  }

  build(repo, branch, commit, done) {
    this.cmd(repo, `ps | grep ${repo}_${branch}.*${commit}`, (err, stdout, stderr) => {
      if (err) { //doesn't exist
        return this.cmd(repo, `build -t ${repo}_${branch}:${commit} .`, done);
      }
      done();
    });
  }

  inspect(id, done) {
    this.cmd('', `inspect ${id}`, (err, stdout) => {
      if (err) {
        return done(err);
      }
      const info = JSON.parse(stdout);
      if (info.length === 0) {
        return done(new Error('container not found'));
      }
      done(null, info[0]);
    });
  }

  getName(id, done) {
    this.inspect(id, (err, info) => {
      if (err) {
        return done(err);
      }
      return done(null, info.Name.substr(1));
    });
  }

  find(search, all, done) {
    if (typeof all === 'function') {
      done = all;
      all = false;
    }
    const allFlag = (all) ? '-a' : '';
    this.cmd('', `ps ${allFlag} | grep ${search} | awk '{ print $1 }'`, (err, stdout) => {
      const ids = stdout.split('\n');
      ids.pop();
      done(err, ids);
    });
  }

  findImages(search, done) {
    this.cmd('', `images | grep ${search} | awk '{ print $3 }'`, (err, stdout) => {
      const ids = stdout.split('\n');
      ids.pop();
      done(err, ids);
    });
  }

  stop(ids, done) {
    if (!ids || ids.length === 0) {
      return done();
    }
    this.cmd('', `stop ${ids.join(' ')}`, done);
  }

  rm(ids, done) {
    if (!ids || ids.length === 0) {
      return done();
    }
    this.cmd('', `rm ${ids.join(' ')}`, done);
  }

  rmi(ids, done) {
    if (!ids || ids.length === 0) {
      return done();
    }
    this.cmd('', `rmi ${ids.join(' ')}`, done);
  }

  removeStaleImages(repo, branch, keep, done) {
    this.cmd(repo, `rmi $(docker images | grep "${repo}_${branch} " | tail -n +${keep} | awk '{ print $3 }')`, (err, stdout, stderr) => {
      //console.log(err, stdout, stderr);
      //ignore errors
      done();
    });
  }

  getPrettyName(repo, branch) {
    const max = 1000;
    const min = 1;
    const num = Math.floor(Math.random() * (max - min + 1)) + min;

    return `${repo}_${branch}_${num}`;
  }

  run(repo, branch, commit, options, done) {
    const dockerargs = options.dockerargs || '';
    const scale = options.scale || 1;
    async.times(scale, (i, runDone) => {
      const name = this.getPrettyName(repo, branch);
      this.cmd(repo, `run -d --name ${name} ${dockerargs} ${repo}_${branch}:${commit}`, (err, stdout) => {
        if (err) {
          return done(err);
        }
        const id = stdout.replace('\n', '');
        runDone(null, id);
      });
    }, done);
  }

}

module.exports = Docker;

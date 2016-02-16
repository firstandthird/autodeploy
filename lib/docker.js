'use strict';
const exec = require('child_process').exec;

class Docker {
  constructor(repoPath) {
    this.repoPath = repoPath;
  }

  cmd(repo, command, done) {
    exec(`cd ${this.repoPath}/${repo} && docker ${command}`, done);
  }

  build(repo, branch, commit, done) {
    this.cmd(repo, `build -t ${repo}_${branch}:${commit} .`, done);
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

  find(search, done) {
    this.cmd('', `ps | grep ${search} | awk '{ print $1 }'`, (err, stdout) => {
      const ids = stdout.split('\n');
      ids.pop();
      done(err, ids);
    });
  }

  stop(ids, done) {
    if (ids.length === 0) {
      return done();
    }
    this.cmd('', `stop ${ids.join(' ')}`, done);
  }

  rm(ids, done) {
    if (ids.length === 0) {
      return done();
    }
    this.cmd('', `rm ${ids.join(' ')}`, done);
  }

  run(repo, branch, commit, options, done) {
    const dockerargs = options.dockerargs || '';
    this.cmd(repo, `run -d ${dockerargs} ${repo}_${branch}:${commit}`, (err, stdout) => {
      if (err) {
        return done(err);
      }
      const id = stdout.replace('/n', '');
      done(null, id);
    });
  }

}

module.exports = Docker;

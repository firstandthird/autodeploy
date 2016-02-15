'use strict';
const config = require('confi')();
const Server = require('./lib/server');
const Deploy = require('./lib/deploy');
const GithubHook = require('./lib/github-hook');

if (!config.username || !config.token  || !config.secret) {
  console.log('must pass in github username, github token, secret');
  process.exit(1);
}

const deploy = new Deploy(config.repoPath, config.username, config.token);
const githubHook = new GithubHook(config.secret);
const server = new Server(config.port, deploy, githubHook);

server.start((err) => {
  if (err) {
    throw err;
  }
});

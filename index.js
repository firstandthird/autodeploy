'use strict';
const config = require('confi')();
const Server = require('./lib/server');
const Deploy = require('./lib/deploy');
const GithubHook = require('./lib/github-hook');
const Logger = require('logr');

if (!config.username || !config.token || !config.secret) {
  /*eslint-disable no-console*/
  console.log('must pass in github username, github token, secret');
  /*eslint-enable no-console*/
  process.exit(1);
}

config.branchWhitelist = config.branchWhitelist ? config.branchWhitelist.split(',') : [];
const log = new Logger(config.logger);
const deploy = new Deploy(config.env, config.repoPath, config.username, config.token, log);
const githubHook = new GithubHook(config.secret, config.branchWhitelist, log);
const server = new Server(config.port, deploy, config.secret, githubHook);

server.start((err) => {
  if (err) {
    throw err;
  }
  log(['server', 'notice', 'server-start'], 'Server started');
});

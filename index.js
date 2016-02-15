'use strict';
const config = require('confi')();
const Server = require('./lib/server');
const Deploy = require('./lib/deploy');
const GithubHook = require('./lib/github-hook');
const Logger = require('./lib/logger');

if (!config.username || !config.token || !config.secret) {
  /*eslint-disable no-console*/
  console.log('must pass in github username, github token, secret');
  /*eslint-enable no-console*/
  process.exit(1);
}

const logger = new Logger(config.logger);
const deploy = new Deploy(config.repoPath, config.username, config.token, logger);
const githubHook = new GithubHook(config.secret, logger);
const server = new Server(config.port, deploy, githubHook);

server.start((err) => {
  if (err) {
    throw err;
  }
  logger.log(['server'], 'Server started');
});

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
const deploy = new Deploy(config.env, config.repoPath, config.sharedConfigPath, config.username, config.token, log);
const githubHook = new GithubHook(config.secret, config.branchWhitelist, log);
const server = new Server(config.port, deploy, config.secret, githubHook, config.logger);

server.start((err) => {
  if (err) {
    throw err;
  }
  log(['server', 'notice', 'server-start'], 'Server started');
});

process.on('SIGTERM', () => {
  server.hapiServer.stop({ timeout: 5 * 1000 }, () => {
    process.exit(0);
  });
});

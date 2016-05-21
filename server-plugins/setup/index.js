'use strict';
const Deploy = require('../../lib/deploy');
const GithubHook = require('../../lib/github-hook');

exports.register = function(server, options, next) {
  const config = server.settings.app;
  if (!config.username || !config.token || !config.secret) {
    return next(new Error('must pass in github username, github token, secret'));
  }

  config.branchWhitelist = config.branchWhitelist ? config.branchWhitelist.split(',') : [];
  const deploy = new Deploy(config.env, config.repoPath, config.sharedconfigPath, config.username, config.token, server.log.bind(server));
  const githubHook = new GithubHook(config.secret, config.branchWhitelist, server.log.bind(server));

  server.decorate('server', 'deploy', deploy);
  server.decorate('server', 'githubHook', githubHook);

  next();
};

exports.register.attributes = {
  name: 'setup'
};

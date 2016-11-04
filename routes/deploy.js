'use strict';
exports.deploy = {
  method: 'POST',
  path: '/deploy',
  handler: (request, reply) => {
    const server = request.server;
    const org = request.payload.org;
    const repo = request.payload.repo;
    const branch = request.payload.branch || 'master';
    const secret = request.payload.secret;
    const configFile = request.payload.config;
    const whitelist = request.payload.whitelist ? request.payload.whitelist.split(',') : [];
    if (secret !== server.settings.app.secret) {
      return reply('invalid secret').code(401);
    }
    server.deploy.run({
      org,
      repo,
      branch,
      configFile,
      whitelist
    }, (err, results) => {
      if (err) {
        return reply(err);
      }

      results.status = 'deployed';

      reply(results);
    });
  }
};

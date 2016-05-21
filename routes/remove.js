'use strict';
exports.remove = {
  method: 'POST',
  path: '/remove',
  handler: (request, reply) => {
    const server = request.server;
    const org = request.payload.org;
    const repo = request.payload.repo;
    const branch = request.payload.branch || 'master';
    const secret = request.payload.secret;
    if (secret !== server.settings.app.secret) {
      return reply('invalid secret').code(401);
    }
    server.deploy.remove(org, repo, branch, (err, results) => {
      if (err) {
        return reply(err);
      }

      results.status = 'removed';

      reply(results);
    });
  }
};

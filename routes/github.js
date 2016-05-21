'use strict';
exports.github = {
  method: '*',
  path: '/github',
  handler: (request, reply) => {
    const server = request.server;
    server.githubHook.parse(request.headers, request.payload, (err, deploy) => {
      if (err) {
        return reply(err);
      }
      if (!deploy) {
        return reply('nothing to deploy');
      }

      let type = 'deploy';
      if (deploy.type === 'remove') {
        type = 'remove';
      }

      const configFile = request.query.config;
      const url = `/${type}`;
      reply('ok');
      request.server.inject({
        url,
        method: 'POST',
        payload: {
          org: deploy.org,
          repo: deploy.repo,
          branch: deploy.branch,
          secret: server.settings.app.secret,
          config: configFile
        }
      }, (res) => {
      });
    });
  }
};

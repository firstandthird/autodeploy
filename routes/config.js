exports.config = {
  path: '/_config',
  method: 'GET',
  handler(request, reply) {
    const server = request.server;
    server.log(['config', 'debug'], server.settings.app);
    reply('ok');
  }
};

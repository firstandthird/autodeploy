exports.running = {
  path: '/ui',
  method: 'GET',
  config: {
    auth: 'admin',
    pre: [
      { assign: 'ids', method: 'docker.running()' },
      { assign: 'running', method: 'docker.info(pre.ids)' },
    ]
  },
  handler(request, reply) {
    const server = request.server;
    const data = request.pre.running.map((info) => {
      return {
        org: info.Config.Labels['shipment-org'],
        repo: info.Config.Labels['shipment-repo'],
        branch: info.Config.Labels['shipment-branch'],
        image: info.Config.Image,
        id: info.Id
      }
    });
    reply.view('running', {
      running: data,
      secret: server.settings.app.secret
    });
  }
};

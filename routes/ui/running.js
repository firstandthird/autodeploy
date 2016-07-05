const _ = require('lodash');
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
    const data = {};
    request.pre.running.forEach((info) => {
      const image = info.Config.Image;
      const labels = info.Config.Labels;
      if (!data[image]) {
        data[image] = {
          org: labels['shipment-org'],
          repo: labels['shipment-repo'],
          branch: labels['shipment-branch'],
          image,
          containers: []
        };
      }
      data[image].containers.push({
        id: info.Id,
        name: info.Name.substr(1)
      });
    });
    reply.view('running', {
      groups: data,
      secret: server.settings.app.secret
    });
  }
};

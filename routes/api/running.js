exports.running = {
  path: 'running',
  method: 'GET',
  handler(request, reply) {
    const server = request.server;
    server.docker.filter('label=shipment=deploy', '{{.Names}}', (err, names) => {
      reply(err, names);
    });
  }
};

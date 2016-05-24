exports.details = {
  path: 'details/{name}',
  method: 'GET',
  handler(request, reply) {
    const server = request.server;
    server.docker.inspect(request.params.name, (err, data) => {
      reply(err, data);
    });
  }
};

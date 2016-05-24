const pkg = require('../../package.json');
exports.info = {
  path: 'info',
  method: 'GET',
  handler(request, reply) {
    reply({
      version: pkg.version
    });
  }
};

module.exports = {
  method(done) {
    const server = this;
    server.docker.filter('label=shipment=deploy', '{{.Names}}', (err, names) => {
      done(err, names);
    });
  }
};

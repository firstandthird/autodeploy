'use strict';
const wreck = require('wreck');
const pkg = require('../../package');
exports.register = function(server, options, next) {
  const url = options.url;

  const check = function() {
    wreck.get(url, {
      json: true
    }, (err, res, payload) => {
      if (err) {
        server.log(['update-checker', 'error'], err);
        return;
      }
      payload = JSON.parse(payload);
      if (res.statusCode !== 200) {
        server.log(['update-checker', 'error'], payload);
        return;
      }
      if (payload.version !== pkg.version) {
        server.log(['update-checker', 'notice', 'warning'], { message: 'Deploy is out of date', installedVersion: pkg.version, newestVersion: payload.version });
      }
    });
  };

  setInterval(check, options.interval);
  check();

  next();
};

exports.register.attributes = {
  name: 'updateChecker'
};

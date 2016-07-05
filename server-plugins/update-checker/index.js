'use strict';
const wreck = require('wreck');
const pkg = require('../../package');
exports.register = function(server, options, next) {

  const url = options.url;

  const check = function() {
    console.log('check');
    wreck.get(url, {
      json: true
    }, (err, res, payload) => {
      payload = JSON.parse(payload);
      if (payload.version !== pkg.version) {
        server.log(['update-checker', 'notice'], { message: 'Deploy is out of date', installedVersion: pkg.version, newestVersion: payload.version });
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

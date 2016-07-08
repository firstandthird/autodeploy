'use strict';
const async = require('async');
const fs = require('fs');
const path = require('path');
const varson = require('varson');
module.exports = function(options, done) {
  const pathsToCheck = [
    path.join(options.repoPath, options.repo, options.configFile),
    path.join(options.sharedConfigPath || '', options.configFile)
  ];

  async.detectSeries(pathsToCheck, (pathToCheck, next) => {
    fs.stat(pathToCheck, (err) => {
      next(null, !err);
    });
  }, (err, configPath) => {
    if (err) {
      return done(err);
    }

    if (!configPath) {
      return done(null, {
        dockerargs: ''
      });
    }

    fs.readFile(configPath, 'utf8', (readErr, configStr) => {
      if (readErr) {
        return done(readErr);
      }
      let config = null;
      try {
        config = JSON.parse(configStr);

        //process dockerargs and virtualHost
        config = varson(config, options);
        if (!config.dockerargs) {
          config.dockerargs = {};
        } else if (typeof config.dockerargs === 'string') {
          options.log(['config', 'warning'], 'dockerargs as a string is going to be deprecated, switch to an object');
          config.dockerargsString = config.dockerargs;
          config.dockerargs = {};
        }
      } catch (e) {
        return done(e);
      }
      return done(null, config);
    });
  });
};

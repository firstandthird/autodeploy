'use strict';
const async = require('async');
const fs = require('fs');
const path = require('path');
const varson = require('varson');
const obj2args = require('obj2args');
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
      try {
        let config = JSON.parse(configStr);

        //process dockerargs and virtualHost
        config = varson(config, options);
        if (!config.dockerargs) {
          config.dockerargs = '';
        } else {
          config.dockerargs = obj2args(config.dockerargs);
        }
        return done(null, config);
      } catch (e) {
        return done(e);
      }
    });
  });
};

'use strict';
const async = require('async');
module.exports = {
  method(ids, done) {
    if (typeof ids === 'string') {
      ids = [ids];
    }
    const server = this;

    async.map(ids, (id, next) => {
      server.docker.inspect(id, next);
    }, done);
  }
};

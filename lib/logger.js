'use strict';

class Logger {
  constructor(options) {
    this.showTimestamp = options.showTimestamp;
    this.type = options.type;

    this.renderers = {
      console: (tags, message) => {
        const ts = (this.showTimestamp) ? `${new Date().toString()}: ` : '';
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }
        const out = `${ts}[${tags.join(',')}] ${message}`;
        return out;
      },
      json: (tags, message) => {
        const out = {
          timestamp: new Date(),
          tags,
          message
        };
        return JSON.stringify(out);
      }
    };

    if (this.type && !this.renderers[this.type]) {
      throw new Error('invalid type');
    }
  }

  log(tags, message) {
    if (!this.type) {
      return;
    }

    const out = this.renderers[this.type](tags, message);
    /*eslint-disable no-console*/
    console.log(out);
    /*eslint-enable no-console*/
  }
}

module.exports = Logger;

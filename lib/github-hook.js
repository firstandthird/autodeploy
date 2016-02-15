'use strict';
const crypto = require('crypto');


class GithubHook {
  constructor(secret) {
    this.secret = secret;
  }

  signData(blob) {
    const sig = crypto.createHmac('sha1', this.secret).update(blob).digest('hex');
    return `sha1=${sig}`;
  }

  parse(headers, payload, done) {
    const payloadStr = JSON.stringify(payload);

    //debugging
    //require('fs').writeFileSync('github.txt', JSON.stringify(payload, null, '  '), 'utf8');

    const event = headers['x-github-event'];
    const headerSig = headers['x-hub-signature'];
    const sig = this.signData(payloadStr);

    if (sig !== headerSig) {
      return done(new Error('invalid secret'));
    }

    if (event === 'push') {
      const branch = payload.ref.replace('refs/heads/', '');
      return done(null, {
        branch: branch,
        repo: payload.repository.name,
        org: payload.repository.organization
      });
    }

    done();
  }
}

module.exports = GithubHook;

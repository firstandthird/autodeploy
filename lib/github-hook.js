'use strict';
const crypto = require('crypto');


class GithubHook {
  constructor(secret, logger) {
    this.secret = secret;
    this.logger = logger;
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
      this.logger.log(['github-hook', 'error'], 'Invalid Signature');
      return done(new Error('invalid secret'));
    }

    this.logger.log(['github-hook'], `${event} received`);

    if (event === 'push') {
      const branch = payload.ref.replace('refs/heads/', '');
      const out = {
        branch,
        repo: payload.repository.name,
        org: payload.repository.organization
      };
      this.logger.log(['github-hook', 'push'], `Match for ${out.org}/${out.repo}/${out.branch}`);
      return done(null, out);
    }

    done();
  }
}

module.exports = GithubHook;

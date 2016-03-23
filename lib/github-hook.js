'use strict';
const crypto = require('crypto');


class GithubHook {
  constructor(secret, branchWhitelist, log) {
    this.secret = secret;
    this.log = log;
    this.branchWhitelist = branchWhitelist;
    if (this.branchWhitelist.length !== 0) {
      this.log(['github-hook', 'info'], { whitelist: branchWhitelist, message: 'only allowing whiltelisted branches' });
    }
  }

  signData(blob) {
    const sig = crypto.createHmac('sha1', this.secret).update(blob).digest('hex');
    return `sha1=${sig}`;
  }

  parse(headers, payload, done) {
    const payloadStr = JSON.stringify(payload);

    //console.log(JSON.stringify(payload, null, '  '));

    const event = headers['x-github-event'];
    const headerSig = headers['x-hub-signature'];
    const sig = this.signData(payloadStr);

    if (sig !== headerSig) {
      this.log(['github-hook', 'error'], 'Invalid Signature');
      return done(new Error('invalid secret'));
    }

    this.log(['github-hook'], `${event} received`);

    if (event === 'push') {
      const branch = payload.ref.replace('refs/heads/', '');
      if (this.branchWhitelist.length !== 0 && this.branchWhitelist.indexOf(branch) === -1) {
        this.log(['github-hook', 'info'], { message: 'branch doesnt match whitelist', branch });
        return done(null);
      }
      const type = (payload.deleted) ? 'remove' : 'push';
      const out = {
        type,
        branch,
        repo: payload.repository.name,
        org: payload.repository.organization
      };
      this.log(['github-hook', type], `${type} for ${out.org}/${out.repo}/${out.branch}`);
      return done(null, out);
    }

    done();
  }
}

module.exports = GithubHook;

'use strict';
const Hapi = require('hapi');

class Server {
  constructor(port, deploy, secret, githubHook) {
    this.hapiServer = new Hapi.Server();
    this.hapiServer.connection({ port });
    this.secret = secret;
    this.deploy = deploy;
    this.githubHook = githubHook;
  }

  //TODO: setupTokenAuth

  setupRoutes() {
    this.hapiServer.route([
      {
        method: 'GET',
        path: '/deploy',
        handler: (request, reply) => {
          const org = request.query.org;
          const repo = request.query.repo;
          const branch = request.query.branch || 'master';
          const secret = request.query.secret;
          if (secret !== this.secret) {
            return reply('invalid secret').code(401);
          }
          this.deploy.run(org, repo, branch, (err, results) => {
            if (err) {
              return reply(err);
            }

            const out = {
              status: 'deployed',
              containerId: results.id,
              containerName: results.name,
              stoppedContainers: results.stoppedContainers
            };

            reply(out);
          });
        }
      },
      {
        method: '*',
        path: '/github',
        handler: (request, reply) => {
          this.githubHook.parse(request.headers, request.payload, (err, deploy) => {
            if (err) {
              return reply(err);
            }
            if (!deploy) {
              return reply('nothing to deploy');
            }
            const url = `/deploy?org=${deploy.org}&repo=${deploy.repo}&branch=${deploy.branch}&secret=${this.secret}`;
            request.server.inject(url, (res) => {
              reply(res.result).code(res.statusCode);
            });
          });
        }
      },
      {
        method: 'GET',
        path: '/github-test',
        handler: (request, reply) => {
          const data = require('../github.json');

          request.server.inject({
            url: '/github',
            method: 'POST',
            payload: data,
            headers: {
              'x-github-event': 'push',
              'x-hub-signature': 'sha1=bcc8058bf4a235370cc6920edb62415688e5e5ac'
            }
          }, (res) => {
            reply(res.result);
          });
        }
      }
    ]);
  }

  start(done) {
    this.setupRoutes();
    this.hapiServer.start(done);
  }

}

module.exports = Server;

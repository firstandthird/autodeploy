'use strict';
const Hapi = require('hapi');
const async = require('async');

class Server {
  constructor(port, deploy, secret, githubHook, loggerConfig) {
    this.hapiServer = new Hapi.Server();
    this.hapiServer.connection({ port });
    this.secret = secret;
    this.deploy = deploy;
    this.githubHook = githubHook;
    this.loggerConfig = loggerConfig;
  }

  //TODO: setupTokenAuth

  setupRoutes() {
    this.hapiServer.route([
      {
        method: 'POST',
        path: '/deploy',
        handler: (request, reply) => {
          const org = request.payload.org;
          const repo = request.payload.repo;
          const branch = request.payload.branch || 'master';
          const secret = request.payload.secret;
          const configFile = request.payload.config || 'deploy.json';
          if (secret !== this.secret) {
            return reply('invalid secret').code(401);
          }
          this.deploy.run({
            org,
            repo,
            branch,
            configFile
          }, (err, results) => {
            if (err) {
              return reply(err);
            }

            results.status = 'deployed';

            reply(results);
          });
        }
      },
      {
        method: 'POST',
        path: '/remove',
        handler: (request, reply) => {
          const org = request.payload.org;
          const repo = request.payload.repo;
          const branch = request.payload.branch || 'master';
          const secret = request.payload.secret;
          if (secret !== this.secret) {
            return reply('invalid secret').code(401);
          }
          this.deploy.remove(org, repo, branch, (err, results) => {
            if (err) {
              return reply(err);
            }

            results.status = 'removed';

            reply(results);
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

            let type = 'deploy';
            if (deploy.type === 'remove') {
              type = 'remove';
            }

            const configFile = request.query.config;
            const url = `/${type}`;
            reply('ok');
            request.server.inject({
              url,
              method: 'POST',
              payload: {
                org: deploy.org,
                repo: deploy.repo,
                branch: deploy.branch,
                secret: this.secret,
                config: configFile
              }
            }, (res) => {
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

  start(allDone) {
    async.waterfall([
      (next) => {
        this.hapiServer.register({
          register: require('hapi-logr'),
          options: this.loggerConfig
        }, next);
      },
      (next) => {
        this.setupRoutes();
        next();
      }
    ], (err) => {
      this.hapiServer.start(allDone);
    });
  }

}

module.exports = Server;

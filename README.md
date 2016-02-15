# deploy

Shipment Deploy is a docker container that will manage deployments on your server. It exposes an api for deploying docker containers from github repos.

## Features

* Fetch latest code, build, run new code and stop existing containers

## Requirements

* [Github Personal Access Token](https://github.com/blog/1509-personal-api-tokens).  It is recommended to create a separate user for deployments that you add to the repos you want to deploy.

## Usage

```sh
docker run -e GH_USERNAME=username -e GH_TOKEN=token -e SECRET=secret -p 5000 shipment/deploy
```

## API

```
http://${server host}:${deploy port}/deploy?org=${org}&repo=${repo}&branch=${branch}&secret=${secret}`
```

## Auto Deployment from Github Webhooks

* add `http://[server host]:[deploy port]/github` to your repo's webhooks
* put the same secret that you set up when running the container

## Docker Options

The deploy script will automatically look for `autodeploy.json` in your repo's folder.  In there you can set additional docker args:

```json
{
  "dockerargs": "-e NODE_ENV=production"
}
```

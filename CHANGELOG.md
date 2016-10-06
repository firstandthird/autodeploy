
0.0.21 / 2016-10-06
==================

  * add support for setting LETSENCRYPT_HOST with https: true

0.0.20 / 2016-10-06
==================

  * updated to hapi-password 2
  * updated cookies to allow insecure

0.0.19 / 2016-10-05
==================

  * be able to set what branch gets root domain
  * support multiple virtual urls when logging
  * set VIRTUAL_HOST automatically
  * support for env based scaling

0.0.18 / 2016-10-04
==================

  * updated deps

0.0.17 / 2016-10-04
==================

  * add support for setting slack username
  * reset submodule on deployment

0.0.16 / 2016-08-08
==================

  * hide tags when sending to slack
  * more consistent logging format
  * fixed signature comparison when using special characters

0.0.15 / 2016-07-08
==================

  * if e.VIRTUAL_HOST set in docker args, then output it as the url of the   log
  * better error logging
  * moved arg parsing into docker so its easier to set additional params
  * updated slack integration. better output and messages

0.0.12 / 2016-07-06
==================

  * fix for errors happing up the ladder and throwing inside read config
  * BREAKING: removed folder functionality, added dockerfile support in config. Note: build is always done from root folder

0.0.11 / 2016-07-05
==================

  * support for building a subfolder

0.0.10 / 2016-07-05
==================

  * added hapi-slack support. pass in SLACK webhook as env var
  * added warning tag to update-checker log
  * update checker
  * group running containers and show auto deploy url
  * added password protect to admin page
  * redirect / to /ui
  * added run script
  * added a basic admin ui
  * added more labels
  * update rapptor to 1.1.0
  * removed volume in dockerfile

0.0.9 / 2016-06-06
==================

  * Updating max buffer on docker.cmd to 1000K, or roughly 1M

0.0.8 / 2016-05-25
==================

  * fixed remove function

0.0.7 / 2016-05-24
==================

  * fixed passing vars to config

0.0.6 / 2016-05-24
==================

  * added /api/info to display version of deploy
  * deprecation warning if dockerargs is a string
  * fixed bug if no deploy.json found
  * fixed sharedConfigPath issue

0.0.5 / 2016-05-23
==================

  * changed restart policy to on-failure:5
  * added api endpoints for /api/running and /api/details
  * expose docker on server object
  * added a filter function to docker
  * added shipment=deploy label to deployed containers

0.0.4 / 2016-05-21
==================

  * support dockerargs object in deploy.json

0.0.3 / 2016-05-20
==================

  * refactored to use rapptor
  * silent npm install
  * changed to npm start

0.0.2 / 2016-05-20
==================

  * changed endpoints to POST

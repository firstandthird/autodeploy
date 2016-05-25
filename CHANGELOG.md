
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

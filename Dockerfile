FROM ubuntu

#GIT
RUN apt-get update && \
      apt-get install -y git curl

#NODE
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - && \
      apt-get install -y nodejs

#DOCKER
RUN curl -sSL https://get.docker.com/ | sh

VOLUME /root/.npm

#NODEMON
RUN npm i -g nodemon

#SETUP
RUN mkdir -p /repos

#APP
ADD package.json /app/
RUN cd /app && npm install
ENV PATH /app/node_modules/.bin:$PATH

ADD . /app/server
WORKDIR /app/server

CMD node index.js

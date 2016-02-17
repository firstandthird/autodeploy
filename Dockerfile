FROM ubuntu

#GIT
RUN apt-get update && \
      apt-get install -y git curl

#NODE
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - && \
      apt-get install -y nodejs

#DOCKER
RUN curl -sSL https://get.docker.com/ | sh

#NODEMON
RUN npm i -g nodemon

#SETUP
RUN mkdir -p /repos

ADD . /app
WORKDIR /app

CMD ["node", "index.js"]

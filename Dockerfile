FROM ubuntu

#GIT
RUN apt-get update && \
      apt-get install -y git curl

#NODE
RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - && \
      apt-get install -y nodejs

#DOCKER
RUN curl -sSL https://get.docker.com/ | sh

ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG C.UTF-8

WORKDIR /data

COPY run.sh /
COPY recorder.js /

RUN apk add --no-cache nodejs
RUN apk add --no-cache npm
RUN apk add --no-cache ffmpeg

RUN npm init -y
RUN npm install ring-client-api
RUN npm install express
RUN npm install uuid
RUN npm install console-stamp

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

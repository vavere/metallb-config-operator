FROM node:12-alpine

WORKDIR /usr/src/monitor
ENV NODE_ENV=production

COPY package* ./
RUN npm install --production

COPY index.js ./
CMD [ "node", "index.js" ]

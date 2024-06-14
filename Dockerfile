FROM node:lts-alpine
ENV MTA_KEY=0hiZE7noDF3ZosdY160aT6ah7EXD2ibE2ycBtDgP
ENV PORT=3001
ENV UPDATE_INTERVAL=100
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 3001
RUN chown -R node /usr/src/app
USER node
CMD ["node", "server.js"]

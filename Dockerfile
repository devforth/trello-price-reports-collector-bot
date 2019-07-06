FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .
EXPOSE 8589
CMD [ "node", "index.js" ]
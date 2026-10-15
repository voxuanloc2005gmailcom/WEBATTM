FROM node:24.21.0-alpine3.24
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]

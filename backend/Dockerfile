FROM node:24.21.0-alpine3.24
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY test ./test

USER node
EXPOSE 5000
CMD ["node", "src/server.js"]

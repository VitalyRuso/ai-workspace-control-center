FROM node:22-alpine

WORKDIR /app

COPY package.json server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]

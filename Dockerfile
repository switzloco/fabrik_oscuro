FROM node:24-alpine
WORKDIR /app
COPY server.js ./server.js
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]

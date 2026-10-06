FROM node:24-alpine
WORKDIR /app
COPY server.js ledger.js app.js styles.css index.html ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]

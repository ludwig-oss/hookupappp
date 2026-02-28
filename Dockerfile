# Build client
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build server
FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production: layout must match server (process.cwd() = /app, server/ and client/ under it)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix ./server
COPY --from=server /app/server/dist ./server/dist
COPY --from=client /app/client/dist ./client/dist
EXPOSE 5000
CMD ["node", "server/dist/index.js"]

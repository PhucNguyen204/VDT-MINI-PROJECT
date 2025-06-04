# -------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# -------- runtime --------------
FROM node:20-alpine
WORKDIR /app

# Install Docker CLI
RUN apk add --no-cache docker-cli

COPY --from=builder /app /app
RUN mkdir -p /runtime/logs /runtime/configs
EXPOSE 3000
CMD ["node", "src/server.js"]
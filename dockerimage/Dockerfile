########################################
# Keys stage: generate JWT keypair
########################################
FROM alpine:3 AS keys
RUN apk add --no-cache openssl
RUN openssl genrsa -out /tmp/private_rsa.pem 2048 \
  && openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in /tmp/private_rsa.pem -out /tmp/private_pkcs8.pem \
  && openssl rsa -in /tmp/private_rsa.pem -pubout -out /tmp/public.pem

########################################
# Frontend build stage
########################################
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
RUN apk add --no-cache openssl
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
# Use generated public key so the static bundle verifies backend JWTs
COPY --from=keys /tmp/public.pem ./jwt-public.pub
# Build-time env for Vite defines
ARG HOSTING_MODE=self
ENV NODE_ENV=production \
    HOSTING_MODE=$HOSTING_MODE
RUN yarn build

########################################
# Backend build stage
########################################
FROM oven/bun:1 AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/bun.lockb ./
RUN bun install --frozen-lockfile
COPY backend/ .
RUN bun run build

########################################
# Runtime stage: bun + nginx
########################################
FROM oven/bun:1 AS app
WORKDIR /app

# Install nginx, Postgres and tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     nginx postgresql postgresql-client curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install MinIO server and client (mc)
RUN curl -sSL -o /usr/local/bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio \
  && chmod +x /usr/local/bin/minio \
  && curl -sSL -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
  && chmod +x /usr/local/bin/mc

# Overwrite frontend public key with generated one and then copy build output
COPY --from=keys /tmp/public.pem /app/frontend/jwt-public.pub
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Copy backend runtime bits
COPY --from=backend-build /app/backend/dist /app/backend/dist
COPY --from=backend-build /app/backend/package.json /app/backend/package.json
# Copy backend node_modules so we can run drizzle-kit at runtime
COPY --from=backend-build /app/backend/node_modules /app/backend/node_modules
# Copy drizzle config and migrations
COPY --from=backend-build /app/backend/drizzle /app/backend/drizzle
COPY --from=backend-build /app/backend/drizzle.config.ts /app/backend/drizzle.config.ts
# Copy backend source (for drizzle schema path)
COPY --from=backend-build /app/backend/src /app/backend/src
COPY --from=backend-build /app/backend/tsconfig.json /app/backend/tsconfig.json
# Use generated private key (PKCS8) for backend JWT signing
COPY --from=keys /tmp/private_pkcs8.pem /app/backend/jwt-private.pem

# Nginx config for SPA + backend proxy
COPY dockerimage/nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint script to run both backend and nginx
COPY dockerimage/start.sh /start.sh
RUN chmod +x /start.sh

# Persistent data location
VOLUME ["/data"]

EXPOSE 80

ENV NODE_ENV=production

CMD ["/start.sh"]



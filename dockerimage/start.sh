#!/usr/bin/env bash
set -euo pipefail

############################################
# Defaults for required backend env vars
############################################
export NODE_ENV=${NODE_ENV:-production}
export HOSTING_MODE=${HOSTING_MODE:-self}
export PORT=${PORT:-5100}
export TRUST_PROXY=${TRUST_PROXY:-3}
export RATE_WINDOW_SEC=${RATE_WINDOW_SEC:-60}
export RATE_LIMIT=${RATE_LIMIT:-200}
export SESSION_TTL_MIN=${SESSION_TTL_MIN:-43200}
export COOKIE_SECRET=${COOKIE_SECRET:-dev-cookie-secret}
export LIMIT_JSON=${LIMIT_JSON:-2mb}
export LIMIT_RAW=${LIMIT_RAW:-2mb}
export NOTES_STORAGE_LIMIT=${NOTES_STORAGE_LIMIT:-1000000000}
export FILES_STORAGE_LIMIT=${FILES_STORAGE_LIMIT:-1000000000}

############################################
# External Postgres and MinIO endpoints via compose
############################################
export DATABASE_URL=${DATABASE_URL:-postgresql://notes:notes@db:5432/notes}
export MINIO_ROOT_USER=${MINIO_ROOT_USER}
export MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
export S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID:-$MINIO_ROOT_USER}
export S3_ACCESS_KEY_SECRET=${S3_ACCESS_KEY_SECRET:-$MINIO_ROOT_PASSWORD}
export S3_REGION=${S3_REGION:-EU-CENTRAL-1}
export S3_ENDPOINT=${S3_ENDPOINT:-http://minio:9000}
export S3_BUCKET=${S3_BUCKET:-ciphernotes}

############################################
# Apply migrations (DB health is ensured by compose depends_on)
############################################
cd /app/backend
echo "Applying migrations..."
./node_modules/.bin/drizzle-kit migrate || bun run db:migrate || true

############################################
# Start backend
############################################
bun /app/backend/dist/index.js &
BACKEND_PID=$!

############################################
# Start nginx (foreground)
############################################
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n $BACKEND_PID $NGINX_PID
exit $?



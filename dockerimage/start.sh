#!/usr/bin/env bash
set -euo pipefail

# Prepare data directories
mkdir -p /data/postgres /data/minio

############################################
# Defaults for required backend env vars
############################################
export NODE_ENV=${NODE_ENV:-production}
export HOSTING_MODE=${HOSTING_MODE:-self}
export PORT=${PORT:-5100}
export TRUST_PROXY=${TRUST_PROXY:-1}
export RATE_WINDOW_SEC=${RATE_WINDOW_SEC:-60}
export RATE_LIMIT=${RATE_LIMIT:-200}
export SESSION_TTL_MIN=${SESSION_TTL_MIN:-43200}
export COOKIE_SECRET=${COOKIE_SECRET:-dev-cookie-secret}
export LIMIT_JSON=${LIMIT_JSON:-1mb}
export LIMIT_RAW=${LIMIT_RAW:-10mb}
export NOTES_STORAGE_LIMIT=${NOTES_STORAGE_LIMIT:-1000000000}
export FILES_STORAGE_LIMIT=${FILES_STORAGE_LIMIT:-1000000000}

############################################
# Database URL default (internal Postgres)
############################################
export DATABASE_URL=${DATABASE_URL:-postgresql://notes:notes@localhost:5432/notes}

############################################
# MinIO/S3 defaults (internal MinIO)
############################################
export MINIO_ROOT_USER=${MINIO_ROOT_USER:-minio-admin}
export MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minio-admin}
export S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID:-$MINIO_ROOT_USER}
export S3_ACCESS_KEY_SECRET=${S3_ACCESS_KEY_SECRET:-$MINIO_ROOT_PASSWORD}
export S3_REGION=${S3_REGION:-EU-CENTRAL-1}
export S3_ENDPOINT=${S3_ENDPOINT:-http://127.0.0.1:9000}
export S3_BUCKET=${S3_BUCKET:-ciphernotes}

############################################
# Start Postgres
############################################
export PGDATA=/data/postgres
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA" || true
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Initializing Postgres data directory..."
  su -s /bin/sh postgres -c "/usr/lib/postgresql/*/bin/initdb -D $PGDATA -E UTF8 --no-locale"
  # Relax auth for localhost
  echo "local   all             all                                     trust" >> "$PGDATA/pg_hba.conf"
  echo "host    all             all             127.0.0.1/32            trust" >> "$PGDATA/pg_hba.conf"
  echo "host    all             all             ::1/128                 trust" >> "$PGDATA/pg_hba.conf"
fi
# Start postgres directly bound to localhost
su -s /bin/sh postgres -c "/usr/lib/postgresql/*/bin/postgres -D $PGDATA -c listen_addresses=localhost" &
POSTGRES_PID=$!

# Wait for Postgres up
until pg_isready -q -h 127.0.0.1 -p 5432; do echo "Waiting for Postgres..."; sleep 1; done

# Ensure database exists (connect over TCP to avoid peer auth)
if ! su -s /bin/sh postgres -c "psql -h 127.0.0.1 -p 5432 -tc \"SELECT 1 FROM pg_roles WHERE rolname='notes'\"" | grep -q 1; then
  su -s /bin/sh postgres -c "psql -h 127.0.0.1 -p 5432 -c \"CREATE ROLE notes LOGIN PASSWORD 'notes';\""
fi
if ! su -s /bin/sh postgres -c "psql -h 127.0.0.1 -p 5432 -tc \"SELECT 1 FROM pg_database WHERE datname='notes'\"" | grep -q 1; then
  su -s /bin/sh postgres -c "createdb -h 127.0.0.1 -p 5432 -O notes notes"
else
  su -s /bin/sh postgres -c "psql -h 127.0.0.1 -p 5432 -c \"ALTER DATABASE notes OWNER TO notes;\"" || true
fi

############################################
# Start MinIO
############################################
mkdir -p /data/minio
minio server /data/minio --console-address ":9001" &
MINIO_PID=$!

# Wait for MinIO up
until curl -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null 2>&1; do echo "Waiting for MinIO..."; sleep 1; done

# Create bucket if not exists
mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc ls local/${S3_BUCKET} || mc mb -p local/${S3_BUCKET}

############################################
# Apply migrations only
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
# Ensure no default site conflicts (keep our conf in conf.d)
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n $BACKEND_PID $NGINX_PID $MINIO_PID $POSTGRES_PID
exit $?



Self-hosted bundle
==================

Build and run everything with a single image plus Postgres and MinIO, persisting data to ./data.

Usage
-----

1) Copy `.env.example` to `.env` and adjust values.
2) Run: `docker compose -f dockerimage/docker-compose.yml up --build -d`
3) Open http://localhost:8080

Environment
-----------

- All persistent data is stored under `./data` on the host and mounted at `/data` in containers.
- The app runs in self-hosting mode with pro features for all users.



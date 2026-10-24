#!/usr/bin/env bash
set -euo pipefail

# Navigate to project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "=== [1/4] Pulling latest code ==="
git pull

echo "=== [2/4] Validating environment configuration ==="
if [ ! -f .env ]; then
  echo "ERROR: .env file does not exist!" >&2
  echo "Please copy .env.example to .env and configure all required secrets before running deploy." >&2
  exit 1
fi

echo "=== [3/4] Ensuring database x_blog exists on nexasx-postgres ==="
# One-off container on nexasx-internal network to check and create database idempotently
docker run --rm \
  --network nexasx-internal \
  --env-file .env \
  postgres:16-alpine \
  sh -c '
    set -e
    # Extract maintenance connection string: replace database name with /postgres
    # and DROP the query string entirely (?schema=public is a Prisma-only parameter
    # that libpq/psql rejects with "invalid URI query parameter")
    ADMIN_URL=$(echo "$DATABASE_URL" | sed -E "s|/[^/?]+(\?.*)?$|/postgres|")
    
    echo "Connecting to PostgreSQL to check database existence..."
    DB_EXISTS=$(psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='\''x_blog'\''")
    if [ "$DB_EXISTS" = "1" ]; then
      echo "Database x_blog already exists. Skipping creation."
    else
      echo "Creating database x_blog..."
      psql "$ADMIN_URL" -c "CREATE DATABASE x_blog;"
      echo "Database x_blog created successfully."
    fi
  '

echo "=== [4/4] Building and launching containers ==="
docker compose up -d --build

echo "=== Performing health checks ==="
MAX_RETRIES=30
RETRY_DELAY=2

echo "Waiting for web service (127.0.0.1:13100) to respond..."
WEB_OK=0
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf -o /dev/null "http://127.0.0.1:13100"; then
    echo "Web service is responding successfully!"
    WEB_OK=1
    break
  fi
  echo "Web service not ready yet (attempt $i/$MAX_RETRIES)..."
  sleep $RETRY_DELAY
done

if [ "$WEB_OK" -ne 1 ]; then
  echo "ERROR: Web service failed health check at http://127.0.0.1:13100" >&2
  docker compose logs --tail=50
  exit 1
fi

echo "Waiting for API health check via web proxy (http://127.0.0.1:13100/api/health)..."
API_OK=0
for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -sf "http://127.0.0.1:13100/api/health" || true)
  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    echo "API health check passed: $RESPONSE"
    API_OK=1
    break
  fi
  echo "API service not ready yet (attempt $i/$MAX_RETRIES)..."
  sleep $RETRY_DELAY
done

if [ "$API_OK" -ne 1 ]; then
  echo "ERROR: API failed health check at http://127.0.0.1:13100/api/health" >&2
  docker compose logs --tail=50
  exit 1
fi

echo "=== Deployment completed successfully! ==="

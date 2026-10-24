#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy

echo "=== Seeding database ==="
npx prisma db seed || echo "warn: Database seed failed or skipped"

echo "=== Starting NestJS application ==="
exec node dist/main.js

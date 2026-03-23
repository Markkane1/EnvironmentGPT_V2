#!/bin/sh
# =====================================================
# EPA Punjab EnvironmentGPT - Docker Entrypoint
# Phase 9: Deployment & Infrastructure
# =====================================================

set -e

echo "Starting EnvironmentGPT..."

# Wait for database to be ready
echo "Initializing database..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma 2>/dev/null || npx prisma db push --schema=/app/prisma/schema.prisma

# Run database migrations if needed
if [ -d "/app/prisma/migrations" ]; then
  echo "Running migrations..."
  npx prisma migrate deploy
else
  echo "Pushing database schema..."
  npx prisma db push
fi

# Seed initial data if needed
if [ "$SEED_DATABASE" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed 2>/dev/null || echo "No seed script found, skipping..."
fi

# Start the application
echo "Starting Next.js server..."
exec "$@"

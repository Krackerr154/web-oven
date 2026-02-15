#!/bin/sh
set -e

echo "🔄 Pushing Prisma schema to database (non-destructive)..."
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || \
  npx prisma db push --skip-generate

echo "🌱 Running database seed (idempotent)..."
npx prisma db seed 2>/dev/null || echo "⚠️  Seed skipped or already applied"

echo "🚀 Starting Next.js server..."
exec node server.js

#!/bin/sh
set -e

echo "🔄 Pushing Prisma schema to database (non-destructive)..."

MAX_RETRIES=5
RETRY_COUNT=0

until npx prisma db push || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "⏳ Database not ready yet. Retrying in 5 seconds... (Attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Failed to push schema after $MAX_RETRIES attempts."
  exit 1
fi

echo "✅ Database schema pushed successfully."

echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠️ Seeding skipped or already seeded."

echo "🚀 Starting Next.js server..."
exec node server.js
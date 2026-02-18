# Lab Oven Booking System

Next.js 14+ booking system for managing lab oven usage at G-Labs. Connects to an existing PostgreSQL container (`x01_db`) and runs on port **3005**.

## Architecture

- **Framework**: Next.js (App Router, TypeScript)
- **Auth**: NextAuth.js v4 (Credentials Provider, JWT sessions)
- **ORM**: Prisma 7 (separate database `oven_booking_db` inside `x01_db` container)
- **UI**: Tailwind CSS + Lucide icons
- **Deployment**: Docker multi-stage build on `x01-bot_x01_net` network

## Features

- **2 Ovens**: Oven 1 (Non-Aqueous), Oven 2 (Aqueous)
- **User Registration**: Phone/Email -> PENDING -> Admin Approval required
- **Booking Rules**: Max 7 days, max 2 active bookings/user, no overlaps
- **Maintenance Mode**: Admin can set oven to maintenance -> auto-cancels all active bookings
- **Dashboard**: Live oven status with current usage info

## Pre-Deployment: One-Time Database Setup

Connect to the existing `x01_db` container and create the database + user:

```bash
docker exec -it x01_db psql -U postgres
```

```sql
CREATE DATABASE oven_booking_db;
CREATE USER oven_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE oven_booking_db TO oven_user;

-- Required for Postgres 15+
\c oven_booking_db
GRANT ALL ON SCHEMA public TO oven_user;
```

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://oven_user:PASSWORD@x01_db:5432/oven_booking_db` |
| `NEXTAUTH_URL` | Public URL (e.g., `http://your-ip:3005`) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password |
| `ADMIN_NAME` | Bootstrap admin display name |

### Timezone Policy (WIB)

- Booking input and display are fixed to **WIB** (`Asia/Jakarta`).
- App persists booking moments as UTC instants derived from WIB input (no legacy data migration in this change).
- Runtime container timezone is pinned with `TZ=Asia/Jakarta` and `PGTZ=Asia/Jakarta` in Docker Compose.

## Deploy

```bash
# Build and start
docker compose up -d --build

# Check logs
docker logs -f web-oven
```

The entrypoint script automatically:
1. Runs `prisma db push` (non-destructive, additive schema sync)
2. Runs `prisma db seed` (idempotent: upserts 2 ovens + admin user)
3. Starts the Next.js server

## Verify Deployment

```bash
# App responds on port 3005
curl http://localhost:3005

# Database isolation check - only oven_* tables exist
docker exec -it x01_db psql -U oven_user -d oven_booking_db -c "\dt"

# Port 3000 still serves x01_waha
curl http://localhost:3000
```

## Local Development

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

## Migration Safety

This project uses `prisma db push` (NOT `prisma migrate`) to sync the schema:
- **Additive only**: new tables/columns are created, nothing is dropped
- **No migration history**: no `_prisma_migrations` table, no conflict with other apps
- **Separate database**: `oven_booking_db` is completely isolated from the x01 bot database
- **Mapped table names**: all tables prefixed with `oven_` via `@@map()` as extra safety

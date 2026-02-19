# Lab Oven Booking System

Next.js booking system for managing lab oven usage at G-Labs. Connects to an existing PostgreSQL container (`x01_db`) and runs on port **3005**.

## Architecture

- **Framework**: Next.js 16 (App Router, TypeScript, Server Actions)
- **Auth**: NextAuth.js v4 (Credentials Provider, JWT sessions, 24h expiry)
- **ORM**: Prisma 7 with `@prisma/adapter-pg` (database `oven_booking_db` inside `x01_db` container)
- **UI**: Tailwind CSS 4 + Lucide icons + FullCalendar
- **Validation**: Zod schema validation on all forms
- **Deployment**: Docker multi-stage build on `x01-bot_x01_net` network

## Features

### Authentication & Authorization

- **Login**: Email/password credentials authentication
- **Registration**: Name, email, phone, password → account created with `PENDING` status
- **Approval Flow**: Admin must approve registrations before users can log in; rejected users are blocked
- **Role-Based Access**: `ADMIN` and `USER` roles; admin routes protected by middleware
- **JWT Sessions**: 24-hour session duration, role/status embedded in token
- **Pending Page**: After registration, users see a waiting-for-approval screen

### Dashboard

- **Live Oven Status Cards**: Each oven shows real-time status (Available / In Use / Maintenance)
- **Current Usage Info**: When an oven is in use, displays who is using it and until when
- **Active Bookings Summary**: Shows user's active bookings (count out of max 2) with quick links

### Booking System

- **Interactive Calendar**: FullCalendar month view with color-coded events (orange = Non-Aqueous, blue = Aqueous)
- **Oven Selector**: Choose from available ovens (excludes maintenance ovens); shows oven type, max temp, and description
- **Booking Form**: Start/end datetime (WIB), purpose, usage temperature (°C), and flap percentage (0–100%)
- **Booking Rules**:
  - Maximum **7 days** per booking
  - Maximum **2 active bookings** per user
  - No overlapping bookings on the same oven
  - Start date must be in the future
  - Usage temperature cannot exceed oven's max temp
- **Event Tooltip**: Click any calendar event to see booking details (who booked, dates, purpose, temp, flap)
- **Duration Display**: Human-readable duration (e.g., "2d 4h") shown throughout the app

### My Bookings

- **Booking List**: All user bookings (active, completed, cancelled, auto-cancelled) with status badges
- **Booking Detail**: Full booking info + timeline of lifecycle events
- **Self-Cancellation**: Users can cancel within a **15-minute window** after creation; after that, contact admin
- **Responsive Layout**: Card layout on mobile, table layout on desktop

### Admin Panel

#### User Management (`/admin/users`)
- **User Table**: View all users with name, email, phone, role, status, registration date, and booking count
- **Approve/Reject**: Pending users can be approved or rejected
- **Create User**: Admin can directly create new users (USER or ADMIN role) with pre-approved status
- **User Stats** (`/admin/users/[id]`): Per-user 6-month analytics including:
  - Total bookings, derived usage count, current active count
  - Status summary (ACTIVE, COMPLETED, CANCELLED, AUTO_CANCELLED)
  - Lifecycle event counts (CREATED, EDITED, CANCELLED, etc.)
  - Per-oven usage breakdown (bookings count + total hours)
  - Recent bookings list with links to admin booking detail
  - Recent lifecycle events

#### Booking Management (`/admin/bookings`)
- **All Bookings Table**: Overview of every booking with user, oven, dates, duration, temp, flap, purpose, and status
- **Booking Detail** (`/admin/bookings/[id]`): Full booking info with lifecycle timeline
- **Admin Actions on Active Bookings**:
  - **Edit**: Modify start/end dates, purpose, temp, flap (with overlap and duration re-validation)
  - **Cancel**: Admin cancellation (no time window restriction)
  - **Complete**: Mark booking as completed
  - **Remove**: Soft-delete (sets `deletedAt` timestamp, hides from user view)
- **Audit Trail**: Every action (create, edit, cancel, auto-cancel, complete, remove) is logged as a `BookingEvent` with actor, timestamp, note, and JSON payload of changes

#### Oven Management (`/admin/ovens`)
- **Oven Cards**: View all ovens with name, type, description, max temp, status, and active booking count
- **Add Oven**: Create new ovens (name, type, description, max temp)
- **Edit Oven**: Update oven properties via modal
- **Delete Oven**: Remove oven (only if no active bookings)
- **Maintenance Mode**: Toggle oven to maintenance → automatically cancels all active bookings with `AUTO_CANCELLED` status and event logs

### Responsive Design

- **Sidebar Navigation**: Collapsible sidebar with mobile hamburger menu and overlay
- **Adaptive Layouts**: Card layout on mobile, table layout on desktop for all list pages
- **User Info**: Sidebar shows current user name, email, and avatar initial

## Database Schema

| Table | Description |
|---|---|
| `oven_users` | Users with role (ADMIN/USER), status (PENDING/APPROVED/REJECTED), bcrypt password hash |
| `oven_ovens` | Ovens with name, type (NON_AQUEOUS/AQUEOUS), status (AVAILABLE/MAINTENANCE), max temp |
| `oven_bookings` | Bookings with start/end dates, purpose, usage temp, flap, status, soft-delete support |
| `oven_booking_events` | Audit trail: every lifecycle event with actor, type, note, and JSON payload |

All tables use the `oven_` prefix via `@@map()` for database isolation.

## API Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ovens` | List all ovens |
| `GET` | `/api/bookings?ovenId=` | Active bookings in FullCalendar event format (filterable by oven) |
| `*` | `/api/auth/[...nextauth]` | NextAuth.js authentication endpoints |

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
- App persists booking moments as UTC instants derived from WIB input.
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
2. Runs `prisma db seed` (idempotent: upserts ovens + admin user from env vars)
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

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Public auth pages
│   │   ├── login/           # Login page
│   │   ├── register/        # Registration page
│   │   └── pending/         # Waiting-for-approval page
│   ├── (dashboard)/         # Authenticated layout with sidebar
│   │   ├── page.tsx         # Dashboard (oven status + active bookings)
│   │   ├── book/            # Book an oven (calendar + form)
│   │   ├── my-bookings/     # User's bookings list + detail
│   │   └── admin/           # Admin panel
│   │       ├── users/       # User management + per-user stats
│   │       ├── bookings/    # Booking management + detail/edit
│   │       └── ovens/       # Oven CRUD + maintenance toggle
│   ├── actions/             # Server Actions
│   │   ├── auth.ts          # Registration
│   │   ├── booking.ts       # Create, cancel, get booking detail
│   │   └── admin.ts         # User/oven/booking management, stats
│   └── api/                 # API Routes
│       ├── auth/            # NextAuth endpoints
│       ├── bookings/        # Calendar events API
│       └── ovens/           # Oven list API
├── components/
│   ├── sidebar.tsx          # Responsive sidebar navigation
│   ├── booking-calendar.tsx # FullCalendar wrapper with tooltips
│   └── providers.tsx        # NextAuth SessionProvider
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── prisma.ts            # Prisma client singleton
│   └── utils.ts             # WIB timezone helpers, formatters, cn()
├── middleware.ts             # Route protection + admin role guard
└── types/
    └── next-auth.d.ts       # NextAuth type extensions
```

## Migration Safety

This project uses `prisma db push` (NOT `prisma migrate`) to sync the schema:
- **Additive only**: new tables/columns are created, nothing is dropped
- **No migration history**: no `_prisma_migrations` table, no conflict with other apps
- **Separate database**: `oven_booking_db` is completely isolated from the x01 bot database
- **Mapped table names**: all tables prefixed with `oven_` via `@@map()` as extra safety

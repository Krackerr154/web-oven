# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (port 3005)
npm run build    # Production build
npm run start    # Start production server
```

No lint, format, or test scripts are configured in package.json.

### Database (Prisma)

```bash
npx prisma db push          # Sync schema to DB (no migrations — additive only)
npx prisma generate         # Regenerate client after schema changes (outputs to src/generated/prisma)
npx prisma studio           # Open Prisma Studio
```

> This project intentionally uses `db push` instead of `prisma migrate`. Do NOT introduce migration files. All tables use `@@map("ap_*")` prefixes to isolate from other apps on the same DB.

## Architecture

**Next.js 16 App Router** — TypeScript, Server Actions, Tailwind CSS 4, Prisma 7 (PostgreSQL via `@prisma/adapter-pg`).

### Route Groups

- `(auth)/` — public auth pages: login, register, pending, verify-email
- `(dashboard)/` — all authenticated routes (sidebar layout); protected by middleware
- `api/auth/` — NextAuth endpoints + forgot/reset-password API routes
- `api/bookings/`, `api/instruments/` — thin API routes used for calendar event fetching

### Auth

- **NextAuth v4** with Credentials provider. Users log in with email or NIM + password.
- Auth config lives in `src/lib/auth.ts` (`authOptions`). Sessions use JWT, 24h expiry.
- Role (`ADMIN`/`USER`) and status (`PENDING`/`APPROVED`/`REJECTED`) are embedded in the JWT token.
- User `image` is intentionally excluded from JWT (stored as Base64 in DB; fetched per-session callback to avoid cookie size limits).
- Middleware at `src/middleware.ts` blocks unauthenticated access to all dashboard routes and redirects non-admins away from `/admin/*`.
- New users register with `PENDING` status → verify email via OTP → await admin approval before they can log in.

### Data Layer

- Prisma client singleton: `src/lib/prisma.ts`. Generated client is at `src/generated/prisma` (not the default `node_modules` location).
- All DB mutations go through **Server Actions** in `src/app/actions/`. Actions call `getServerSession(authOptions)` for auth checks.
- No dedicated queries directory — Server Components fetch directly via `prisma.*` or imported action functions.

### Key Data Models

- `User` — email/NIM login, role, status, profile image (Base64 stored in DB), supervisors array
- `Instrument` — lab instruments (Oven, Ultrasonic Bath, Glovebox, CPD); has category (Aqueous/Non-Aqueous), status, max temp
- `Booking` — links User ↔ Instrument; rules: max 7 days, max 2 active per user, no overlaps, self-cancel within 15 min
- `BookingEvent` — audit trail for every booking lifecycle change (actor: USER/ADMIN/SYSTEM)
- `InstrumentBan` — admin-issued bans blocking a user from booking a specific instrument
- `Reagent` — lab reagent inventory with owner and status
- `Glassware` / `GlasswareLoan` — glassware inventory and borrow tracking
- `Announcement` / `Reaction` / `AnnouncementComment` — lab announcements with emoji reactions and comments

### Notifications

Custom notification system — do **not** use `react-hot-toast` (it was removed). Theme config is at `src/config/notification-theme.ts`.

### External Services

- **Resend** (`src/lib/email.ts`) — transactional email (OTP, password reset)
- **Google Sheets** (`src/lib/sheets.ts`) — used for forms/XRD submission
- **FullCalendar** — booking calendar in `(dashboard)/book/`

### Path Alias

`@/*` maps to `src/*`.

### Deployment

Docker multi-stage build. Connects to an existing PostgreSQL container `x01_db` (database: `oven_booking_db`) on the `x01-bot_x01_net` Docker network. Runs on port **3005**.

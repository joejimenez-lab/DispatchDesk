# DispatchDesk

Local full-stack truck dispatcher/load management application built with Next.js App Router, TypeScript, Supabase, PostgreSQL, Supabase Storage, and Tailwind CSS.

## Features

- Email/password admin login through Supabase Auth
- Dashboard metrics for active, delivered, unpaid, closed, revenue, pending payments, operational status mix, current loads, upcoming deliveries, and maintenance due alerts
- Load CRUD with broker, driver, lane, operational status, financial fields, and notes
- Fuel cost tracking and profit calculation per load
- Fleet maintenance reminders for monthly truck service, 90-day and annual inspections, oil changes, and repair follow-ups, plus manual daily repair-log history
- Automatic date/mileage recurrence, maintenance completion history, audit attribution, snoozing, and overdue/due-soon/upcoming maintenance views
- Driver and broker management
- Invoice, client payment, driver payment, and dispatcher fee tracking
- Private document uploads per load through Supabase Storage
- Load notes and activity log
- Search and filters for loads, drivers, and brokers
- US location autocomplete for pickup and delivery fields
- RLS-enabled schema and private `load-documents` bucket

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run the migrations in `supabase/migrations/` in numeric order.

3. Create one admin user in Supabase Authentication.

4. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # Optional locally, required in production (see Production notes):
   NOMINATIM_USER_AGENT=DispatchDesk/1.0 (you@example.com)
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` and sign in with the Supabase admin user.

## Supabase notes

- The migration creates normalized tables: `profiles`, `drivers`, `brokers`, `loads`, `payments`, `documents`, `notes`, and `activity_logs`.
- `001_initial_schema.sql` is the full fresh-install schema. Later numbered migrations, such as `003_add_fuel_cost_to_loads.sql`, are for existing databases that already ran the initial schema.
- Every business table has RLS enabled.
- Version 1 allows any authenticated user to manage records, matching the single-admin requirement.
- The `load-documents` storage bucket is private. The `/api/documents/[id]/view` and `/api/documents/[id]/download` routes check auth, then fetch the file from Storage and stream it back to the browser (inline or as an attachment). The storage path is never exposed to the client.
- Location autocomplete uses OpenStreetMap Nominatim through `/api/locations/search` and limits results to US locations.
- The schema is structured so roles and multi-company support can be added later by introducing organization ownership columns and narrower RLS policies.

## Production notes

- **Disable public signups.** RLS grants the `authenticated` role full access to every table, so the single-admin model only holds if no one else can register. In the Supabase dashboard, turn off open email signups (or restrict to an allowlist) before deploying.
- **Set `NOMINATIM_USER_AGENT`** to a real contact (URL or email). OpenStreetMap's usage policy requires it and may block generic User-Agents.
- The full-text GIN indexes in `001_initial_schema.sql` are not used by the current `ilike` search; revisit them if search needs to scale.

## Verification

```bash
npm run lint
npm test
npm run build
```

Production backup, health-check, logging, and error-monitoring setup is documented in [`docs/production-operations.md`](docs/production-operations.md).

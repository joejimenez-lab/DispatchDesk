# DispatchDesk

Local full-stack truck dispatcher/load management application built with Next.js App Router, TypeScript, Supabase, PostgreSQL, Supabase Storage, and Tailwind CSS.

## Features

- Email/password admin login through Supabase Auth
- Dashboard metrics for active, delivered, unpaid, closed, revenue, pending payments, operational status mix, current loads, upcoming deliveries, and maintenance due alerts
- Load CRUD with broker, driver, lane, operational status, financial fields, and notes
- Load-level fuel estimates/allocations for projected load profit; actual fuel purchases are entered once through IFTA and linked to Bookkeeping
- Fleet maintenance reminders for monthly truck service, 90-day and annual inspections, oil changes, and repair follow-ups, plus manual daily repair-log history
- Automatic date/mileage recurrence, maintenance completion history, audit attribution, snoozing, and overdue/due-soon/upcoming maintenance views
- IFTA fuel tax tracking: trips with miles per state, fuel purchases with gallons and amount paid per state, quarterly per-state totals, saved-route mile prefill, and CSV exports for quarterly filing
- Unified expense ledger: Maintenance and IFTA create linked Bookkeeping transactions, receipts are shared at the transaction level, and operational edits update the same financial record
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

2. Start Supabase locally and reset the database from migrations:

   ```bash
   npm run supabase:start
   npm run db:reset
   ```

3. Create one admin user in local Supabase Authentication.

4. Copy `.env.example` to `.env.local` and fill in the local Supabase values printed by `npm run supabase:start`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   # Optional locally; required in production for your self-hosted Photon instance:
   # PHOTON_API_URL=http://127.0.0.1:2322/api
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` and sign in with the Supabase admin user.

## Supabase notes

- The migration creates normalized tables: `profiles`, `drivers`, `brokers`, `loads`, `payments`, `documents`, `notes`, and `activity_logs`.
- `001_initial_schema.sql` is the full fresh-install schema. Later numbered migrations, such as `003_add_fuel_cost_to_loads.sql`, are for existing databases that already ran the initial schema.
- Use `npm run db:push` after `supabase link --project-ref <project-ref>` to apply migrations to the hosted project.
- Use `npm run db:types` after local schema changes to regenerate `src/types/database.ts`.
- Every business table has RLS enabled.
- Every authenticated user belongs to one organization. RLS scopes all operational, financial, maintenance, and document records to that organization.
- The `load-documents` storage bucket is private. The `/api/documents/[id]/view` and `/api/documents/[id]/download` routes check auth, then fetch the file from Storage and stream it back to the browser (inline or as an attachment). The storage path is never exposed to the client.
- Location autocomplete uses Photon through `/api/locations/search` and limits results to US locations. Development has a low-volume demo fallback; production requires a configured, self-hosted instance. See [`docs/photon-geocoding.md`](docs/photon-geocoding.md) for setup and operations.
- New Auth users automatically receive an empty organization. The hosted demo login is the only account automatically attached to the fictional demo organization.

## Production notes

- **Disable public signups.** Organization RLS isolates registered users, but DispatchDesk has no public onboarding workflow. Create approved client users administratively or add an explicit invitation flow before enabling signups.
- **Set `PHOTON_API_URL`** to the full `/api` endpoint of a production self-hosted Photon instance. Do not configure the app to depend on a public demo geocoder.
- The full-text GIN indexes in `001_initial_schema.sql` are not used by the current `ilike` search; revisit them if search needs to scale.

## Private system status

The unlisted `/status` route is a restricted operational view for application, Supabase, and Vercel health. It is intentionally absent from primary navigation and returns a not-found response unless the signed-in user appears in `STATUS_PAGE_ALLOWED_EMAILS` or `STATUS_PAGE_ALLOWED_USER_IDS`.

Core checks work with the normal application Supabase configuration. Optional provider credentials add deeper visibility:

- `SUPABASE_MANAGEMENT_TOKEN` enables Realtime platform health and a bounded, redacted error feed from the previous hour. Prefer a fine-grained token with only project-health and analytics-log read permissions.
- `VERCEL_ACCESS_TOKEN` enables latest production deployment history. Current deployment metadata still appears on Vercel without this token when system environment variables are available.
- `VERCEL_TEAM_SLUG` and `VERCEL_PROJECT_NAME` make provider-console links project-specific; otherwise the page links to the Vercel dashboard.

All provider credentials remain server-only. Status responses use private, no-store caching and no-index headers. Vercel runtime logs are opened in the provider console because the application does not proxy raw runtime output.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Pull requests also run the database regression suite and a disposable local browser smoke test. Required jobs, fork behavior, test isolation, and local reproduction steps are documented in [`docs/testing-and-ci.md`](docs/testing-and-ci.md).

Production backup, health-check, logging, and error-monitoring setup is documented in [`docs/production-operations.md`](docs/production-operations.md).

# DispatchDesk

Local full-stack truck dispatcher/load management application built with Next.js App Router, TypeScript, Supabase, PostgreSQL, Supabase Storage, and Tailwind CSS.

## Features

- Email/password admin login through Supabase Auth
- Dashboard metrics for active, delivered, unpaid, closed, revenue, and pending payments
- Load CRUD with broker, driver, lane, status, financial fields, and notes
- Driver and broker management
- Payment tracking for client, driver, and dispatcher fee
- Private document uploads per load through Supabase Storage
- Load notes and activity log
- Search and filters for loads, drivers, and brokers
- RLS-enabled schema and private `load-documents` bucket

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run the migration in `supabase/migrations/001_initial_schema.sql`.

3. Create one admin user in Supabase Authentication.

4. Copy `.env.example` to `.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` and sign in with the Supabase admin user.

## Supabase notes

- The migration creates normalized tables: `profiles`, `drivers`, `brokers`, `loads`, `payments`, `documents`, `notes`, and `activity_logs`.
- Every business table has RLS enabled.
- Version 1 allows any authenticated user to manage records, matching the single-admin requirement.
- The `load-documents` storage bucket is private. Downloads are routed through `/api/documents/[id]/download`, which checks auth and redirects to a short-lived signed URL.
- The schema is structured so roles and multi-company support can be added later by introducing organization ownership columns and narrower RLS policies.

## Verification

```bash
npm run lint
npm run build
```

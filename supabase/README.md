# Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run the SQL files in `supabase/migrations/` in numeric order.
3. In Authentication, create one admin user with email/password.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. The migration creates the private `load-documents` storage bucket and RLS policies.

Version 1 uses one authenticated admin account. RLS is still enabled on every table and storage object so the anonymous public client cannot access business data.

For a fresh database, `001_initial_schema.sql` already includes the current schema. If an existing database was created before a later migration, run the later numbered migration files as well, such as `003_add_fuel_cost_to_loads.sql`.

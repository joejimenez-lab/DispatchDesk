# Supabase setup

## Local CLI workflow

1. Start the local Supabase stack:

   ```bash
   npm run supabase:start
   ```

2. Reset the local database from migrations:

   ```bash
   npm run db:reset
   ```

3. Regenerate app database types after schema changes:

   ```bash
   npm run db:types
   ```

4. Run database tests:

   ```bash
   npm run db:test
   ```

## Hosted project setup

1. Create a Supabase project.
2. Link the local repo to the project:

   ```bash
   supabase link --project-ref <project-ref>
   ```

3. Push the migrations:

   ```bash
   npm run db:push
   ```

4. In Authentication, create one admin user with email/password.
5. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. The migrations create the private `load-documents` storage bucket and RLS policies.

Version 1 uses one authenticated admin account. RLS is still enabled on every table and storage object so the anonymous public client cannot access business data.

For a fresh database, `001_initial_schema.sql` already includes the current schema. If an existing database was created before a later migration, run the later numbered migration files as well, such as `003_add_fuel_cost_to_loads.sql`.

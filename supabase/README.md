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

## Grand demo data

The committed seed replaces business data with a fictional, date-relative demo
covering only the `RD` and `RC` fleet scopes. It includes all load statuses,
payment edge cases, maintenance alert states, IFTA trips, unified bookkeeping,
and private Storage documents.

The generated sample PDFs are committed with the demo assets. Reset the local
database and upload both private Storage buckets in one command:

```bash
npm run demo:reset
```

The final PDFs are generated under `output/pdf/`. Database rows use stable UUIDs
that match the generated Storage object paths. Run the reset again any time you
want a clean demonstration state with dates recalculated relative to that day.

Audit the row counts, fleet isolation, operational reconciliation, and Storage
references with `npm run demo:audit:local` (or `npm run demo:audit:linked` for
the explicitly linked demo project).

To redesign the PDF fixtures, install `reportlab` in your Python environment and
run `npm run demo:pdfs` before resetting.

The seed does not delete real authentication accounts. It adds one fictional,
non-login audit user (`Andres Castillo`) so seeded created-by fields remain
readable. Continue signing in with the normal admin account.

`supabase db query --linked --file supabase/seed.sql` and
`supabase seed buckets --linked` target the linked hosted project and are
destructive to its business data. Use them only when the linked project is the
intended demo environment and after verifying locally.

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

## Recoverable document cleanup

Load and document deletion first queue affected Storage paths in `storage_cleanup_jobs`, then delete the database rows in an RPC transaction. After the database commit, the server removes queued objects from the private `load-documents` bucket and clears the queue rows only after Storage confirms deletion.

If Storage deletion or cleanup finalization fails, the server logs the failure and leaves the queue row with the bucket and path needed for retry. A retry should remove the listed object path from Storage and then delete the matching `storage_cleanup_jobs` row only after successful removal.

For a fresh database, `001_initial_schema.sql` already includes the current schema. If an existing database was created before a later migration, run the later numbered migration files as well, such as `003_add_fuel_cost_to_loads.sql`.

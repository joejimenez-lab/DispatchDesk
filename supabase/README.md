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

## Minimal demo data

The committed seed replaces only the fixed DispatchDesk Demo workspace with a
small fictional dataset: two drivers, one broker, and two loads. It does not
truncate shared tables or modify any other organization's rows. The minimal
demo has no maintenance, IFTA, bookkeeping, or private Storage documents.

Reset the local database and load the minimal demo in one command:

```bash
npm run demo:reset
```

Run the reset again any time you want the same clean, minimal demonstration
state with dates recalculated relative to that day.

The seed does not delete real authentication accounts. On a fresh local reset,
it temporarily uses an audit identity for tenant-aware triggers and removes that
row before commit. Continue signing in with the normal admin account.

`supabase db query --linked --file supabase/seed.sql` targets the linked hosted
project and replaces only the fixed demo workspace. Verify the linked project
and tenant IDs before using it.

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

4. In Authentication, create approved client users with email/password. Each new user automatically receives an isolated, empty organization.
5. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. The migrations create the private `load-documents` storage bucket and RLS policies.

RLS isolates every business row and private Storage object by organization. The
`dispatchdesk123@maildrop.cc` login is attached to the fictional demo
organization; other users, including `dcgemscorp@gmail.com`, receive separate
workspaces.

## Recoverable document cleanup

Load and document deletion first queue affected Storage paths in `storage_cleanup_jobs`, then delete the database rows in an RPC transaction. After the database commit, the server removes queued objects from the private `load-documents` bucket and clears the queue rows only after Storage confirms deletion.

If Storage deletion or cleanup finalization fails, the server logs the failure and leaves the queue row with the bucket and path needed for retry. A retry should remove the listed object path from Storage and then delete the matching `storage_cleanup_jobs` row only after successful removal.

For a fresh database, `001_initial_schema.sql` already includes the current schema. If an existing database was created before a later migration, run the later numbered migration files as well, such as `003_add_fuel_cost_to_loads.sql`.

# Supabase setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/migrations/001_initial_schema.sql`.
3. In Authentication, create one admin user with email/password.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. The migration creates the private `load-documents` storage bucket and RLS policies.

Version 1 uses one authenticated admin account. RLS is still enabled on every table and storage object so the anonymous public client cannot access business data.

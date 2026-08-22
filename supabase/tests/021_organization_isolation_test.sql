begin;

select plan(19);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'organization_members', 'organization memberships table exists');
select has_column('public', 'loads', 'organization_id', 'loads carry tenant ownership');
select has_column('public', 'bookkeeping_expense_groups', 'organization_id', 'bookkeeping carries tenant ownership');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '21000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dispatchdesk123@maildrop.cc', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '21000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'dcgemscorp@gmail.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"DCG EMS Corp"}', now(), now(), '', '', '', ''
);

select is(
  (select organization_id from public.organization_members where user_id = '21000000-0000-4000-8000-000000000001'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  'the DispatchDesk demo login is assigned to the demo organization'
);

select isnt(
  (select organization_id from public.organization_members where user_id = '21000000-0000-4000-8000-000000000002'),
  '00000000-0000-4000-8000-000000000001'::uuid,
  'the production login receives a separate organization'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated","email":"dcgemscorp@gmail.com"}',
  true
);
set local role authenticated;

select is((select count(*) from public.loads), 0::bigint, 'production starts with no demo loads');
select is((select count(*) from public.drivers), 0::bigint, 'production starts with no demo drivers');

select lives_ok(
  $$
    insert into public.loads (
      id, load_number, pickup_location, delivery_location, status
    ) values (
      '21000000-0000-4000-8000-000000000010',
      'SHARED-LOAD-NUMBER', 'Los Angeles, CA', 'Phoenix, AZ', 'Booked'
    )
  $$,
  'production can create its own load'
);

select is(
  (select organization_id from public.loads where id = '21000000-0000-4000-8000-000000000010'),
  public.current_organization_id(),
  'new rows default to the signed-in organization'
);

select is_empty(
  $$
    update public.loads
    set notes = 'cross-tenant update'
    where id = '14000000-0000-4000-8000-000000000001'
    returning 1
  $$,
  'production cannot update a demo row by a known ID'
);

select throws_ok(
  $$
    insert into public.notes (load_id, note_text)
    values ('14000000-0000-4000-8000-000000000001', 'cross-tenant note')
  $$,
  '23503',
  null,
  'tenant-consistent foreign keys reject references to demo rows'
);

select throws_ok(
  $$
    insert into public.drivers (organization_id, name)
    values ('00000000-0000-4000-8000-000000000001', 'Spoofed demo driver')
  $$,
  '42501',
  null,
  'RLS rejects attempts to spoof another organization ID'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('load-documents', '21000000-0000-4000-8000-000000000010/production.pdf')
  $$,
  'production can upload beneath its own load path'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name)
    values ('load-documents', '14000000-0000-4000-8000-000000000001/cross-tenant.pdf')
  $$,
  '42501',
  null,
  'storage policies reject uploads beneath a demo load path'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated","email":"dispatchdesk123@maildrop.cc"}',
  true
);

select cmp_ok((select count(*) from public.loads), '>', 0::bigint, 'the demo login still sees seeded demo loads');
select is(
  (select count(*) from public.loads where id = '21000000-0000-4000-8000-000000000010'),
  0::bigint,
  'the demo login cannot see the production load'
);

select lives_ok(
  $$
    insert into public.loads (
      id, load_number, pickup_location, delivery_location, status
    ) values (
      '21000000-0000-4000-8000-000000000011',
      'SHARED-LOAD-NUMBER', 'Ontario, CA', 'Las Vegas, NV', 'Booked'
    )
  $$,
  'different organizations may reuse the same load number'
);

select is(
  (select count(*) from storage.objects where name = '21000000-0000-4000-8000-000000000010/production.pdf'),
  0::bigint,
  'the demo login cannot read production storage objects'
);

reset role;
select * from finish();
rollback;

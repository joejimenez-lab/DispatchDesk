begin;

select plan(19);

select has_table('public', 'contact_merge_logs', 'contact merge audit table exists');
select has_function('public', 'merge_broker_records', array['uuid', 'uuid', 'jsonb'], 'broker merge function exists');
select has_function('public', 'merge_driver_records', array['uuid', 'uuid', 'jsonb'], 'driver merge function exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'contact-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Contact One"}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'contact-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Contact Two"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","email":"contact-one@example.com"}', true);
set local role authenticated;

insert into public.brokers (id, company_name, contact_name, notes) values
('30000000-0000-4000-8000-000000000010', 'Acme Logistics', 'Alex', 'first note'),
('30000000-0000-4000-8000-000000000011', 'Acme Logistic', 'Sam', 'second note');
insert into public.drivers (id, name, phone) values
('30000000-0000-4000-8000-000000000020', 'Driver One', '555-0100'),
('30000000-0000-4000-8000-000000000021', 'Driver 1', '555-0100');
insert into public.loads (id, load_number, broker_id, driver_id, pickup_location, delivery_location) values
('30000000-0000-4000-8000-000000000030', 'CONTACT-MERGE-1', '30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000021', 'A', 'B');
insert into public.bookkeeping_expense_groups (id, expense_date, driver_id) values
('30000000-0000-4000-8000-000000000040', current_date, '30000000-0000-4000-8000-000000000021');

select lives_ok(
  $$select public.merge_broker_records(
    '30000000-0000-4000-8000-000000000010',
    '30000000-0000-4000-8000-000000000011',
    '{"company_name":"Acme Logistics","contact_name":"Sam","phone":"555-0101","email":"ops@acme.test","notes":"first note\n\nsecond note"}'::jsonb
  )$$,
  'broker merge succeeds inside the current organization'
);
select is((select count(*) from public.brokers where id in ('30000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000011')), 1::bigint, 'duplicate broker is removed');
select is((select broker_id from public.loads where id = '30000000-0000-4000-8000-000000000030'), '30000000-0000-4000-8000-000000000010'::uuid, 'broker load history is reassigned');
select is((select contact_name from public.brokers where id = '30000000-0000-4000-8000-000000000010'), 'Sam', 'explicit broker conflict choice is kept');
select is((select count(*) from public.contact_merge_logs where contact_type = 'broker'), 1::bigint, 'broker merge is audited');

select lives_ok(
  $$select public.merge_driver_records(
    '30000000-0000-4000-8000-000000000020',
    '30000000-0000-4000-8000-000000000021',
    '{"name":"Driver One","phone":"555-0100","email":"driver@example.com","truck_number":"101","trailer_number":"5001","notes":"Combined"}'::jsonb
  )$$,
  'driver merge succeeds inside the current organization'
);
select is((select count(*) from public.drivers where id in ('30000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000021')), 1::bigint, 'duplicate driver is removed');
select is((select driver_id from public.loads where id = '30000000-0000-4000-8000-000000000030'), '30000000-0000-4000-8000-000000000020'::uuid, 'driver load history is reassigned');
select is((select driver_id from public.bookkeeping_expense_groups where id = '30000000-0000-4000-8000-000000000040'), '30000000-0000-4000-8000-000000000020'::uuid, 'driver bookkeeping history is reassigned');
select is((select count(*) from public.contact_merge_logs where contact_type = 'driver'), 1::bigint, 'driver merge is audited');

reset role;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated","email":"contact-two@example.com"}', true);
set local role authenticated;

select is((select count(*) from public.contact_merge_logs), 0::bigint, 'other organizations cannot read merge history');
select throws_ok(
  $$select public.merge_broker_records(
    '30000000-0000-4000-8000-000000000010',
    '30000000-0000-4000-8000-000000000011',
    '{}'::jsonb
  )$$,
  '42501',
  'Both broker records must belong to the current organization',
  'cross-organization broker merge is rejected'
);
select throws_ok(
  $$select public.merge_driver_records(
    '30000000-0000-4000-8000-000000000020',
    '30000000-0000-4000-8000-000000000021',
    '{}'::jsonb
  )$$,
  '42501',
  'Both driver records must belong to the current organization',
  'cross-organization driver merge is rejected'
);

select isnt((select current_organization_id()), null::uuid, 'second organization remains provisioned');
select is((select count(*) from public.brokers), 0::bigint, 'other organization cannot see merged broker');
select is((select count(*) from public.drivers), 0::bigint, 'other organization cannot see merged driver');

reset role;
select * from finish();
rollback;

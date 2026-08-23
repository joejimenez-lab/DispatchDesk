begin;

select plan(11);

select has_column('public', 'ifta_trips', 'unit_id', 'IFTA trips have a durable unit relationship');
select fk_ok('public', 'ifta_trips', 'unit_id', 'public', 'fleet_units', 'id', 'IFTA trip units use a foreign key');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
('00000000-0000-0000-0000-000000000000', '67000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'scope-a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '67000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'scope-b@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

select set_config('request.jwt.claims', '{"sub":"67000000-0000-4000-8000-000000000001","role":"authenticated","email":"scope-a@example.com"}', true);
set local role authenticated;

insert into public.fleet_units (id, unit_number, unit_type, company) values
  ('67000000-0000-4000-8000-000000000010', 'RD-1', 'Truck', 'RD'),
  ('67000000-0000-4000-8000-000000000011', 'RC-1', 'Truck', 'RC'),
  ('67000000-0000-4000-8000-000000000012', 'RD-T', 'Trailer', 'RD');

select lives_ok(
  $$insert into public.ifta_trips (id, unit_id, truck_number, start_date, pickup_city, dropoff_city)
    values ('67000000-0000-4000-8000-000000000020', '67000000-0000-4000-8000-000000000010', 'ignored', current_date, 'A', 'B')$$,
  'a same-tenant truck can be assigned to an IFTA trip'
);

select is((select truck_number from public.ifta_trips where id = '67000000-0000-4000-8000-000000000020'), 'RD-1', 'truck number is snapshotted from the unit');

insert into public.ifta_trips (id, unit_id, truck_number, start_date, pickup_city, dropoff_city)
values ('67000000-0000-4000-8000-000000000021', '67000000-0000-4000-8000-000000000011', 'ignored', current_date, 'A', 'C');

select is((select count(*)::integer from public.ifta_trips where unit_id = '67000000-0000-4000-8000-000000000010'), 1, 'RD trip scope has one row');
select is((select count(*)::integer from public.ifta_trips where unit_id = '67000000-0000-4000-8000-000000000011'), 1, 'RC trip scope has one row');
select is((select count(*)::integer from public.ifta_trips), 2, 'all fleets includes both scoped rows');

select throws_ok(
  $$insert into public.ifta_trips (unit_id, truck_number, start_date, pickup_city, dropoff_city)
    values ('67000000-0000-4000-8000-000000000012', 'ignored', current_date, 'A', 'B')$$,
  '23514', null, 'a trailer cannot be assigned to an IFTA trip'
);

select set_config('request.jwt.claims', '{"sub":"67000000-0000-4000-8000-000000000002","role":"authenticated","email":"scope-b@example.com"}', true);

insert into public.fleet_units (id, unit_number, unit_type, company)
values ('67000000-0000-4000-8000-000000000030', 'RD-1', 'Truck', 'RD');

select is((select count(*)::integer from public.ifta_trips), 0, 'another tenant cannot see the first tenant trips');

select throws_ok(
  $$insert into public.ifta_trips (unit_id, truck_number, start_date, pickup_city, dropoff_city)
    values ('67000000-0000-4000-8000-000000000010', 'ignored', current_date, 'A', 'B')$$,
  '23503', null, 'an IFTA trip cannot reference another tenant unit'
);

select lives_ok(
  $$insert into public.ifta_trips (unit_id, truck_number, start_date, pickup_city, dropoff_city)
    values ('67000000-0000-4000-8000-000000000030', 'ignored', current_date, 'A', 'B')$$,
  'the same fleet code remains isolated per tenant'
);

select * from finish();
rollback;

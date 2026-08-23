begin;

select plan(26);

select has_column('public', 'loads', 'truck_unit_id', 'loads link to a truck unit');
select has_column('public', 'loads', 'trailer_unit_id', 'loads link to a trailer unit');
select has_column('public', 'loads', 'fleet_company', 'loads keep a durable fleet classification');
select has_column('public', 'loads', 'truck_number', 'loads keep the assigned truck number');
select has_column('public', 'loads', 'trailer_number', 'loads keep the assigned trailer number');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '66000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'issue66-a@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '66000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'issue66-b@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000001","role":"authenticated","email":"issue66-a@example.com"}',
  true
);
set local role authenticated;

insert into public.drivers (
  id, name, truck_number, trailer_number
) values (
  '66000000-0000-4000-8000-000000000010',
  'Equipment Test Driver', 'A-TRUCK', 'A-TRAILER'
);

insert into public.fleet_units (id, unit_number, unit_type, company) values
  ('66000000-0000-4000-8000-000000000020', 'A-TRUCK', 'Truck', 'Fleet A'),
  ('66000000-0000-4000-8000-000000000021', 'A-TRAILER', 'Trailer', 'Fleet A'),
  ('66000000-0000-4000-8000-000000000022', 'B-TRUCK', 'Truck', 'Fleet B'),
  ('66000000-0000-4000-8000-000000000023', 'B-TRAILER', 'Trailer', 'Fleet B');

select lives_ok(
  $$
    insert into public.loads (
      id, load_number, driver_id, fleet_company, truck_unit_id, trailer_unit_id,
      pickup_location, delivery_location, status
    ) values (
      '66000000-0000-4000-8000-000000000030', 'ISSUE66-VALID',
      '66000000-0000-4000-8000-000000000010', 'Fleet A',
      '66000000-0000-4000-8000-000000000020',
      '66000000-0000-4000-8000-000000000021',
      'Los Angeles, CA', 'Phoenix, AZ', 'Booked'
    )
  $$,
  'same-fleet truck and trailer assignments are accepted'
);

select is(
  (select fleet_company from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'Fleet A',
  'the canonical fleet is stored on the load'
);
select is(
  (select truck_number from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'A-TRUCK',
  'the assigned truck number is snapshotted'
);
select is(
  (select trailer_number from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'A-TRAILER',
  'the assigned trailer number is snapshotted'
);

select lives_ok(
  $$
    select public.create_load_with_deductions(
      '{
        "load_number":"ISSUE66-RPC",
        "broker_id":null,
        "carrier_company":"Test Carrier",
        "driver_id":null,
        "fleet_company":"Fleet B",
        "truck_unit_id":"66000000-0000-4000-8000-000000000022",
        "trailer_unit_id":"66000000-0000-4000-8000-000000000023",
        "pickup_location":"Fresno, CA",
        "pickup_date":null,
        "delivery_location":"Portland, OR",
        "delivery_date":null,
        "is_round_trip":false,
        "return_location":null,
        "round_trip_details":null,
        "load_rate":1000,
        "driver_pay":500,
        "dispatcher_fee":100,
        "fuel_cost":50,
        "factoring_mode":"percentage",
        "factoring_percent":0,
        "factoring_fixed_amount":0,
        "notes":null,
        "status":"Booked"
      }'::jsonb,
      '[]'::jsonb
    )
  $$,
  'the atomic create RPC stores load equipment'
);

select is(
  (select truck_unit_id from public.loads where load_number = 'ISSUE66-RPC'),
  '66000000-0000-4000-8000-000000000022'::uuid,
  'the create RPC persists its truck relationship'
);

select lives_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE66-RPC'),
      '{
        "load_number":"ISSUE66-RPC",
        "broker_id":null,
        "carrier_company":"Test Carrier",
        "driver_id":null,
        "fleet_company":"Fleet A",
        "truck_unit_id":"66000000-0000-4000-8000-000000000020",
        "trailer_unit_id":"66000000-0000-4000-8000-000000000021",
        "pickup_location":"Fresno, CA",
        "pickup_date":null,
        "delivery_location":"Portland, OR",
        "delivery_date":null,
        "is_round_trip":false,
        "return_location":null,
        "round_trip_details":null,
        "load_rate":1000,
        "driver_pay":500,
        "dispatcher_fee":100,
        "fuel_cost":50,
        "factoring_mode":"percentage",
        "factoring_percent":0,
        "factoring_fixed_amount":0,
        "notes":null,
        "status":"Booked"
      }'::jsonb,
      '{
        "invoice_sent":false,
        "invoice_sent_date":null,
        "client_paid":false,
        "client_amount_received":0,
        "client_date_received":null,
        "driver_paid":false,
        "driver_amount_paid":0,
        "driver_date_paid":null,
        "dispatcher_fee_amount":100,
        "dispatcher_paid":false,
        "dispatcher_date_paid":null
      }'::jsonb,
      '[]'::jsonb
    )
  $$,
  'the atomic update RPC can change load equipment'
);

select is(
  (select fleet_company from public.loads where load_number = 'ISSUE66-RPC'),
  'Fleet A',
  'the update RPC persists the new fleet assignment'
);

select throws_ok(
  $$
    update public.loads
    set truck_unit_id = '66000000-0000-4000-8000-000000000021'
    where id = '66000000-0000-4000-8000-000000000030'
  $$,
  '23514',
  null,
  'a trailer cannot be assigned as the truck'
);

select throws_ok(
  $$
    update public.loads
    set trailer_unit_id = '66000000-0000-4000-8000-000000000020'
    where id = '66000000-0000-4000-8000-000000000030'
  $$,
  '23514',
  null,
  'a truck cannot be assigned as the trailer'
);

select throws_ok(
  $$
    update public.loads
    set trailer_unit_id = '66000000-0000-4000-8000-000000000023'
    where id = '66000000-0000-4000-8000-000000000030'
  $$,
  '23514',
  null,
  'truck and trailer assignments cannot cross fleets'
);

select throws_ok(
  $$
    update public.loads
    set fleet_company = 'Fleet B'
    where id = '66000000-0000-4000-8000-000000000030'
  $$,
  '23514',
  null,
  'the selected fleet must match assigned equipment'
);

update public.drivers
set truck_number = 'NEW-DRIVER-TRUCK', trailer_number = 'NEW-DRIVER-TRAILER'
where id = '66000000-0000-4000-8000-000000000010';

select is(
  (select truck_number from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'A-TRUCK',
  'changing a driver default does not rewrite historical truck equipment'
);
select is(
  (select trailer_number from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'A-TRAILER',
  'changing a driver default does not rewrite historical trailer equipment'
);

update public.fleet_units
set unit_number = 'RENAMED-TRUCK', company = 'Renamed Fleet'
where id = '66000000-0000-4000-8000-000000000020';

update public.loads
set notes = 'An unrelated historical edit'
where id = '66000000-0000-4000-8000-000000000030';

select is(
  (select truck_number from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'A-TRUCK',
  'unit metadata changes do not rewrite the load snapshot'
);
select is(
  (select fleet_company from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  'Fleet A',
  'ordinary edits preserve the historical fleet snapshot'
);

select throws_ok(
  $$delete from public.fleet_units where id = '66000000-0000-4000-8000-000000000020'$$,
  '23503',
  null,
  'assigned equipment cannot be deleted out from under a load'
);

select lives_ok(
  $$
    insert into public.loads (
      id, load_number, fleet_company, pickup_location, delivery_location, status
    ) values (
      '66000000-0000-4000-8000-000000000031', 'ISSUE66-FLEET-ONLY',
      'Fleet B', 'Ontario, CA', 'Reno, NV', 'Booked'
    )
  $$,
  'a valid tenant fleet can be saved before equipment is assigned'
);

select throws_ok(
  $$
    insert into public.loads (
      id, load_number, fleet_company, pickup_location, delivery_location, status
    ) values (
      '66000000-0000-4000-8000-000000000032', 'ISSUE66-UNKNOWN-FLEET',
      'Another tenant fleet', 'Ontario, CA', 'Reno, NV', 'Booked'
    )
  $$,
  '23514',
  null,
  'a fleet-only assignment must resolve inside the tenant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"66000000-0000-4000-8000-000000000002","role":"authenticated","email":"issue66-b@example.com"}',
  true
);

insert into public.loads (
  id, load_number, pickup_location, delivery_location, status
) values (
  '66000000-0000-4000-8000-000000000040', 'ISSUE66-TENANT-B',
  'Fresno, CA', 'Portland, OR', 'Booked'
);

select throws_ok(
  $$
    update public.loads
    set truck_unit_id = '66000000-0000-4000-8000-000000000022'
    where id = '66000000-0000-4000-8000-000000000040'
  $$,
  '23503',
  null,
  'a load cannot reference another tenant truck'
);

select is(
  (select count(*) from public.loads where id = '66000000-0000-4000-8000-000000000030'),
  0::bigint,
  'another tenant cannot read the assigned load'
);

reset role;
select * from finish();
rollback;

begin;

select plan(28);

select has_table('public', 'load_deductions', 'load deductions table exists');
select has_column('public', 'loads', 'factoring_percent', 'loads store the factoring percentage');
select has_column('public', 'loads', 'factoring_amount', 'loads expose the generated factoring amount');
select has_column('public', 'load_deductions', 'load_id', 'deductions belong to a load');
select has_column('public', 'load_deductions', 'label', 'deductions keep a label');
select has_column('public', 'load_deductions', 'amount', 'deductions keep an amount');

select is(
  (select count(*) from public.loads where factoring_percent <> 0 or factoring_amount <> 0),
  0::bigint,
  'existing loads default to zero factoring and retain their prior profit inputs'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '68000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'issue68-a@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '68000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'issue68-b@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

select set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000001","role":"authenticated","email":"issue68-a@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_load_with_deductions(
      '{
        "load_number": "ISSUE68-ATOMIC",
        "broker_id": null,
        "carrier_company": "Test Carrier",
        "driver_id": null,
        "pickup_location": "Los Angeles, CA",
        "pickup_date": null,
        "delivery_location": "Phoenix, AZ",
        "delivery_date": null,
        "is_round_trip": false,
        "return_location": null,
        "round_trip_details": null,
        "load_rate": 1250.55,
        "driver_pay": 500,
        "dispatcher_fee": 100,
        "fuel_cost": 50,
        "factoring_percent": 3,
        "notes": null,
        "status": "Booked"
      }'::jsonb,
      '[{"label":"Lumper fee","amount":75},{"label":"Scale fee","amount":25}]'::jsonb
    )
  $$,
  'atomic create saves a load and its deductions'
);

select is(
  (select factoring_percent from public.loads where load_number = 'ISSUE68-ATOMIC'),
  3::numeric,
  'factoring percentage is stored separately'
);

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-ATOMIC'),
  37.52::numeric,
  'factoring amount is generated with cent rounding'
);

select is(
  (select count(*) from public.load_deductions d join public.loads l on l.id = d.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  2::bigint,
  'atomic create saves every labeled deduction'
);

select is(
  (select sum(d.amount) from public.load_deductions d join public.loads l on l.id = d.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  100::numeric,
  'custom deduction amounts remain separate and total correctly'
);

select is(
  (select count(*) from public.payments p join public.loads l on l.id = p.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  1::bigint,
  'atomic create still creates one payment record'
);

update public.payments
set client_paid = true,
    client_amount_received = 1250.55,
    client_date_received = current_date
where load_id = (select id from public.loads where load_number = 'ISSUE68-ATOMIC');

select lives_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE68-ATOMIC'),
      '{
        "load_number": "ISSUE68-ATOMIC",
        "broker_id": null,
        "carrier_company": "Test Carrier",
        "driver_id": null,
        "pickup_location": "Los Angeles, CA",
        "pickup_date": null,
        "delivery_location": "Phoenix, AZ",
        "delivery_date": null,
        "is_round_trip": false,
        "return_location": null,
        "round_trip_details": null,
        "load_rate": 2000,
        "driver_pay": 500,
        "dispatcher_fee": 100,
        "fuel_cost": 50,
        "factoring_percent": 4,
        "notes": null,
        "status": "Delivered"
      }'::jsonb,
      '{
        "invoice_sent": true,
        "invoice_sent_date": null,
        "client_paid": true,
        "client_amount_received": 1250.55,
        "client_date_received": null,
        "driver_paid": false,
        "driver_amount_paid": 0,
        "driver_date_paid": null,
        "dispatcher_fee_amount": 100,
        "dispatcher_paid": false,
        "dispatcher_date_paid": null
      }'::jsonb,
      '[{"label":"Detention","amount":10}]'::jsonb
    )
  $$,
  'atomic update changes the load, payment, and deduction set together'
);

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-ATOMIC'),
  80::numeric,
  'factoring re-derives when the rate and percentage change'
);

select is(
  (select count(*) from public.load_deductions d join public.loads l on l.id = d.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  1::bigint,
  'editing replaces the prior deduction rows'
);

select is(
  (select d.label from public.load_deductions d join public.loads l on l.id = d.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  'Detention',
  'the replacement deduction stays identifiable'
);

select is(
  (select client_amount_received from public.payments p join public.loads l on l.id = p.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  1250.55::numeric,
  'deduction edits do not alter the client amount received'
);

select lives_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE68-ATOMIC'),
      '{
        "load_number": "ISSUE68-ATOMIC",
        "broker_id": null,
        "carrier_company": "Test Carrier",
        "driver_id": null,
        "pickup_location": "Los Angeles, CA",
        "pickup_date": null,
        "delivery_location": "Phoenix, AZ",
        "delivery_date": null,
        "is_round_trip": false,
        "return_location": null,
        "round_trip_details": null,
        "load_rate": 2000,
        "driver_pay": 500,
        "dispatcher_fee": 100,
        "fuel_cost": 50,
        "factoring_percent": 4,
        "notes": null,
        "status": "Delivered"
      }'::jsonb,
      '{
        "invoice_sent": true,
        "invoice_sent_date": null,
        "client_paid": true,
        "client_amount_received": 1250.55,
        "client_date_received": null,
        "driver_paid": false,
        "driver_amount_paid": 0,
        "driver_date_paid": null,
        "dispatcher_fee_amount": 100,
        "dispatcher_paid": false,
        "dispatcher_date_paid": null
      }'::jsonb,
      '[]'::jsonb
    )
  $$,
  'atomic update can remove every custom deduction'
);

select is(
  (select count(*) from public.load_deductions d join public.loads l on l.id = d.load_id where l.load_number = 'ISSUE68-ATOMIC'),
  0::bigint,
  'removing deductions leaves no stale child rows'
);

select throws_ok(
  $$update public.loads set factoring_percent = -1 where load_number = 'ISSUE68-ATOMIC'$$,
  '23514',
  null,
  'negative factoring percentages are rejected'
);

select throws_ok(
  $$update public.loads set factoring_percent = 101 where load_number = 'ISSUE68-ATOMIC'$$,
  '23514',
  null,
  'factoring percentages above 100 are rejected'
);

select throws_ok(
  $$
    insert into public.load_deductions (load_id, label, amount)
    select id, ' ', 10 from public.loads where load_number = 'ISSUE68-ATOMIC'
  $$,
  '23514',
  null,
  'blank deduction descriptions are rejected'
);

select throws_ok(
  $$
    insert into public.load_deductions (load_id, label, amount)
    select id, 'Invalid', -0.01 from public.loads where load_number = 'ISSUE68-ATOMIC'
  $$,
  '23514',
  null,
  'negative deduction amounts are rejected'
);

update public.loads
set load_rate = 100.50,
    factoring_percent = 1
where load_number = 'ISSUE68-ATOMIC';

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-ATOMIC'),
  1.01::numeric,
  'generated factoring uses half-up cent rounding'
);

insert into public.loads (
  id, load_number, pickup_location, delivery_location, status
) values (
  '68000000-0000-4000-8000-000000000010',
  'ISSUE68-TENANT-A', 'Ontario, CA', 'Reno, NV', 'Booked'
);

insert into public.load_deductions (load_id, label, amount)
values ('68000000-0000-4000-8000-000000000010', 'Tenant A fee', 15);

select set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000002","role":"authenticated","email":"issue68-b@example.com"}',
  true
);

select is(
  (select count(*) from public.load_deductions where load_id = '68000000-0000-4000-8000-000000000010'),
  0::bigint,
  'another organization cannot read a load deduction'
);

select throws_ok(
  $$
    insert into public.load_deductions (load_id, label, amount)
    values ('68000000-0000-4000-8000-000000000010', 'Cross-tenant fee', 5)
  $$,
  '23503',
  null,
  'another organization cannot attach a deduction to a foreign load'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"68000000-0000-4000-8000-000000000001","role":"authenticated","email":"issue68-a@example.com"}',
  true
);

delete from public.loads where id = '68000000-0000-4000-8000-000000000010';

reset role;

select is(
  (select count(*) from public.load_deductions where load_id = '68000000-0000-4000-8000-000000000010'),
  0::bigint,
  'deleting a load cascades to its deductions'
);

select * from finish();
rollback;

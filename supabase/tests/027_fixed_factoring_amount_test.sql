begin;

select plan(16);

select has_column('public', 'loads', 'factoring_mode', 'loads identify how factoring was entered');
select has_column('public', 'loads', 'factoring_fixed_amount', 'loads store a fixed factoring amount');
select has_function(
  'public',
  'update_load_with_payment',
  array['uuid', 'jsonb', 'jsonb']::text[],
  'the deployed three-argument load update remains available'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '69000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'issue68-fixed@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

select set_config(
  'request.jwt.claims',
  '{"sub":"69000000-0000-4000-8000-000000000001","role":"authenticated","email":"issue68-fixed@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    select public.create_load_with_deductions(
      '{
        "load_number": "ISSUE68-FIXED",
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
        "factoring_mode": "amount",
        "factoring_percent": 0,
        "factoring_fixed_amount": 85.75,
        "notes": null,
        "status": "Booked"
      }'::jsonb,
      '[]'::jsonb
    )
  $$,
  'atomic create accepts a fixed factoring amount'
);

select is(
  (select factoring_mode from public.loads where load_number = 'ISSUE68-FIXED'),
  'amount',
  'fixed factoring mode is stored'
);

select is(
  (select factoring_fixed_amount from public.loads where load_number = 'ISSUE68-FIXED'),
  85.75::numeric,
  'the entered fixed amount is stored'
);

select is(
  (select factoring_percent from public.loads where load_number = 'ISSUE68-FIXED'),
  0::numeric,
  'fixed factoring clears the inactive percentage'
);

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-FIXED'),
  85.75::numeric,
  'the generated deduction uses the fixed amount'
);

update public.loads set load_rate = 2000 where load_number = 'ISSUE68-FIXED';

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-FIXED'),
  85.75::numeric,
  'a fixed deduction does not change with the load rate'
);

select lives_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE68-FIXED'),
      '{
        "load_number": "ISSUE68-FIXED",
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
        "factoring_mode": "percentage",
        "factoring_percent": 2.5,
        "factoring_fixed_amount": 0,
        "notes": null,
        "status": "Delivered"
      }'::jsonb,
      '{
        "invoice_sent": false,
        "invoice_sent_date": null,
        "client_paid": false,
        "client_amount_received": 0,
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
  'atomic update can switch fixed factoring to percentage factoring'
);

select is(
  (select factoring_mode from public.loads where load_number = 'ISSUE68-FIXED'),
  'percentage',
  'percentage mode is stored after switching'
);

select is(
  (select factoring_percent from public.loads where load_number = 'ISSUE68-FIXED'),
  2.5::numeric,
  'the entered percentage is stored after switching'
);

select is(
  (select factoring_fixed_amount from public.loads where load_number = 'ISSUE68-FIXED'),
  0::numeric,
  'switching to percentage clears the inactive fixed amount'
);

select is(
  (select factoring_amount from public.loads where load_number = 'ISSUE68-FIXED'),
  50::numeric,
  'percentage mode derives the deduction from the load rate'
);

select throws_ok(
  $$update public.loads set factoring_mode = 'invalid' where load_number = 'ISSUE68-FIXED'$$,
  '23514',
  null,
  'unknown factoring modes are rejected'
);

select throws_ok(
  $$update public.loads set factoring_fixed_amount = -0.01 where load_number = 'ISSUE68-FIXED'$$,
  '23514',
  null,
  'negative fixed factoring amounts are rejected'
);

select * from finish();
rollback;

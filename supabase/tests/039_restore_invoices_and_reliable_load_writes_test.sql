begin;

select plan(24);

select has_column('public', 'payments', 'invoice_status', 'payments store invoice status');
select has_column('public', 'payments', 'invoice_number', 'payments store invoice number');
select has_column('public', 'payments', 'invoice_date', 'payments store invoice date');
select has_column('public', 'payments', 'payment_terms_days', 'payments store payment terms');
select has_column('public', 'payments', 'due_date', 'payments store invoice due date');
select has_function('public', 'save_load', array['uuid', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb'], 'one atomic load save function exists');
select has_function('public', 'save_invoice', array['uuid', 'text', 'text', 'date', 'integer', 'date'], 'focused invoice save function exists');
select is(to_regclass('public.receivable_entries'), null::regclass, 'receivable ledger remains removed');
select is(to_regclass('public.collection_contacts'), null::regclass, 'collection contacts remain removed');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '39000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'invoice-repair@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Invoice Repair Test"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated","email":"invoice-repair@example.com"}', true);
set local role authenticated;

select lives_ok(
  $$select public.save_load(
    null,
    '{"load_number":"INVOICE-LOAD-39","pickup_location":"Legacy A","delivery_location":"Legacy B","status":"Booked","load_rate":1600,"driver_pay":700,"dispatcher_fee":80,"fuel_cost":200,"factoring_mode":"percentage","factoring_percent":3,"factoring_fixed_amount":0,"commodity":"Produce","weight_lbs":42000,"pallet_count":24,"special_instructions":"Keep cool"}'::jsonb,
    null,
    '[{"label":"Lumper","amount":50}]'::jsonb,
    '[{"stop_type":"Pickup","location":"Los Angeles, CA","scheduled_start":"2026-09-04T09:00","scheduled_end":"2026-09-04T10:00","schedule_precision":"window","time_zone":"America/Los_Angeles"},{"stop_type":"Delivery","location":"Phoenix, AZ","scheduled_start":"2026-09-05T13:00","scheduled_end":"2026-09-05T14:00","schedule_precision":"window","time_zone":"America/Phoenix"}]'::jsonb,
    '{"driver_pay_known":true,"dispatcher_fee_known":true,"fuel_cost_known":true}'::jsonb
  )$$,
  'a load and all dependent records save atomically'
);

select is((select count(*) from public.loads where load_number = 'INVOICE-LOAD-39'), 1::bigint, 'load is created once');
select is((select pickup_location from public.loads where load_number = 'INVOICE-LOAD-39'), 'Los Angeles, CA', 'pickup is synchronized from structured stops');
select is((select count(*) from public.load_stops where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 2::bigint, 'both stops are saved');
select is((select count(*) from public.load_deductions where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 1::bigint, 'deductions are saved');
select ok((select driver_pay_known and dispatcher_fee_known and fuel_cost_known from public.loads where load_number = 'INVOICE-LOAD-39'), 'financial completeness is saved');

update public.payments
set client_paid = true, client_amount_received = 1600
where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39');

select lives_ok(
  $$select public.save_invoice(
    (select id from public.loads where load_number = 'INVOICE-LOAD-39'),
    'Sent', 'INV-39', '2026-09-04'::date, 30, null
  )$$,
  'an invoice can be created for the saved load'
);

select is((select invoice_status from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 'Sent', 'invoice status is saved');
select is((select due_date from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), '2026-10-04'::date, 'due date is derived from terms');
select ok((select invoice_sent from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 'legacy invoice reporting stays synchronized');

select lives_ok(
  $$select public.save_load(
    (select id from public.loads where load_number = 'INVOICE-LOAD-39'),
    '{"load_number":"INVOICE-LOAD-39","pickup_location":"Los Angeles, CA","delivery_location":"Phoenix, AZ","status":"Delivered","load_rate":1600,"driver_pay":700,"dispatcher_fee":80,"fuel_cost":200,"factoring_mode":"percentage","factoring_percent":3,"factoring_fixed_amount":0,"commodity":"Produce","weight_lbs":42000,"pallet_count":24,"special_instructions":"Keep cool"}'::jsonb,
    '{"driver_paid":true,"driver_amount_paid":700,"driver_date_paid":"2026-09-06","dispatcher_fee_amount":80,"dispatcher_paid":false}'::jsonb,
    '[{"label":"Lumper","amount":50}]'::jsonb,
    '[{"stop_type":"Pickup","location":"Los Angeles, CA","scheduled_start":"2026-09-04T09:00","scheduled_end":"2026-09-04T10:00","schedule_precision":"window","time_zone":"America/Los_Angeles"},{"stop_type":"Delivery","location":"Phoenix, AZ","scheduled_start":"2026-09-05T13:00","scheduled_end":"2026-09-05T14:00","schedule_precision":"window","time_zone":"America/Phoenix"}]'::jsonb,
    '{"driver_pay_known":true,"dispatcher_fee_known":true,"fuel_cost_known":true}'::jsonb
  )$$,
  'editing a load preserves fields owned by the invoice workflow'
);

select is((select invoice_number from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 'INV-39', 'load edits preserve invoice number');
select ok((select client_paid from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 'load edits preserve omitted client payment state');
select ok((select driver_paid from public.payments where load_id = (select id from public.loads where load_number = 'INVOICE-LOAD-39')), 'load edits still update supplied payment state');

select throws_ok(
  $$select public.save_invoice((select id from public.loads where load_number = 'INVOICE-LOAD-39'), 'Sent', '', null, 30, null)$$,
  '22023',
  'Sent invoices require an invoice number and invoice date',
  'sent invoices require their identifying details'
);

reset role;
select * from finish();
rollback;

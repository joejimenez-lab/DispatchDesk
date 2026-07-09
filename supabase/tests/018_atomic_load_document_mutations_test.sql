begin;

select plan(18);

select has_table('public', 'storage_cleanup_jobs', 'storage cleanup queue exists');
select has_column('public', 'storage_cleanup_jobs', 'storage_path', 'cleanup jobs keep the object path');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000022',
  'authenticated', 'authenticated', 'issue22-test@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000022","role":"authenticated","email":"issue22-test@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$
    insert into public.loads (
      load_number, pickup_location, delivery_location, load_rate, driver_pay, dispatcher_fee, fuel_cost, status
    ) values (
      'ISSUE22-ORIGINAL', 'Los Angeles, CA', 'Phoenix, AZ', 900, 450, 90, 40, 'Booked'
    )
  $$,
  'authenticated user can create the atomic update test load'
);

select throws_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE22-ORIGINAL'),
      '{
        "load_number": "ISSUE22-CHANGED",
        "broker_id": null,
        "carrier_company": "Rollback Carrier",
        "driver_id": null,
        "pickup_location": "Los Angeles, CA",
        "pickup_date": null,
        "delivery_location": "Phoenix, AZ",
        "delivery_date": null,
        "is_round_trip": false,
        "return_location": null,
        "round_trip_details": null,
        "load_rate": 1000,
        "driver_pay": 500,
        "dispatcher_fee": 100,
        "fuel_cost": 50,
        "notes": null,
        "status": "Delivered"
      }'::jsonb,
      '{
        "invoice_sent": true,
        "invoice_sent_date": null,
        "client_paid": true,
        "client_amount_received": -1,
        "client_date_received": null,
        "driver_paid": false,
        "driver_amount_paid": 0,
        "driver_date_paid": null,
        "dispatcher_fee_amount": 100,
        "dispatcher_paid": false,
        "dispatcher_date_paid": null
      }'::jsonb
    )
  $$,
  '23514',
  null,
  'payment check failure aborts the coupled RPC'
);

select is(
  (select load_number from public.loads where load_number = 'ISSUE22-ORIGINAL'),
  'ISSUE22-ORIGINAL',
  'load changes roll back when payment persistence fails'
);

select lives_ok(
  $$
    select public.update_load_with_payment(
      (select id from public.loads where load_number = 'ISSUE22-ORIGINAL'),
      '{
        "load_number": "ISSUE22-UPDATED",
        "broker_id": null,
        "carrier_company": "Updated Carrier",
        "driver_id": null,
        "pickup_location": "Los Angeles, CA",
        "pickup_date": null,
        "delivery_location": "Phoenix, AZ",
        "delivery_date": null,
        "is_round_trip": false,
        "return_location": null,
        "round_trip_details": null,
        "load_rate": 1000,
        "driver_pay": 500,
        "dispatcher_fee": 100,
        "fuel_cost": 50,
        "notes": null,
        "status": "Delivered"
      }'::jsonb,
      '{
        "invoice_sent": true,
        "invoice_sent_date": null,
        "client_paid": true,
        "client_amount_received": 1000,
        "client_date_received": null,
        "driver_paid": false,
        "driver_amount_paid": 0,
        "driver_date_paid": null,
        "dispatcher_fee_amount": 100,
        "dispatcher_paid": false,
        "dispatcher_date_paid": null
      }'::jsonb
    )
  $$,
  'valid load, payment, and activity updates commit together'
);

select is(
  (select load_number from public.loads where load_number = 'ISSUE22-UPDATED'),
  'ISSUE22-UPDATED',
  'successful RPC updates the load'
);

select is(
  (select client_amount_received from public.payments p join public.loads l on l.id = p.load_id where l.load_number = 'ISSUE22-UPDATED'),
  1000::numeric,
  'successful RPC updates the payment'
);

select is(
  (select count(*) from public.activity_logs a join public.loads l on l.id = a.load_id where l.load_number = 'ISSUE22-UPDATED' and a.action = 'Load and payment details updated'),
  1::bigint,
  'successful RPC writes the activity log'
);

insert into public.documents (load_id, file_name, category, storage_path)
select id, 'bol.pdf', 'BOL', 'issue22/document-bol.pdf'
from public.loads
where load_number = 'ISSUE22-UPDATED';

select is(
  (select count(*) from public.delete_document_with_cleanup(
    (select id from public.documents where storage_path = 'issue22/document-bol.pdf')
  )),
  1::bigint,
  'document delete returns one queued cleanup job'
);

select is(
  (select count(*) from public.documents where storage_path = 'issue22/document-bol.pdf'),
  0::bigint,
  'document metadata is deleted by the RPC'
);

select is(
  (select count(*) from public.storage_cleanup_jobs where storage_path = 'issue22/document-bol.pdf' and source = 'delete_document'),
  1::bigint,
  'document storage cleanup remains queued until Storage succeeds'
);

select is(
  (select count(*) from public.activity_logs a join public.loads l on l.id = a.load_id where l.load_number = 'ISSUE22-UPDATED' and a.action = 'Document deleted'),
  1::bigint,
  'document delete writes the activity log in the database transaction'
);

insert into public.loads (
  load_number, pickup_location, delivery_location, load_rate, driver_pay, dispatcher_fee, fuel_cost, status
) values (
  'ISSUE22-DELETE-LOAD', 'Fresno, CA', 'Reno, NV', 800, 400, 80, 20, 'Booked'
);

insert into public.documents (load_id, file_name, category, storage_path)
select id, 'invoice.pdf', 'Invoice', 'issue22/load-invoice.pdf'
from public.loads
where load_number = 'ISSUE22-DELETE-LOAD';

insert into public.documents (load_id, file_name, category, storage_path)
select id, 'rate-confirmation.pdf', 'Rate Confirmation', 'issue22/load-rate-confirmation.pdf'
from public.loads
where load_number = 'ISSUE22-DELETE-LOAD';

select is(
  (select count(*) from public.delete_load_with_document_cleanup(
    (select id from public.loads where load_number = 'ISSUE22-DELETE-LOAD')
  )),
  2::bigint,
  'load delete returns all queued document cleanup jobs'
);

select is(
  (select count(*) from public.loads where load_number = 'ISSUE22-DELETE-LOAD'),
  0::bigint,
  'load metadata is deleted by the RPC'
);

select is(
  (select count(*) from public.documents where storage_path like 'issue22/load-%'),
  0::bigint,
  'load document metadata is cascade-deleted by the RPC'
);

select is(
  (select count(*) from public.storage_cleanup_jobs where storage_path like 'issue22/load-%' and source = 'delete_load'),
  2::bigint,
  'load document storage cleanup remains queued until Storage succeeds'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.update_load_with_payment(null, '{}'::jsonb, '{}'::jsonb)$$,
  '42501',
  null,
  'anonymous users cannot execute atomic load updates'
);

reset role;
select * from finish();
rollback;

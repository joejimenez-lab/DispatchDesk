begin;

select plan(52);

select has_column('public', 'payments', 'invoice_date', 'payments have invoice dates');
select has_column('public', 'payments', 'due_date', 'payments have due dates');
select has_column('public', 'payments', 'collection_owner_id', 'payments have collection owners');
select has_table('public', 'receivable_entries', 'receivable ledger exists');
select has_table('public', 'collection_contacts', 'contact history exists');
select has_function('public', 'record_receivable_entry', array['uuid','text','numeric','date','text'], 'ledger mutation is exposed');
select has_function('public', 'update_invoice_collection', array['uuid','text','text','date','integer','date','uuid','date'], 'invoice mutation is exposed');
select has_function('public', 'collection_owner_options', array[]::text[], 'tenant owner options exist');

select is(public.invoice_aging_bucket('2026-08-31', '2026-08-31'), 'Current', 'due date is current, not overdue');
select is(public.invoice_aging_bucket('2026-08-30', '2026-08-31'), '1–30', 'one day late starts 1–30');
select is(public.invoice_aging_bucket('2026-08-01', '2026-08-31'), '1–30', '30 days late stays 1–30');
select is(public.invoice_aging_bucket('2026-07-31', '2026-08-31'), '31–60', '31 days late starts 31–60');
select is(public.invoice_aging_bucket('2026-07-02', '2026-08-31'), '31–60', '60 days late stays 31–60');
select is(public.invoice_aging_bucket('2026-07-01', '2026-08-31'), '61–90', '61 days late starts 61–90');
select is(public.invoice_aging_bucket('2026-06-02', '2026-08-31'), '61–90', '90 days late stays 61–90');
select is(public.invoice_aging_bucket('2026-06-01', '2026-08-31'), '90+', '91 days late starts 90+');
select is(public.invoice_aging_bucket(null, '2026-08-31'), 'Current', 'uninvoiced receivables reconcile in Current');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
('00000000-0000-0000-0000-000000000000','35000000-0000-4000-8000-000000000001','authenticated','authenticated','collections-one@example.com','',now(),'{}','{"company_name":"Collections One"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','35000000-0000-4000-8000-000000000002','authenticated','authenticated','collections-two@example.com','',now(),'{}','{"company_name":"Collections Two"}',now(),now(),'','','','');

select set_config('request.jwt.claims', '{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated","email":"collections-one@example.com"}', true);
set local role authenticated;

select is((select count(*) from public.collection_owner_options()), 1::bigint, 'owner options include organization members');

insert into public.loads(id, load_number, pickup_location, delivery_location, status, load_rate)
values ('35000000-0000-4000-8000-000000000010','COLLECT-1','Los Angeles, CA','Phoenix, AZ','Delivered',1000);

select lives_ok(
  $$select public.update_invoice_collection('35000000-0000-4000-8000-000000000010','Sent','INV-100','2026-07-01',30,null,'35000000-0000-4000-8000-000000000001','2026-08-05')$$,
  'invoice and collection details save'
);
select is((select due_date from public.payments where load_id='35000000-0000-4000-8000-000000000010'), '2026-07-31'::date, 'terms calculate a due date');
select is((select invoice_sent from public.payments where load_id='35000000-0000-4000-8000-000000000010'), true, 'sent status synchronizes legacy invoice fact');
select is(public.receivable_balance('35000000-0000-4000-8000-000000000010'), 1000::numeric, 'new invoice starts fully outstanding');
select throws_ok(
  $$select public.update_invoice_collection('35000000-0000-4000-8000-000000000010','Void','INV-100','2026-07-01',30,null,'35000000-0000-4000-8000-000000000001','2026-08-05')$$,
  '22023','Reconcile the outstanding balance before voiding the invoice','an outstanding invoice cannot be voided without reconciliation'
);

select lives_ok($$select public.record_receivable_entry('35000000-0000-4000-8000-000000000010','Payment',400,'2026-08-01','ACH 123')$$, 'partial payment records');
select is(public.receivable_balance('35000000-0000-4000-8000-000000000010'), 600::numeric, 'partial payment reduces outstanding');
select is((select client_amount_received from public.payments where load_id='35000000-0000-4000-8000-000000000010'), 400::numeric, 'legacy payment aggregate stays synchronized');
select is((select client_paid from public.payments where load_id='35000000-0000-4000-8000-000000000010'), false, 'partial payment remains unpaid');

select lives_ok($$select public.record_receivable_entry('35000000-0000-4000-8000-000000000010','Adjustment',100,'2026-08-02','Detention')$$, 'positive adjustment adds to receivable');
select is(public.receivable_balance('35000000-0000-4000-8000-000000000010'), 700::numeric, 'positive adjustment increases outstanding');
select lives_ok($$select public.record_receivable_entry('35000000-0000-4000-8000-000000000010','Credit',50,'2026-08-03','Service credit')$$, 'credit records');
select is(public.receivable_balance('35000000-0000-4000-8000-000000000010'), 650::numeric, 'credit reduces outstanding');
select lives_ok($$select public.record_receivable_entry('35000000-0000-4000-8000-000000000010','Write-off',650,'2026-08-04','Approved residual write-off')$$, 'residual write-off records');
select is(public.receivable_balance('35000000-0000-4000-8000-000000000010'), 0::numeric, 'write-off reconciles balance');
select is((select client_paid from public.payments where load_id='35000000-0000-4000-8000-000000000010'), true, 'reconciled invoice is marked paid');
select is((select count(*) from public.receivable_entries where load_id='35000000-0000-4000-8000-000000000010'), 4::bigint, 'ledger retains every financial entry');
select ok((select count(*) from public.activity_logs where load_id='35000000-0000-4000-8000-000000000010' and action like '%recorded:%') = 4, 'financial entries are logged');
select lives_ok(
  $$select public.update_load_with_payment(
    '35000000-0000-4000-8000-000000000010',
    '{"load_number":"COLLECT-1","broker_id":"","carrier_company":"","driver_id":"","fleet_company":"","truck_unit_id":"","trailer_unit_id":"","pickup_location":"Los Angeles, CA","pickup_date":"","delivery_location":"Phoenix, AZ","delivery_date":"","is_round_trip":false,"return_location":"","round_trip_details":"","load_rate":1000,"driver_pay":0,"dispatcher_fee":0,"fuel_cost":0,"factoring_mode":"percentage","factoring_percent":0,"factoring_fixed_amount":0,"notes":"","status":"Delivered"}'::jsonb,
    '{"invoice_sent":false,"client_paid":false,"client_amount_received":0,"driver_paid":true,"driver_amount_paid":100,"dispatcher_fee_amount":0,"dispatcher_paid":false}'::jsonb,
    '[]'::jsonb
  )$$,
  'load edit accepts operational payment updates without rewriting collections'
);
select is((select invoice_sent from public.payments where load_id='35000000-0000-4000-8000-000000000010'), true, 'stale load edit cannot clear invoice state');
select is((select client_amount_received from public.payments where load_id='35000000-0000-4000-8000-000000000010'), 400::numeric, 'stale load edit cannot clear ledger payment total');
select is((select client_paid from public.payments where load_id='35000000-0000-4000-8000-000000000010'), true, 'stale load edit cannot clear reconciled state');
select is((select driver_paid from public.payments where load_id='35000000-0000-4000-8000-000000000010'), true, 'load edit still updates driver disbursement state');
select lives_ok(
  $$select public.update_invoice_collection('35000000-0000-4000-8000-000000000010','Void','INV-100','2026-07-01',30,'2026-07-31','35000000-0000-4000-8000-000000000001','2026-08-05')$$,
  'a reconciled invoice can be voided'
);
select is((select invoice_status from public.payments where load_id='35000000-0000-4000-8000-000000000010'), 'Void'::public.invoice_status, 'void status is retained');
select is((select due_date from public.payments where load_id='35000000-0000-4000-8000-000000000010'), null::date, 'void invoices have no active due date');
select is((select next_follow_up_date from public.payments where load_id='35000000-0000-4000-8000-000000000010'), null::date, 'void invoices have no active follow-up');
select throws_ok(
  $$select public.record_receivable_entry('35000000-0000-4000-8000-000000000010','Adjustment',25,'2026-08-05','Late fee')$$,
  '22023','Cannot record entries against a void invoice','void invoices reject new ledger entries'
);
select lives_ok($$select public.record_collection_contact('35000000-0000-4000-8000-000000000010','Phone','2026-08-04 12:00+00','Promised payment','2026-08-07')$$, 'collection contact records');
select is((select count(*) from public.collection_contacts where load_id='35000000-0000-4000-8000-000000000010'), 1::bigint, 'contact history is retained');
select is((select next_follow_up_date from public.payments where load_id='35000000-0000-4000-8000-000000000010'), null::date, 'contact notes cannot reactivate follow-up for a void invoice');

select set_config('test.collections_load_id','35000000-0000-4000-8000-000000000010',true);
reset role;
select set_config('request.jwt.claims', '{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated","email":"collections-two@example.com"}', true);
set local role authenticated;
select is((select count(*) from public.receivable_entries where load_id=current_setting('test.collections_load_id')::uuid), 0::bigint, 'another organization cannot read ledger entries');
select throws_ok(
  $$select public.record_receivable_entry(current_setting('test.collections_load_id')::uuid,'Payment',1,current_date,'cross tenant')$$,
  'P0002','Load not found','another organization cannot mutate the ledger'
);
select is((select count(*) from public.collection_contacts where load_id=current_setting('test.collections_load_id')::uuid), 0::bigint, 'another organization cannot read contact history');

reset role;
select * from finish();
rollback;

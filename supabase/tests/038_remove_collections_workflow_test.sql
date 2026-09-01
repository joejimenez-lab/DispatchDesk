begin;

select plan(9);

select is(to_regclass('public.receivable_entries'), null::regclass, 'receivable ledger table is removed');
select is(to_regclass('public.collection_contacts'), null::regclass, 'collection contacts table is removed');
select is(to_regtype('public.invoice_status'), null::regtype, 'invoice status type is removed');
select is(
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'invoice_status'),
  0::bigint,
  'collection invoice fields are removed'
);
select is(
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'next_follow_up_date'),
  0::bigint,
  'collection follow-up fields are removed'
);
select has_view('public', 'load_list_index', 'load pagination view remains available');
select has_function(
  'public',
  'update_load_with_payment',
  array['uuid', 'jsonb', 'jsonb', 'jsonb'],
  'the original load and payment update function remains available'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '38000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'rollback@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Rollback Test"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"38000000-0000-4000-8000-000000000001","role":"authenticated","email":"rollback@example.com"}', true);
set local role authenticated;

insert into public.loads (id, load_number, pickup_location, delivery_location, status, load_rate)
values ('38000000-0000-4000-8000-000000000010', 'ROLLBACK-PAID', 'Fresno, CA', 'Reno, NV', 'Delivered', 1200);

update public.payments
set client_paid = true, client_amount_received = 1200
where load_id = '38000000-0000-4000-8000-000000000010';

select is(
  (select client_paid from public.load_list_index where id = '38000000-0000-4000-8000-000000000010'),
  true,
  'pagination reads paid state from the original payment summary'
);

update public.payments
set client_paid = false, client_amount_received = 0
where load_id = '38000000-0000-4000-8000-000000000010';

select is(
  (select client_paid from public.load_list_index where id = '38000000-0000-4000-8000-000000000010'),
  false,
  'pagination reads unpaid state from the original payment summary'
);

reset role;
select * from finish();
rollback;

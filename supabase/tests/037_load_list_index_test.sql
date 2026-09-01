begin;

select plan(8);

select has_view('public', 'load_list_index', 'load list pagination view exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '37000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'index-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Index One"}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '37000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'index-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Index Two"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"37000000-0000-4000-8000-000000000001","role":"authenticated","email":"index-one@example.com"}', true);
set local role authenticated;

insert into public.brokers (id, company_name, contact_name)
values ('37000000-0000-4000-8000-000000000010', 'Blue Horizon Logistics', 'Morgan Lane');
insert into public.drivers (id, name, truck_number, trailer_number)
values ('37000000-0000-4000-8000-000000000011', 'Riley North', 'TRK-370', 'TRL-370');
insert into public.loads (
  id, load_number, broker_id, driver_id, pickup_location, delivery_location,
  delivery_date, status, load_rate, driver_pay_known, dispatcher_fee_known, fuel_cost_known
) values (
  '37000000-0000-4000-8000-000000000020', 'INDEX-PAID',
  '37000000-0000-4000-8000-000000000010', '37000000-0000-4000-8000-000000000011',
  'Los Angeles, CA', 'Phoenix, AZ', '2026-09-01', 'Delivered', 1000, true, true, true
);
select public.record_receivable_entry(
  '37000000-0000-4000-8000-000000000020',
  'Write-off',
  1000,
  '2026-09-01',
  'Ledger-based pagination test'
);
-- Deliberately stale the cached summary to verify the index uses the immutable ledger.
update public.payments
set client_paid = false, client_amount_received = 0
where load_id = '37000000-0000-4000-8000-000000000020';
insert into public.load_stops (load_id, position, stop_type, location, reference_number)
values ('37000000-0000-4000-8000-000000000020', 2, 'Intermediate', 'Needles, CA', 'STOP-REF-370');

select is((select client_paid from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), true, 'receivable ledger reconciliation marks the indexed load paid');
select ok((select search_text ilike '%Blue Horizon%' from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), 'broker text is searchable');
select ok((select search_text ilike '%Riley North%' from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), 'driver text is searchable');
select ok((select search_text ilike '%TRK-370%' from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), 'equipment text is searchable');
select ok((select search_text ilike '%STOP-REF-370%' from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), 'structured stop text is searchable');

update public.payments
set invoice_status = 'Void'
where load_id = '37000000-0000-4000-8000-000000000020';
select is((select client_paid from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), null::boolean, 'void invoices are excluded from paid and unpaid filters');

reset role;
select set_config('request.jwt.claims', '{"sub":"37000000-0000-4000-8000-000000000002","role":"authenticated","email":"index-two@example.com"}', true);
set local role authenticated;
select is((select count(*) from public.load_list_index where id = '37000000-0000-4000-8000-000000000020'), 0::bigint, 'security-invoker view preserves tenant isolation');

reset role;
select * from finish();
rollback;

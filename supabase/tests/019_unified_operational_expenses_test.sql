begin;

select plan(49);

select has_table('public', 'bookkeeping_expense_groups', 'bookkeeping transaction headers exist');
select has_column('public', 'bookkeeping_expenses', 'group_id', 'expense lines belong to a transaction');
select has_column('public', 'bookkeeping_receipts', 'group_id', 'receipts belong to a transaction rather than one line');
select has_column('public', 'inspection_records', 'cost', 'inspection cost is persisted');
select col_is_fk('public', 'ifta_fuel_purchases', 'unit_id', 'IFTA fuel purchases use an unambiguous fleet unit');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000047',
  'authenticated', 'authenticated', 'issue47-test@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000047","role":"authenticated","email":"issue47-test@example.com"}', true);
set local role authenticated;

insert into public.fleet_units (id, unit_number, unit_type, odometer)
values
  ('47000000-0000-4000-8000-000000000001', 'ISSUE-47-TRUCK', 'Truck', 100000),
  ('47000000-0000-4000-8000-000000000002', 'ISSUE-47-TRUCK-2', 'Truck', 90000);

insert into public.maintenance_reminders (id, unit_id, reminder_type, due_odometer, interval_miles)
values ('47000000-0000-4000-8000-000000000010', '47000000-0000-4000-8000-000000000001', 'Oil change', 101000, 5000);

select lives_ok(
  $$select public.complete_maintenance_with_expense(
    '47000000-0000-4000-8000-000000000010', current_date, 101000, 'Oil and filters',
    'breakdown', 0, 180, 70, 'Quality Shop', '47000000-0000-4000-8000-000000000020',
    '{"file_name":"oil.pdf","storage_path":"issue47/oil.pdf","content_type":"application/pdf","file_size":100}'::jsonb
  )$$,
  'maintenance completion atomically creates history, expense lines, receipt, and recurrence'
);

select is((select count(*) from public.bookkeeping_expense_groups where source_type = 'maintenance'), 1::bigint, 'one maintenance transaction is created');
select is((select count(*) from public.bookkeeping_expenses where group_id = '47000000-0000-4000-8000-000000000020'), 2::bigint, 'labor and parts are separate lines');
select is((select sum(amount) from public.bookkeeping_expenses where group_id = '47000000-0000-4000-8000-000000000020'), 250::numeric, 'breakdown lines equal maintenance total');
select is((select count(*) from public.bookkeeping_receipts where group_id = '47000000-0000-4000-8000-000000000020'), 1::bigint, 'one receipt covers the transaction');
select is((select cost from public.service_records where description = 'Oil change'), 250::numeric, 'service history reflects the ledger total');
select is((select due_odometer from public.maintenance_reminders where reminder_type = 'Oil change' and completed_at is null), 106000, 'recurrence still schedules from completion mileage');

select throws_ok(
  $$insert into public.bookkeeping_expense_groups (
    id, expense_date, unit_id, source_type, source_id, service_record_id
  ) select
    '47000000-0000-4000-8000-000000000024', current_date, unit_id, 'maintenance', id, id
  from public.service_records where description = 'Oil change'$$,
  '23505', null, 'the database unique source link blocks concurrent duplicate transactions'
);

select lives_ok(
  $$select public.update_bookkeeping_expense_group(
    '47000000-0000-4000-8000-000000000020',
    jsonb_build_object('expense_date', current_date, 'vendor', 'Quality Shop', 'notes', 'Moved to corrected unit', 'unit_id', '47000000-0000-4000-8000-000000000002', 'load_id', null, 'driver_id', null),
    '[{"category":"Maintenance","amount":180,"line_type":"labor"},{"category":"Parts","amount":70,"line_type":"parts"}]'::jsonb
  )$$,
  'Bookkeeping can edit maintenance spending and its source together'
);
select is((select unit_id from public.service_records where description = 'Oil change'), '47000000-0000-4000-8000-000000000002'::uuid, 'Bookkeeping unit correction synchronizes the maintenance source');

select lives_ok(
  $$select public.complete_maintenance_with_expense(
    '47000000-0000-4000-8000-000000000010', current_date, 101000, null,
    'breakdown', 0, 180, 70, 'Quality Shop', '47000000-0000-4000-8000-000000000020',
    '{"file_name":"oil.pdf","storage_path":"issue47/oil.pdf","content_type":"application/pdf","file_size":100}'::jsonb
  )$$,
  'retry returns the completed maintenance transaction without duplicating it'
);

insert into public.maintenance_reminders (id, unit_id, reminder_type, due_date)
values ('47000000-0000-4000-8000-000000000011', '47000000-0000-4000-8000-000000000001', 'Annual inspection', current_date);
select lives_ok(
  $$select public.complete_maintenance_with_expense(
    '47000000-0000-4000-8000-000000000011', current_date, 101000, 'Annual inspection',
    'total', 145, 0, 0, 'Inspection Center', '47000000-0000-4000-8000-000000000022', null
  )$$,
  'inspection completion accepts and persists spending'
);
select is((select cost from public.inspection_records where notes = 'Annual inspection'), 145::numeric, 'inspection cost is no longer discarded');

insert into public.maintenance_reminders (id, unit_id, reminder_type, due_date)
values ('47000000-0000-4000-8000-000000000012', '47000000-0000-4000-8000-000000000001', 'Repair follow-up', current_date);
select lives_ok(
  $$select public.complete_maintenance_with_expense(
    '47000000-0000-4000-8000-000000000012', current_date, 101000, 'Checked only',
    'total', 0, 0, 0, null, '47000000-0000-4000-8000-000000000023', null
  )$$,
  'zero-cost maintenance completes without a financial transaction'
);
select is((select count(*) from public.bookkeeping_expense_groups where id = '47000000-0000-4000-8000-000000000023'), 0::bigint, 'zero-cost completion creates no expense');

insert into public.fleet_units (id, unit_number, unit_type)
values ('47000000-0000-4000-8000-000000000003', 'ROLLBACK-TRAILER', 'Trailer');
insert into public.maintenance_reminders (id, unit_id, reminder_type, due_date, interval_miles)
values ('47000000-0000-4000-8000-000000000013', '47000000-0000-4000-8000-000000000003', 'Repair follow-up', current_date, 1000);
select throws_ok(
  $$select public.complete_maintenance_with_expense(
    '47000000-0000-4000-8000-000000000013', current_date, null, 'Must roll back',
    'total', 200, 0, 0, 'Repair Shop', '47000000-0000-4000-8000-000000000025', null
  )$$,
  '22023', null, 'a recurrence validation failure aborts the whole completion transaction'
);
select is((select count(*) from public.repair_logs where description = 'Repair follow-up completed' and unit_id = '47000000-0000-4000-8000-000000000003'), 0::bigint, 'failed completion rolls back maintenance history');
select is((select count(*) from public.bookkeeping_expense_groups where id = '47000000-0000-4000-8000-000000000025'), 0::bigint, 'failed completion rolls back Bookkeeping data');
select is((select count(*) from public.maintenance_reminders where id = '47000000-0000-4000-8000-000000000013' and completed_at is null), 1::bigint, 'failed completion keeps the reminder active');

select lives_ok(
  $$select public.save_ifta_fuel_purchase_with_expense(
    '47000000-0000-4000-8000-000000000030', '47000000-0000-4000-8000-000000000031',
    '{"unit_id":"47000000-0000-4000-8000-000000000001","purchase_date":"2026-07-13","city":"Reno","state":"NV","gallons":100,"amount_paid":425,"vendor":"Fuel Stop","notes":"Card"}'::jsonb,
    null
  )$$,
  'IFTA fuel entry atomically creates its Fuel expense'
);
select is((select category::text from public.bookkeeping_expenses where group_id = '47000000-0000-4000-8000-000000000031'), 'Fuel', 'IFTA creates a Fuel line');
select is((select truck_number from public.ifta_fuel_purchases where id = '47000000-0000-4000-8000-000000000030'), 'ISSUE-47-TRUCK', 'IFTA derives the report truck number from the fleet unit');

select lives_ok(
  $$select public.save_ifta_fuel_purchase_with_expense(
    '47000000-0000-4000-8000-000000000030', '47000000-0000-4000-8000-000000000099',
    '{"unit_id":"47000000-0000-4000-8000-000000000001","purchase_date":"2026-07-14","city":"Reno","state":"NV","gallons":101,"amount_paid":430,"vendor":"Fuel Stop","notes":"Updated"}'::jsonb,
    null
  )$$,
  'IFTA edit updates the existing transaction'
);
select is((select count(*) from public.bookkeeping_expense_groups where ifta_fuel_purchase_id = '47000000-0000-4000-8000-000000000030'), 1::bigint, 'IFTA retry/edit cannot duplicate the transaction');
select is((select amount from public.bookkeeping_expenses where group_id = '47000000-0000-4000-8000-000000000031'), 430::numeric, 'IFTA edit synchronizes Bookkeeping amount');

select lives_ok(
  $$select public.update_bookkeeping_expense_group(
    '47000000-0000-4000-8000-000000000031',
    '{"expense_date":"2026-07-15","vendor":"Updated Fuel","notes":"Ledger edit","unit_id":"47000000-0000-4000-8000-000000000001","load_id":null,"driver_id":null}'::jsonb,
    '[{"category":"Fuel","amount":440,"line_type":"total"}]'::jsonb
  )$$,
  'editing Bookkeeping synchronizes its IFTA source'
);
select is((select amount_paid from public.ifta_fuel_purchases where id = '47000000-0000-4000-8000-000000000030'), 440::numeric, 'Bookkeeping amount becomes the IFTA amount');

select lives_ok(
  $$select public.create_manual_bookkeeping_expense(
    '47000000-0000-4000-8000-000000000050',
    '{"expense_date":"2026-06-10","category":"Supplies","amount":123,"vendor":"Supply House","notes":"Paper","unit_id":"47000000-0000-4000-8000-000000000001","load_id":null,"driver_id":null,"maintenance_table":null,"maintenance_id":null}'::jsonb,
    null
  )$$,
  'manual Bookkeeping expense creation remains supported'
);
select is((select count(*) from public.bookkeeping_expense_groups where id = '47000000-0000-4000-8000-000000000050' and source_type = 'manual'), 1::bigint, 'manual expense has one transaction header');
select is((select amount from public.bookkeeping_expenses where group_id = '47000000-0000-4000-8000-000000000050'), 123::numeric, 'manual expense has one ledger line');

select throws_ok(
  $$select public.queue_bookkeeping_group_delete('47000000-0000-4000-8000-000000000020')$$,
  '23514', null, 'source-linked maintenance spending cannot be deleted from Bookkeeping'
);

select lives_ok(
  $$select public.queue_bookkeeping_receipt_delete(
    (select id from public.bookkeeping_receipts where group_id = '47000000-0000-4000-8000-000000000020')
  )$$,
  'receipt metadata deletion atomically queues object cleanup'
);
select is((select count(*) from public.bookkeeping_receipts where group_id = '47000000-0000-4000-8000-000000000020'), 0::bigint, 'deleted receipt metadata is gone');
select is((select count(*) from public.storage_cleanup_jobs where expense_group_id = '47000000-0000-4000-8000-000000000020' and storage_path = 'issue47/oil.pdf'), 1::bigint, 'deleted receipt object is queued exactly once');

insert into public.service_records (id, unit_id, service_date, description, cost)
values ('47000000-0000-4000-8000-000000000040', '47000000-0000-4000-8000-000000000001', current_date, 'Manual history', 99);
select is((select count(*) from public.bookkeeping_expense_groups where service_record_id = '47000000-0000-4000-8000-000000000040'), 1::bigint, 'manual positive-cost history is automatically linked once');

select set_config('dispatchdesk.skip_maintenance_expense_trigger', 'true', true);
insert into public.repair_logs (id, unit_id, repair_date, description, cost)
values ('47000000-0000-4000-8000-000000000041', '47000000-0000-4000-8000-000000000001', current_date, 'Legacy unlinked repair', 88);
insert into public.service_records (id, unit_id, service_date, description, cost)
values ('47000000-0000-4000-8000-000000000042', '47000000-0000-4000-8000-000000000001', '2026-06-01', 'Legacy safely matched service', 77);
insert into public.repair_logs (id, unit_id, repair_date, description, cost)
values ('47000000-0000-4000-8000-000000000043', '47000000-0000-4000-8000-000000000001', '2026-06-02', 'Legacy ambiguous repair', 66);
select set_config('dispatchdesk.skip_maintenance_expense_trigger', 'false', true);

insert into public.bookkeeping_expense_groups (id, expense_date, unit_id, source_type)
values
  ('47000000-0000-4000-8000-000000000060', '2026-06-01', '47000000-0000-4000-8000-000000000001', 'manual'),
  ('47000000-0000-4000-8000-000000000061', '2026-06-02', '47000000-0000-4000-8000-000000000001', 'manual'),
  ('47000000-0000-4000-8000-000000000062', '2026-06-02', '47000000-0000-4000-8000-000000000001', 'manual');
insert into public.bookkeeping_expenses (group_id, category, amount, line_type)
values
  ('47000000-0000-4000-8000-000000000060', 'Maintenance', 77, 'total'),
  ('47000000-0000-4000-8000-000000000061', 'Maintenance', 66, 'total'),
  ('47000000-0000-4000-8000-000000000062', 'Maintenance', 66, 'total');

insert into public.ifta_fuel_purchases (id, truck_number, purchase_date, state, gallons, amount_paid, notes)
values ('47000000-0000-4000-8000-000000000032', 'UNKNOWN-LEGACY-TRUCK', '2026-06-03', 'NV', 20, 90, 'Needs fleet review');

select is((public.reconcile_operational_expenses(false) ->> 'created')::integer, 1, 'reconciliation dry run identifies one safe missing expense');
select is((public.reconcile_operational_expenses(false) ->> 'matched')::integer, 1, 'reconciliation dry run identifies one safe existing match');
select is((public.reconcile_operational_expenses(false) ->> 'ambiguous')::integer, 2, 'reconciliation reports duplicate candidates and unresolved historical IFTA trucks without guessing');
select is((public.reconcile_operational_expenses(true) ->> 'created')::integer, 1, 'reconciliation applies the safe missing expense');
select is((select service_record_id from public.bookkeeping_expense_groups where id = '47000000-0000-4000-8000-000000000060'), '47000000-0000-4000-8000-000000000042'::uuid, 'reconciliation links the unique existing transaction to its source');
select is((select count(*) from public.bookkeeping_expense_groups where ifta_fuel_purchase_id = '47000000-0000-4000-8000-000000000032'), 0::bigint, 'unresolved historical IFTA spending is left for review instead of invented linkage');
select is((public.reconcile_operational_expenses(false) ->> 'created')::integer, 0, 'reconciliation rerun is idempotent');
select is((public.reconcile_operational_expenses(false) ->> 'ambiguous')::integer, 2, 'ambiguous history remains visible for manual review');

reset role;
set local role anon;
select throws_ok(
  $$select public.reconcile_operational_expenses(false)$$,
  '42501', null, 'anonymous users cannot reconcile financial data'
);

reset role;
select * from finish();
rollback;

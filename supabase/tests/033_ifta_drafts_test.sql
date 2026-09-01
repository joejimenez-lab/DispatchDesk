begin;

select plan(33);

select has_table('public', 'ifta_drafts', 'IFTA review drafts table exists');
select has_column('public', 'ifta_drafts', 'missing_fields', 'drafts track missing data');
select has_column('public', 'ifta_trips', 'source_load_id', 'approved trips link to source loads');
select has_column('public', 'ifta_fuel_purchases', 'source_expense_group_id', 'approved fuel links to source bookkeeping');
select has_function('public', 'refresh_ifta_drafts', array['date', 'date'], 'source scan function exists');
select has_function('public', 'review_ifta_draft', array['uuid', 'text', 'jsonb', 'text'], 'draft review function exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
('00000000-0000-0000-0000-000000000000', '85000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ifta-draft-a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
('00000000-0000-0000-0000-000000000000', '85000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ifta-draft-b@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

select set_config('request.jwt.claims', '{"sub":"85000000-0000-4000-8000-000000000001","role":"authenticated","email":"ifta-draft-a@example.com"}', true);
set local role authenticated;

insert into public.fleet_units (id, unit_number, unit_type, company)
values ('85000000-0000-4000-8000-000000000010', 'IFTA-85', 'Truck', 'Draft Fleet');

insert into public.ifta_trips (id, unit_id, truck_number, start_date, pickup_city, dropoff_city, notes)
values ('85000000-0000-4000-8000-000000000020', '85000000-0000-4000-8000-000000000010', 'ignored', '2026-04-01', 'Reno, NV', 'Phoenix, AZ', 'Manual route template');
insert into public.ifta_trip_miles (trip_id, state, miles) values
  ('85000000-0000-4000-8000-000000000020', 'NV', 100),
  ('85000000-0000-4000-8000-000000000020', 'AZ', 200);

insert into public.loads (
  id, load_number, pickup_location, pickup_date, delivery_location, delivery_date,
  truck_unit_id, status
) values
  ('85000000-0000-4000-8000-000000000030', 'IFTA-L1', 'Reno, NV', '2026-05-01', 'Phoenix, AZ', '2026-05-02', '85000000-0000-4000-8000-000000000010', 'Delivered'),
  ('85000000-0000-4000-8000-000000000031', 'IFTA-L2', 'Boise, ID', '2026-05-03', 'Portland, OR', '2026-05-04', null, 'Closed'),
  ('85000000-0000-4000-8000-000000000032', 'IFTA-OPEN', 'Reno, NV', '2026-05-05', 'Phoenix, AZ', '2026-05-06', '85000000-0000-4000-8000-000000000010', 'In Transit');

insert into public.load_stops (load_id, position, stop_type, location, scheduled_start, scheduled_end, schedule_precision, time_zone) values
  ('85000000-0000-4000-8000-000000000030', 0, 'Pickup', 'Reno, NV', '2026-05-01 08:00', '2026-05-01 09:00', 'window', 'America/Los_Angeles'),
  ('85000000-0000-4000-8000-000000000030', 1, 'Delivery', 'Phoenix, AZ', '2026-05-02 08:00', '2026-05-02 09:00', 'window', 'America/Phoenix'),
  ('85000000-0000-4000-8000-000000000031', 0, 'Pickup', 'Boise, ID', '2026-05-03 08:00', '2026-05-03 09:00', 'window', 'America/Boise'),
  ('85000000-0000-4000-8000-000000000031', 1, 'Delivery', 'Portland, OR', '2026-05-04 08:00', '2026-05-04 09:00', 'window', 'America/Los_Angeles');

insert into public.bookkeeping_expense_groups (id, expense_date, vendor, notes, unit_id, source_type) values
  ('85000000-0000-4000-8000-000000000040', '2026-05-10', 'Fuel One', '75 gallons on receipt', '85000000-0000-4000-8000-000000000010', 'manual'),
  ('85000000-0000-4000-8000-000000000041', '2026-05-11', 'Fuel Two', null, null, 'manual'),
  ('85000000-0000-4000-8000-000000000042', '2026-05-12', 'Toll Only', null, '85000000-0000-4000-8000-000000000010', 'manual');
insert into public.bookkeeping_expenses (group_id, category, amount) values
  ('85000000-0000-4000-8000-000000000040', 'Fuel', 315.75),
  ('85000000-0000-4000-8000-000000000041', 'Fuel', 99.50),
  ('85000000-0000-4000-8000-000000000042', 'Tolls', 25.00);

select is(
  public.ifta_location_state('Las Vegas, NV 89101'),
  'NV',
  'structured stop state is parsed only from a valid terminal jurisdiction'
);

select is(
  public.refresh_ifta_drafts('2026-04-01', '2026-06-30'),
  '{"fuel_drafts_created": 2, "trip_drafts_created": 2}'::jsonb,
  'scan creates drafts for completed loads and Fuel bookkeeping only'
);

select is((select count(*) from public.ifta_drafts where draft_type = 'trip'), 2::bigint, 'two eligible trip drafts are queued');
select is((select count(*) from public.ifta_drafts where draft_type = 'fuel'), 2::bigint, 'two eligible fuel drafts are queued');
select is(
  (select jsonb_array_length(payload -> 'state_miles') from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'),
  2,
  'an exact historical route supplies reviewable state mileage'
);
select is(
  (select missing_fields from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000031'),
  array['truck', 'mileage']::text[],
  'unmatched trip flags its missing truck and mileage while retaining address states'
);
select is(
  (select missing_fields from public.ifta_drafts where source_expense_group_id = '85000000-0000-4000-8000-000000000040'),
  array['state', 'gallons']::text[],
  'bookkeeping fuel flags fields unavailable from accounting data'
);
select is(
  public.refresh_ifta_drafts('2026-04-01', '2026-06-30'),
  '{"fuel_drafts_created": 0, "trip_drafts_created": 0}'::jsonb,
  'repeated scans do not duplicate source drafts'
);

select lives_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'),
    'approve', null, 'Route matched the prior run'
  )$$,
  'a complete trip draft can be approved'
);
select is((select count(*) from public.ifta_trips where source_load_id = '85000000-0000-4000-8000-000000000030'), 1::bigint, 'approval posts exactly one source-linked trip');
select is((select sum(miles) from public.ifta_trip_miles where trip_id = (select id from public.ifta_trips where source_load_id = '85000000-0000-4000-8000-000000000030')), 300.0::numeric, 'approved trip posts its state miles');
select is((select status from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'), 'approved', 'approved trip leaves the review queue');

select throws_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'),
    'approve', null, null
  )$$,
  '23514', 'Approved drafts cannot be changed', 'an approved source cannot be posted twice'
);

select lives_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_expense_group_id = '85000000-0000-4000-8000-000000000040'),
    'approve',
    jsonb_build_object(
      'unit_id', '85000000-0000-4000-8000-000000000010', 'purchase_date', '2026-05-10',
      'city', 'Reno', 'state', 'NV', 'gallons', 75, 'amount_paid', 315.75,
      'vendor', 'Fuel One', 'notes', 'Reviewed against receipt'
    ),
    'Receipt checked'
  )$$,
  'an edited fuel draft can be approved'
);
select is((select count(*) from public.ifta_fuel_purchases where source_expense_group_id = '85000000-0000-4000-8000-000000000040'), 1::bigint, 'fuel approval posts one source-linked purchase');
select is((select gallons from public.ifta_fuel_purchases where source_expense_group_id = '85000000-0000-4000-8000-000000000040'), 75.0::numeric, 'reviewed gallons are posted');
select is((select source_type from public.bookkeeping_expense_groups where id = '85000000-0000-4000-8000-000000000040'), 'manual', 'approval does not duplicate or rewrite the accounting source');

select lives_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000031'),
    'reject', null, 'No reliable mileage source'
  )$$,
  'a trip draft can be rejected without posting'
);
select lives_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_expense_group_id = '85000000-0000-4000-8000-000000000041'),
    'exclude', null, 'Not an IFTA-qualified purchase'
  )$$,
  'a bookkeeping source can be explicitly excluded'
);
select is((select count(*) from public.ifta_drafts where status = 'pending'), 0::bigint, 'quarter has no unresolved drafts after review');
select is((select count(*) from public.ifta_drafts where cardinality(missing_fields) > 0), 2::bigint, 'missing-data flags remain available for reconciliation history');
select is((select count(*) from public.ifta_trips where notes = 'Manual route template'), 1::bigint, 'manual IFTA trips remain intact');

select lives_ok(
  $$delete from public.ifta_trips where source_load_id = '85000000-0000-4000-8000-000000000030'$$,
  'a posted source trip can be removed without corrupting its review record'
);
select is((select status from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'), 'pending', 'removing a posted trip reopens its draft');
select lives_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'),
    'approve', null, 'Reapproved after correction'
  )$$,
  'a reopened draft can be approved again without a duplicate source row'
);

select set_config('request.jwt.claims', '{"sub":"85000000-0000-4000-8000-000000000002","role":"authenticated","email":"ifta-draft-b@example.com"}', true);
select is((select count(*) from public.ifta_drafts), 0::bigint, 'another organization cannot see draft sources or review history');
select throws_ok(
  $$select public.review_ifta_draft(
    (select id from public.ifta_drafts where source_load_id = '85000000-0000-4000-8000-000000000030'),
    'reject', null, null
  )$$,
  'P0002', 'IFTA draft not found', 'another organization cannot review a hidden draft'
);

select * from finish();
rollback;

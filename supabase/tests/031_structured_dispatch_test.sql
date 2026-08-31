begin;

select plan(22);

select has_table('public', 'load_stops', 'structured load stops table exists');
select has_column('public', 'loads', 'commodity', 'loads store commodity');
select has_column('public', 'loads', 'weight_lbs', 'loads store weight');
select has_column('public', 'loads', 'pallet_count', 'loads store pallet count');
select has_column('public', 'loads', 'special_instructions', 'loads store special instructions');
select has_function('public', 'create_load_with_deductions', array['jsonb', 'jsonb', 'jsonb'], 'structured create function exists');
select has_function('public', 'update_load_with_payment', array['uuid', 'jsonb', 'jsonb', 'jsonb', 'jsonb'], 'structured update function exists');

select is_empty(
  $$select id from public.loads load where not exists (select 1 from public.load_stops stop where stop.load_id = load.id and stop.stop_type = 'Pickup')$$,
  'existing loads are backfilled with pickup stops'
);
select is_empty(
  $$select id from public.loads load where not exists (select 1 from public.load_stops stop where stop.load_id = load.id and stop.stop_type = 'Delivery')$$,
  'existing loads are backfilled with delivery stops'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '31000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dispatch-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Dispatch One"}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '31000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'dispatch-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Dispatch Two"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated","email":"dispatch-one@example.com"}', true);
set local role authenticated;

select lives_ok(
  $$select public.create_load_with_deductions(
    '{"load_number":"STRUCT-1","pickup_location":"legacy pickup","delivery_location":"legacy delivery","status":"Booked","commodity":"Produce","weight_lbs":"42000","pallet_count":"24","special_instructions":"Keep at 36F"}'::jsonb,
    '[]'::jsonb,
    '[
      {"stop_type":"Pickup","location":"Los Angeles, CA","scheduled_start":"2026-09-01T09:00","scheduled_end":"2026-09-01T10:00","schedule_precision":"window","time_zone":"America/Los_Angeles","appointment_number":"PU-100","reference_number":"REF-1","instructions":"Dock 4"},
      {"stop_type":"Intermediate","location":"Las Vegas, NV","scheduled_start":"2026-09-01T15:00","scheduled_end":"2026-09-01T16:00","schedule_precision":"window","time_zone":"America/Los_Angeles"},
      {"stop_type":"Delivery","location":"Salt Lake City, UT","scheduled_start":"2026-09-02T08:00","scheduled_end":"2026-09-02T09:00","schedule_precision":"window","time_zone":"America/Denver"}
    ]'::jsonb
  )$$,
  'a load can be created with multiple structured stops'
);

select is((select commodity from public.loads where load_number = 'STRUCT-1'), 'Produce', 'commodity is stored');
select is((select weight_lbs from public.loads where load_number = 'STRUCT-1'), 42000.00::numeric, 'weight is stored');
select is((select pallet_count from public.loads where load_number = 'STRUCT-1'), 24, 'pallet count is stored');
select is((select count(*) from public.load_stops where load_id = (select id from public.loads where load_number = 'STRUCT-1')), 3::bigint, 'all ordered stops are stored');
select is((select appointment_number from public.load_stops where load_id = (select id from public.loads where load_number = 'STRUCT-1') and position = 0), 'PU-100', 'appointment number is stored');
select is((select time_zone from public.load_stops where load_id = (select id from public.loads where load_number = 'STRUCT-1') and position = 2), 'America/Denver', 'stop time zone is stored');
select is((select pickup_location from public.loads where load_number = 'STRUCT-1'), 'Los Angeles, CA', 'legacy pickup stays synchronized from stops');
select set_config('test.structured_load_id', (select id::text from public.loads where load_number = 'STRUCT-1'), true);

select throws_ok(
  $$select public.create_load_with_deductions(
    '{"load_number":"BAD-ZONE","pickup_location":"A","delivery_location":"B","status":"Booked"}'::jsonb,
    '[]'::jsonb,
    '[{"stop_type":"Pickup","location":"A","scheduled_start":"2026-09-01T09:00","scheduled_end":"2026-09-01T10:00","time_zone":"Not/AZone"},{"stop_type":"Delivery","location":"B"}]'::jsonb
  )$$,
  '22023',
  'Unknown stop time zone: Not/AZone',
  'unknown IANA time zones are rejected atomically'
);
select is((select count(*) from public.loads where load_number = 'BAD-ZONE'), 0::bigint, 'failed structured creation leaves no partial load');

reset role;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated","email":"dispatch-two@example.com"}', true);
set local role authenticated;

select is((select count(*) from public.loads where load_number = 'STRUCT-1'), 0::bigint, 'other organizations cannot read the structured load');
select is((select count(*) from public.load_stops where appointment_number = 'PU-100'), 0::bigint, 'other organizations cannot read structured stops');
select throws_ok(
  $$select public.update_load_with_payment(
    current_setting('test.structured_load_id')::uuid,
    '{}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[{"stop_type":"Pickup","location":"A"},{"stop_type":"Delivery","location":"B"}]'::jsonb
  )$$,
  'P0002',
  'Load not found',
  'cross-organization callers cannot mutate a hidden load'
);

reset role;
select * from finish();
rollback;

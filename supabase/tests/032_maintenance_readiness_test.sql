begin;

select plan(17);

select has_column('public', 'fleet_units', 'odometer_updated_at', 'fleet units track the odometer update time');
select has_function('public', 'configure_maintenance_units', array['jsonb', 'boolean'], 'bulk maintenance setup function exists');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '32000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'maintenance-ready-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Maintenance One"}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '32000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'maintenance-ready-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Maintenance Two"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated","email":"maintenance-ready-one@example.com"}', true);
set local role authenticated;

insert into public.fleet_units (id, unit_number, unit_type) values
('32000000-0000-4000-8000-000000000010', 'READY-TRUCK', 'Truck'),
('32000000-0000-4000-8000-000000000011', 'READY-TRAILER', 'Trailer');

insert into public.fleet_units (id, unit_number, unit_type, odometer) values
('32000000-0000-4000-8000-000000000012', 'READY-WITH-ODOMETER', 'Truck', 50000);
select isnt((select odometer_updated_at from public.fleet_units where unit_number = 'READY-WITH-ODOMETER'), null::timestamptz, 'new units with an odometer start with a freshness timestamp');

select lives_ok(
  $$select public.configure_maintenance_units(
    '[{"unit_id":"32000000-0000-4000-8000-000000000010","odometer":100000},{"unit_id":"32000000-0000-4000-8000-000000000011","odometer":null}]'::jsonb,
    true
  )$$,
  'bulk setup applies odometers and equipment templates atomically'
);
select is((select odometer from public.fleet_units where unit_number = 'READY-TRUCK'), 100000, 'bulk setup records the truck odometer');
select isnt((select odometer_updated_at from public.fleet_units where unit_number = 'READY-TRUCK'), null::timestamptz, 'odometer updates record freshness');
select is((select count(*) from public.maintenance_reminders where unit_id = '32000000-0000-4000-8000-000000000010'), 4::bigint, 'truck defaults create four schedules');
select is((select count(*) from public.maintenance_reminders where unit_id = '32000000-0000-4000-8000-000000000011'), 2::bigint, 'trailer defaults create date-based schedules');
select is((select count(*) from public.maintenance_reminders where unit_id = '32000000-0000-4000-8000-000000000011' and reminder_type = 'Oil change'), 0::bigint, 'trailer defaults exclude oil changes');
select is(
  (public.configure_maintenance_units('[{"unit_id":"32000000-0000-4000-8000-000000000010"}]'::jsonb, true) ->> 'schedules_created')::integer,
  0,
  'reapplying templates reports no duplicate schedules'
);
select is((select count(*) from public.maintenance_reminders), 6::bigint, 'template setup is idempotent');
select throws_ok(
  $$select public.configure_maintenance_units('[{"unit_id":"32000000-0000-4000-8000-000000000010","odometer":99999}]'::jsonb, false)$$,
  '22023',
  'Odometer cannot be lower than the current reading for unit READY-TRUCK',
  'bulk setup rejects backwards odometers'
);
select is((select odometer from public.fleet_units where unit_number = 'READY-TRUCK'), 100000, 'a rejected update preserves the current reading');

reset role;
select set_config('request.jwt.claims', '{"sub":"32000000-0000-4000-8000-000000000002","role":"authenticated","email":"maintenance-ready-two@example.com"}', true);
set local role authenticated;

select throws_ok(
  $$select public.configure_maintenance_units('[{"unit_id":"32000000-0000-4000-8000-000000000010","odometer":120000}]'::jsonb, true)$$,
  'P0002',
  'Fleet unit not found',
  'bulk setup rejects a unit outside the current organization'
);
select is((select count(*) from public.fleet_units), 0::bigint, 'other organizations cannot see configured fleet units');
select is((select count(*) from public.maintenance_reminders), 0::bigint, 'other organizations cannot see generated schedules');
select isnt(public.current_organization_id(), null::uuid, 'the second tenant remains authenticated');

reset role;
select * from finish();
rollback;

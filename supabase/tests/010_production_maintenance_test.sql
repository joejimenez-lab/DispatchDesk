begin;

select plan(19);

select has_table('public', 'maintenance_reminders', 'maintenance reminders table exists');
select has_column('public', 'maintenance_reminders', 'due_odometer', 'mileage targets are stored');
select has_column('public', 'maintenance_reminders', 'interval_miles', 'mileage recurrence is stored');
select has_column('public', 'maintenance_reminders', 'completed_by', 'completion user is audited');
select col_is_fk('public', 'maintenance_reminders', 'unit_id', 'reminders belong to fleet units');
select has_column('public', 'repair_logs', 'log_type', 'repair history distinguishes daily logs');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000006',
  'authenticated', 'authenticated', 'issue6-test@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated","email":"issue6-test@example.com"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.fleet_units (unit_number, unit_type, odometer) values ('ISSUE-6-PGTAP', 'Truck', 95000)$$,
  'authenticated user can create the test fleet unit'
);

select lives_ok(
  $$insert into public.fleet_units (unit_number, unit_type) values ('ISSUE-6-TRAILER-PGTAP', 'Trailer')$$,
  'authenticated user can create the test trailer'
);

select throws_ok(
  $$
    insert into public.maintenance_reminders (unit_id, reminder_type, due_date, interval_days)
    select id, 'Daily repair log', current_date + 1, 1
    from public.fleet_units where unit_number = 'ISSUE-6-TRAILER-PGTAP'
  $$,
  '23514',
  null,
  'daily repair logs are rejected as reminder schedules'
);

select throws_ok(
  $$
    insert into public.maintenance_reminders (unit_id, reminder_type, due_date, interval_days)
    select id, 'Monthly service', current_date + 30, 30
    from public.fleet_units where unit_number = 'ISSUE-6-TRAILER-PGTAP'
  $$,
  '23514',
  null,
  'monthly service is rejected for trailers'
);

select lives_ok(
  $$
    insert into public.maintenance_reminders (
      unit_id, reminder_type, due_odometer, interval_miles, warning_miles
    )
    select id, 'Oil change', 100000, 5000, 500
    from public.fleet_units where unit_number = 'ISSUE-6-PGTAP'
  $$,
  'authenticated user can create a mileage schedule'
);

select throws_ok(
  $$
    insert into public.maintenance_reminders (unit_id, reminder_type, due_date)
    select id, 'Oil change', current_date + 10
    from public.fleet_units where unit_number = 'ISSUE-6-PGTAP'
  $$,
  '23505',
  null,
  'duplicate active unit and reminder type is rejected'
);

select lives_ok(
  $$
    select public.complete_maintenance_reminder(
      (select id from public.maintenance_reminders where reminder_type = 'Oil change' and completed_at is null),
      current_date,
      100000,
      'Oil and filter changed',
      250
    )
  $$,
  'completion atomically records history and schedules the next occurrence'
);

select is(
  (select count(*) from public.service_records where description = 'Oil change' and odometer = 100000),
  1::bigint,
  'completion creates a service history record'
);

select is(
  (select due_odometer from public.maintenance_reminders where reminder_type = 'Oil change' and completed_at is null),
  105000,
  'completion schedules the next custom mileage interval'
);

select is(
  (select completed_by_email from public.maintenance_reminders where reminder_type = 'Oil change' and completed_at is not null),
  'issue6-test@example.com',
  'completion records who performed it'
);

select lives_ok(
  $$
    insert into public.service_records (unit_id, service_date, odometer, description)
    select id, current_date, 110000, 'Manual odometer synchronization test'
    from public.fleet_units where unit_number = 'ISSUE-6-PGTAP'
  $$,
  'manual maintenance history can include a newer odometer reading'
);

select is(
  (select odometer from public.fleet_units where unit_number = 'ISSUE-6-PGTAP'),
  110000,
  'manual maintenance history advances the fleet unit odometer'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.maintenance_reminders$$,
  '42501',
  'permission denied for table maintenance_reminders',
  'anonymous users cannot read maintenance schedules'
);

reset role;
select * from finish();
rollback;

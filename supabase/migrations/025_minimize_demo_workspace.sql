-- Replace only the DispatchDesk Demo tenant's fictional dataset with a
-- deliberately minimal sample. The DCG tenant is resolved independently and
-- its row counts are checked before this migration can complete.

do $$
declare
  demo_user_id uuid;
  demo_organization_id uuid;
  protected_organization_id uuid;
  protected_counts jsonb := '{}'::jsonb;
  protected_count bigint;
  current_count bigint;
  table_name text;
begin
  select u.id, membership.organization_id
  into demo_user_id, demo_organization_id
  from auth.users u
  join public.organization_members membership on membership.user_id = u.id
  where lower(u.email) = 'dispatchdesk123@maildrop.cc';

  select membership.organization_id
  into protected_organization_id
  from auth.users u
  join public.organization_members membership on membership.user_id = u.id
  where lower(u.email) = 'dcgemscorp@gmail.com';

  -- Fresh installations run migrations before any Auth users exist. In that
  -- case the minimal seed below owns initialization. A partially configured
  -- hosted project is never accepted as a reset target.
  if demo_user_id is null and protected_organization_id is null then
    return;
  end if;

  if demo_user_id is null
    or demo_organization_id <> '00000000-0000-4000-8000-000000000001'::uuid
  then
    raise exception 'Refusing demo reset: demo login ownership is not exact';
  end if;

  if protected_organization_id is null
    or protected_organization_id = demo_organization_id
  then
    raise exception 'Refusing demo reset: protected DCG ownership is ambiguous';
  end if;

  foreach table_name in array array[
    'drivers', 'brokers', 'loads', 'payments', 'documents', 'notes',
    'activity_logs', 'fleet_units', 'service_records', 'inspection_records',
    'repair_logs', 'maintenance_reminders', 'ifta_trips', 'ifta_trip_miles',
    'ifta_fuel_purchases', 'bookkeeping_expense_groups',
    'bookkeeping_expenses', 'bookkeeping_receipts', 'storage_cleanup_jobs'
  ]
  loop
    execute format(
      'select count(*) from public.%I where organization_id = $1',
      table_name
    ) into protected_count using protected_organization_id;
    protected_counts := protected_counts || jsonb_build_object(table_name, protected_count);
  end loop;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', demo_user_id,
      'role', 'authenticated',
      'email', 'dispatchdesk123@maildrop.cc'
    )::text,
    true
  );

  delete from public.storage_cleanup_jobs where organization_id = demo_organization_id;
  delete from public.bookkeeping_receipts where organization_id = demo_organization_id;
  delete from public.bookkeeping_expenses where organization_id = demo_organization_id;
  delete from public.bookkeeping_expense_groups where organization_id = demo_organization_id;
  delete from public.ifta_trip_miles where organization_id = demo_organization_id;
  delete from public.ifta_fuel_purchases where organization_id = demo_organization_id;
  delete from public.ifta_trips where organization_id = demo_organization_id;
  delete from public.maintenance_reminders where organization_id = demo_organization_id;
  delete from public.service_records where organization_id = demo_organization_id;
  delete from public.inspection_records where organization_id = demo_organization_id;
  delete from public.repair_logs where organization_id = demo_organization_id;
  delete from public.documents where organization_id = demo_organization_id;
  delete from public.notes where organization_id = demo_organization_id;
  delete from public.activity_logs where organization_id = demo_organization_id;
  delete from public.payments where organization_id = demo_organization_id;
  delete from public.loads where organization_id = demo_organization_id;
  delete from public.brokers where organization_id = demo_organization_id;
  delete from public.drivers where organization_id = demo_organization_id;
  delete from public.fleet_units where organization_id = demo_organization_id;

  insert into public.drivers (
    id, name, phone, email, truck_number, trailer_number, notes, organization_id
  ) values
    (
      '25000000-0000-4000-8000-000000000001',
      'Demo Driver One',
      '(555) 010-0001',
      'driver.one@example.test',
      'DEMO-101',
      'DEMO-501',
      'Fictional driver used only for the DispatchDesk demo.',
      demo_organization_id
    ),
    (
      '25000000-0000-4000-8000-000000000002',
      'Demo Driver Two',
      '(555) 010-0002',
      'driver.two@example.test',
      'DEMO-102',
      'DEMO-502',
      'Fictional driver used only for the DispatchDesk demo.',
      demo_organization_id
    );

  insert into public.brokers (
    id, company_name, contact_name, phone, email, notes, organization_id
  ) values (
    '25000000-0000-4000-8000-000000000101',
    'Demo Freight Brokerage',
    'Demo Contact',
    '(555) 020-0001',
    'broker@example.test',
    'Fictional broker used only for the DispatchDesk demo.',
    demo_organization_id
  );

  insert into public.loads (
    id, load_number, broker_id, carrier_company, driver_id,
    pickup_location, pickup_date, delivery_location, delivery_date,
    load_rate, driver_pay, dispatcher_fee, fuel_cost, notes, status,
    organization_id
  ) values
    (
      '25000000-0000-4000-8000-000000000201',
      'DEMO-001',
      '25000000-0000-4000-8000-000000000101',
      'DispatchDesk Demo',
      '25000000-0000-4000-8000-000000000001',
      'Los Angeles, CA',
      current_date + 1,
      'Phoenix, AZ',
      current_date + 2,
      2500,
      1500,
      250,
      400,
      'Minimal fictional booked load.',
      'Booked',
      demo_organization_id
    ),
    (
      '25000000-0000-4000-8000-000000000202',
      'DEMO-002',
      '25000000-0000-4000-8000-000000000101',
      'DispatchDesk Demo',
      '25000000-0000-4000-8000-000000000002',
      'San Diego, CA',
      current_date - 2,
      'Las Vegas, NV',
      current_date - 1,
      1800,
      1050,
      180,
      275,
      'Minimal fictional delivered load.',
      'Delivered',
      demo_organization_id
    );

  if (select count(*) from public.drivers where organization_id = demo_organization_id) <> 2
    or (select count(*) from public.brokers where organization_id = demo_organization_id) <> 1
    or (select count(*) from public.loads where organization_id = demo_organization_id) <> 2
    or (select count(*) from public.payments where organization_id = demo_organization_id) <> 2
    or (select count(*) from public.activity_logs where organization_id = demo_organization_id) <> 2
  then
    raise exception 'Demo reset verification failed';
  end if;

  foreach table_name in array array[
    'documents', 'notes', 'fleet_units', 'service_records',
    'inspection_records', 'repair_logs', 'maintenance_reminders',
    'ifta_trips', 'ifta_trip_miles', 'ifta_fuel_purchases',
    'bookkeeping_expense_groups', 'bookkeeping_expenses',
    'bookkeeping_receipts', 'storage_cleanup_jobs'
  ]
  loop
    execute format(
      'select count(*) from public.%I where organization_id = $1',
      table_name
    ) into current_count using demo_organization_id;
    if current_count <> 0 then
      raise exception 'Demo reset left unexpected rows in %', table_name;
    end if;
  end loop;

  foreach table_name in array array[
    'drivers', 'brokers', 'loads', 'payments', 'documents', 'notes',
    'activity_logs', 'fleet_units', 'service_records', 'inspection_records',
    'repair_logs', 'maintenance_reminders', 'ifta_trips', 'ifta_trip_miles',
    'ifta_fuel_purchases', 'bookkeeping_expense_groups',
    'bookkeeping_expenses', 'bookkeeping_receipts', 'storage_cleanup_jobs'
  ]
  loop
    execute format(
      'select count(*) from public.%I where organization_id = $1',
      table_name
    ) into current_count using protected_organization_id;
    if current_count <> (protected_counts ->> table_name)::bigint then
      raise exception 'Protected DCG row count changed in %', table_name;
    end if;
  end loop;
end;
$$;

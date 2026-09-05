-- Minimal fictional DispatchDesk demo dataset.
-- Every mutation is scoped to the fixed demo organization. Other tenant data
-- is never truncated or used as an implicit target.

begin;

do $$
declare
  demo_user_id uuid;
  demo_user_email text;
  placeholder_organization_id uuid;
begin
  select u.id, lower(u.email)
  into demo_user_id, demo_user_email
  from auth.users u
  join public.organization_members membership on membership.user_id = u.id
  where lower(u.email) = 'dispatchdesk123@maildrop.cc'
    and membership.organization_id = '00000000-0000-4000-8000-000000000001';

  -- Fresh local resets have no Auth account yet. Use a temporary actor only
  -- long enough for tenant-aware defaults and triggers, then remove it below.
  if demo_user_id is null then
    demo_user_id := '10000000-0000-4000-8000-000000000001';
    demo_user_email := 'demo.seed@dispatchdesk.demo';

    insert into auth.users (id, email, raw_user_meta_data)
    values (
      demo_user_id,
      demo_user_email,
      '{"full_name":"Demo Seed"}'::jsonb
    )
    on conflict (id) do update
    set email = excluded.email,
        raw_user_meta_data = excluded.raw_user_meta_data;

    select organization_id into placeholder_organization_id
    from public.organization_members
    where user_id = demo_user_id;

    insert into public.organization_members (user_id, organization_id, role)
    values (
      demo_user_id,
      '00000000-0000-4000-8000-000000000001',
      'owner'
    )
    on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        role = excluded.role;

    delete from public.organizations
    where id = placeholder_organization_id
      and id <> '00000000-0000-4000-8000-000000000001'
      and not exists (
        select 1 from public.organization_members
        where organization_id = placeholder_organization_id
      );
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', demo_user_id,
      'role', 'authenticated',
      'email', demo_user_email
    )::text,
    true
  );
end;
$$;

-- Remove only rows owned by the fictional demo workspace, from children to
-- parents. Never use TRUNCATE here because the same database hosts DCG data.
delete from public.storage_cleanup_jobs where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.contact_merge_logs where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.ifta_drafts where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.bookkeeping_receipts where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.bookkeeping_expenses where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.bookkeeping_expense_groups where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.ifta_trip_miles where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.ifta_fuel_purchases where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.ifta_trips where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.maintenance_reminders where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.service_records where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.inspection_records where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.repair_logs where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.documents where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.notes where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.activity_logs where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.payments where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.loads where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.brokers where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.drivers where organization_id = '00000000-0000-4000-8000-000000000001';
delete from public.fleet_units where organization_id = '00000000-0000-4000-8000-000000000001';

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
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '25000000-0000-4000-8000-000000000002',
    'Demo Driver Two',
    '(555) 010-0002',
    'driver.two@example.test',
    'DEMO-102',
    'DEMO-502',
    'Fictional driver used only for the DispatchDesk demo.',
    '00000000-0000-4000-8000-000000000001'
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
  '00000000-0000-4000-8000-000000000001'
);

insert into public.loads (
  id, load_number, broker_id, carrier_company, driver_id,
  pickup_location, pickup_date, delivery_location, delivery_date,
  load_rate, driver_pay, dispatcher_fee, fuel_cost,
  driver_pay_known, dispatcher_fee_known, fuel_cost_known,
  notes, status,
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
    true,
    true,
    true,
    'Minimal fictional booked load.',
    'Booked',
    '00000000-0000-4000-8000-000000000001'
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
    true,
    true,
    true,
    'Minimal fictional delivered load.',
    'Delivered',
    '00000000-0000-4000-8000-000000000001'
  );

-- Seed runs after migrations, so add the same conservative date-only stops
-- expected by the structured dispatch views.
insert into public.load_stops (
  organization_id, load_id, position, stop_type, location,
  scheduled_start, scheduled_end, schedule_precision, time_zone
)
select
  organization_id, id, 0, 'Pickup', pickup_location,
  pickup_date::timestamp, pickup_date::timestamp + interval '23 hours 59 minutes',
  'date', 'America/Los_Angeles'
from public.loads
where organization_id = '00000000-0000-4000-8000-000000000001';

insert into public.load_stops (
  organization_id, load_id, position, stop_type, location,
  scheduled_start, scheduled_end, schedule_precision, time_zone
)
select
  organization_id, id, 1, 'Delivery', delivery_location,
  delivery_date::timestamp, delivery_date::timestamp + interval '23 hours 59 minutes',
  'date', 'America/Los_Angeles'
from public.loads
where organization_id = '00000000-0000-4000-8000-000000000001';

-- Remove the local-only seed actor if one was needed. The two load inserts
-- automatically create two payment rows and two activity rows.
delete from auth.users
where id = '10000000-0000-4000-8000-000000000001'
  and lower(email) = 'demo.seed@dispatchdesk.demo'
  and not exists (
    select 1 from auth.identities
    where user_id = '10000000-0000-4000-8000-000000000001'
  );

commit;

-- Record the actual fleet equipment used for a load instead of deriving it
-- from the driver's current defaults.

alter table public.loads
  add column truck_unit_id uuid references public.fleet_units(id) on delete restrict,
  add column trailer_unit_id uuid references public.fleet_units(id) on delete restrict,
  add column fleet_company text,
  add column truck_number text,
  add column trailer_number text;

create index loads_truck_unit_idx on public.loads(truck_unit_id);
create index loads_trailer_unit_idx on public.loads(trailer_unit_id);
create index loads_organization_fleet_idx on public.loads(organization_id, fleet_company);
create index fleet_units_organization_company_type_idx
on public.fleet_units(organization_id, company, unit_type);

create or replace function public.validate_load_equipment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  truck public.fleet_units%rowtype;
  trailer public.fleet_units%rowtype;
  selected_fleet text := nullif(btrim(new.fleet_company), '');
  canonical_fleet text;
begin
  -- Snapshot columns are trigger-owned. Preserve them when the assignment
  -- itself did not change, including during ordinary edits to an old load.
  if tg_op = 'UPDATE'
    and new.organization_id is not distinct from old.organization_id
    and new.truck_unit_id is not distinct from old.truck_unit_id
    and new.trailer_unit_id is not distinct from old.trailer_unit_id
    and new.fleet_company is not distinct from old.fleet_company
  then
    new.truck_number := old.truck_number;
    new.trailer_number := old.trailer_number;
    new.fleet_company := old.fleet_company;
    return new;
  end if;

  if new.truck_unit_id is not null then
    select * into truck
    from public.fleet_units
    where id = new.truck_unit_id
      and organization_id = new.organization_id;

    if not found then
      raise foreign_key_violation using
        message = 'truck_unit_id must belong to the same organization';
    end if;
    if truck.unit_type <> 'Truck' then
      raise check_violation using
        message = 'truck_unit_id must reference a Truck unit';
    end if;
  end if;

  if new.trailer_unit_id is not null then
    select * into trailer
    from public.fleet_units
    where id = new.trailer_unit_id
      and organization_id = new.organization_id;

    if not found then
      raise foreign_key_violation using
        message = 'trailer_unit_id must belong to the same organization';
    end if;
    if trailer.unit_type <> 'Trailer' then
      raise check_violation using
        message = 'trailer_unit_id must reference a Trailer unit';
    end if;
  end if;

  if new.truck_unit_id is not null and new.trailer_unit_id is not null
    and nullif(lower(btrim(truck.company)), '')
      is distinct from nullif(lower(btrim(trailer.company)), '')
  then
    raise check_violation using
      message = 'Truck and trailer must belong to the same fleet';
  end if;

  canonical_fleet := case
    when new.truck_unit_id is not null then nullif(btrim(truck.company), '')
    when new.trailer_unit_id is not null then nullif(btrim(trailer.company), '')
    else null
  end;

  if selected_fleet is not null and canonical_fleet is not null
    and lower(selected_fleet) <> lower(canonical_fleet)
  then
    raise check_violation using
      message = 'Selected fleet must match the assigned equipment';
  end if;

  if selected_fleet is not null
    and canonical_fleet is null
    and (new.truck_unit_id is not null or new.trailer_unit_id is not null)
  then
    raise check_violation using
      message = 'Selected fleet must match the assigned equipment';
  end if;

  if selected_fleet is not null and canonical_fleet is null
    and new.truck_unit_id is null and new.trailer_unit_id is null
  then
    select unit.company into canonical_fleet
    from public.fleet_units unit
    where unit.organization_id = new.organization_id
      and nullif(lower(btrim(unit.company)), '') = lower(selected_fleet)
    order by unit.company, unit.id
    limit 1;

    if not found then
      raise check_violation using
        message = 'Selected fleet must belong to the same organization';
    end if;
  end if;

  new.fleet_company := canonical_fleet;
  new.truck_number := case when new.truck_unit_id is null then null else truck.unit_number end;
  new.trailer_number := case when new.trailer_unit_id is null then null else trailer.unit_number end;
  return new;
end;
$$;

create trigger loads_validate_trailer_tenant
before insert or update of organization_id, trailer_unit_id
on public.loads for each row
execute function public.validate_tenant_reference('fleet_units', 'trailer_unit_id');

create trigger loads_validate_truck_tenant
before insert or update of organization_id, truck_unit_id
on public.loads for each row
execute function public.validate_tenant_reference('fleet_units', 'truck_unit_id');

-- PostgreSQL runs same-event triggers in name order. This name intentionally
-- sorts after the tenant-reference triggers so cross-tenant IDs report 23503.
create trigger loads_validate_unit_assignments
before insert or update on public.loads
for each row execute function public.validate_load_equipment();

-- Recover historical links only when a driver's text has exactly one
-- normalized, same-organization unit match. Conflicting unique matches are
-- both left unassigned rather than guessing which default was historically used.
alter table public.loads disable trigger loads_log_changes;
alter table public.loads disable trigger loads_set_updated_at;

with unique_truck_matches as (
  select load.id as load_id, (array_agg(unit.id order by unit.id))[1] as unit_id
  from public.loads load
  join public.drivers driver
    on driver.id = load.driver_id
   and driver.organization_id = load.organization_id
  join public.fleet_units unit
    on unit.organization_id = load.organization_id
   and unit.unit_type = 'Truck'
   and lower(btrim(unit.unit_number)) = lower(btrim(driver.truck_number))
  where nullif(btrim(driver.truck_number), '') is not null
  group by load.id
  having count(*) = 1
),
unique_trailer_matches as (
  select load.id as load_id, (array_agg(unit.id order by unit.id))[1] as unit_id
  from public.loads load
  join public.drivers driver
    on driver.id = load.driver_id
   and driver.organization_id = load.organization_id
  join public.fleet_units unit
    on unit.organization_id = load.organization_id
   and unit.unit_type = 'Trailer'
   and lower(btrim(unit.unit_number)) = lower(btrim(driver.trailer_number))
  where nullif(btrim(driver.trailer_number), '') is not null
  group by load.id
  having count(*) = 1
),
safe_matches as (
  select
    load.id as load_id,
    case
      when truck_match.unit_id is not null
        and trailer_match.unit_id is not null
        and nullif(lower(btrim(truck.company)), '')
          is distinct from nullif(lower(btrim(trailer.company)), '')
      then null
      else truck_match.unit_id
    end as truck_unit_id,
    case
      when truck_match.unit_id is not null
        and trailer_match.unit_id is not null
        and nullif(lower(btrim(truck.company)), '')
        is not distinct from nullif(lower(btrim(trailer.company)), '')
      then trailer_match.unit_id
      when truck_match.unit_id is null then trailer_match.unit_id
      else null
    end as trailer_unit_id
  from public.loads load
  left join unique_truck_matches truck_match on truck_match.load_id = load.id
  left join public.fleet_units truck on truck.id = truck_match.unit_id
  left join unique_trailer_matches trailer_match on trailer_match.load_id = load.id
  left join public.fleet_units trailer on trailer.id = trailer_match.unit_id
)
update public.loads load
set truck_unit_id = matches.truck_unit_id,
    trailer_unit_id = matches.trailer_unit_id
from safe_matches matches
where load.id = matches.load_id
  and (matches.truck_unit_id is not null or matches.trailer_unit_id is not null);

alter table public.loads enable trigger loads_set_updated_at;
alter table public.loads enable trigger loads_log_changes;

create or replace function public.create_load_with_deductions(
  p_load jsonb,
  p_deductions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_load_id uuid;
  deduction jsonb;
  deduction_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then
    raise exception 'Load deductions must be an array' using errcode = '22023';
  end if;

  insert into public.loads (
    load_number, broker_id, carrier_company, driver_id,
    fleet_company, truck_unit_id, trailer_unit_id,
    pickup_location, pickup_date, delivery_location, delivery_date,
    is_round_trip, return_location, round_trip_details,
    load_rate, driver_pay, dispatcher_fee, fuel_cost,
    factoring_mode, factoring_percent, factoring_fixed_amount,
    notes, status
  ) values (
    p_load ->> 'load_number',
    nullif(p_load ->> 'broker_id', '')::uuid,
    nullif(p_load ->> 'carrier_company', ''),
    nullif(p_load ->> 'driver_id', '')::uuid,
    nullif(p_load ->> 'fleet_company', ''),
    nullif(p_load ->> 'truck_unit_id', '')::uuid,
    nullif(p_load ->> 'trailer_unit_id', '')::uuid,
    p_load ->> 'pickup_location',
    nullif(p_load ->> 'pickup_date', '')::date,
    p_load ->> 'delivery_location',
    nullif(p_load ->> 'delivery_date', '')::date,
    coalesce((p_load ->> 'is_round_trip')::boolean, false),
    nullif(p_load ->> 'return_location', ''),
    nullif(p_load ->> 'round_trip_details', ''),
    coalesce((p_load ->> 'load_rate')::numeric, 0),
    coalesce((p_load ->> 'driver_pay')::numeric, 0),
    coalesce((p_load ->> 'dispatcher_fee')::numeric, 0),
    coalesce((p_load ->> 'fuel_cost')::numeric, 0),
    coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
    coalesce((p_load ->> 'factoring_percent')::numeric, 0),
    coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
    nullif(p_load ->> 'notes', ''),
    (p_load ->> 'status')::public.load_status
  )
  returning id into created_load_id;

  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions (load_id, label, amount, position)
    values (
      created_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

  return created_load_id;
end;
$$;

create or replace function public.update_load_with_payment(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb,
  p_deductions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deduction jsonb;
  deduction_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then
    raise exception 'Load deductions must be an array' using errcode = '22023';
  end if;

  update public.loads
  set load_number = p_load ->> 'load_number',
      broker_id = nullif(p_load ->> 'broker_id', '')::uuid,
      carrier_company = nullif(p_load ->> 'carrier_company', ''),
      driver_id = nullif(p_load ->> 'driver_id', '')::uuid,
      fleet_company = nullif(p_load ->> 'fleet_company', ''),
      truck_unit_id = nullif(p_load ->> 'truck_unit_id', '')::uuid,
      trailer_unit_id = nullif(p_load ->> 'trailer_unit_id', '')::uuid,
      pickup_location = p_load ->> 'pickup_location',
      pickup_date = nullif(p_load ->> 'pickup_date', '')::date,
      delivery_location = p_load ->> 'delivery_location',
      delivery_date = nullif(p_load ->> 'delivery_date', '')::date,
      is_round_trip = coalesce((p_load ->> 'is_round_trip')::boolean, false),
      return_location = nullif(p_load ->> 'return_location', ''),
      round_trip_details = nullif(p_load ->> 'round_trip_details', ''),
      load_rate = coalesce((p_load ->> 'load_rate')::numeric, 0),
      driver_pay = coalesce((p_load ->> 'driver_pay')::numeric, 0),
      dispatcher_fee = coalesce((p_load ->> 'dispatcher_fee')::numeric, 0),
      fuel_cost = coalesce((p_load ->> 'fuel_cost')::numeric, 0),
      factoring_mode = coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
      factoring_percent = coalesce((p_load ->> 'factoring_percent')::numeric, 0),
      factoring_fixed_amount = coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
      notes = nullif(p_load ->> 'notes', ''),
      status = (p_load ->> 'status')::public.load_status
  where id = p_load_id;

  if not found then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  delete from public.load_deductions where load_id = p_load_id;

  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions (load_id, label, amount, position)
    values (
      p_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

  insert into public.payments (
    load_id, invoice_sent, invoice_sent_date,
    client_paid, client_amount_received, client_date_received,
    driver_paid, driver_amount_paid, driver_date_paid,
    dispatcher_fee_amount, dispatcher_paid, dispatcher_date_paid
  ) values (
    p_load_id,
    coalesce((p_payment ->> 'invoice_sent')::boolean, false),
    nullif(p_payment ->> 'invoice_sent_date', '')::date,
    coalesce((p_payment ->> 'client_paid')::boolean, false),
    coalesce((p_payment ->> 'client_amount_received')::numeric, 0),
    nullif(p_payment ->> 'client_date_received', '')::date,
    coalesce((p_payment ->> 'driver_paid')::boolean, false),
    coalesce((p_payment ->> 'driver_amount_paid')::numeric, 0),
    nullif(p_payment ->> 'driver_date_paid', '')::date,
    coalesce((p_payment ->> 'dispatcher_fee_amount')::numeric, 0),
    coalesce((p_payment ->> 'dispatcher_paid')::boolean, false),
    nullif(p_payment ->> 'dispatcher_date_paid', '')::date
  )
  on conflict (load_id) do update
  set invoice_sent = excluded.invoice_sent,
      invoice_sent_date = excluded.invoice_sent_date,
      client_paid = excluded.client_paid,
      client_amount_received = excluded.client_amount_received,
      client_date_received = excluded.client_date_received,
      driver_paid = excluded.driver_paid,
      driver_amount_paid = excluded.driver_amount_paid,
      driver_date_paid = excluded.driver_date_paid,
      dispatcher_fee_amount = excluded.dispatcher_fee_amount,
      dispatcher_paid = excluded.dispatcher_paid,
      dispatcher_date_paid = excluded.dispatcher_date_paid;

  insert into public.activity_logs (load_id, action)
  values (p_load_id, 'Load and payment details updated');
end;
$$;

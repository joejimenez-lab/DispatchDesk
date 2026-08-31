-- Structured shipment stops, appointment windows, and shipment details.
-- Existing lane columns stay synchronized for compatibility with reports and
-- integrations while the ordered stop list becomes the dispatch source.

alter table public.loads
  add column commodity text,
  add column weight_lbs numeric(10, 2) check (weight_lbs is null or weight_lbs >= 0),
  add column pallet_count integer check (pallet_count is null or pallet_count >= 0),
  add column special_instructions text;

create table public.load_stops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete restrict,
  load_id uuid not null references public.loads(id) on delete cascade,
  position integer not null check (position >= 0),
  stop_type text not null check (stop_type in ('Pickup', 'Delivery', 'Return', 'Intermediate')),
  location text not null check (btrim(location) <> ''),
  scheduled_start timestamp without time zone,
  scheduled_end timestamp without time zone,
  schedule_precision text not null default 'window' check (schedule_precision in ('date', 'window')),
  time_zone text,
  appointment_number text,
  reference_number text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (load_id, position),
  check (
    (scheduled_start is null and scheduled_end is null)
    or (scheduled_start is not null and scheduled_end is not null and scheduled_end >= scheduled_start)
  ),
  check (scheduled_start is null or time_zone is not null)
);

create index load_stops_organization_idx on public.load_stops(organization_id);
create index load_stops_load_idx on public.load_stops(load_id, position);
create index load_stops_schedule_idx on public.load_stops(organization_id, scheduled_start);
create index load_stops_reference_idx on public.load_stops(organization_id, reference_number);

create trigger load_stops_set_updated_at
before update on public.load_stops
for each row execute function public.set_updated_at();

create trigger load_stops_validate_load_tenant
before insert or update of organization_id, load_id on public.load_stops
for each row execute function public.validate_tenant_reference('loads', 'load_id');

alter table public.load_stops enable row level security;
create policy "Members can manage tenant rows"
on public.load_stops for all to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

grant select, insert, update, delete on table public.load_stops to authenticated;

-- Backfill every existing load without inventing appointment times. Date-only
-- stops remain visible on the board but are excluded from overlap and late
-- calculations until an actual appointment window is entered.
insert into public.load_stops (
  organization_id, load_id, position, stop_type, location,
  scheduled_start, scheduled_end, schedule_precision, time_zone
)
select
  organization_id, id, 0, 'Pickup', pickup_location,
  pickup_date::timestamp,
  case when pickup_date is null then null else pickup_date::timestamp + interval '23 hours 59 minutes' end,
  'date',
  case when pickup_date is null then null else 'America/Los_Angeles' end
from public.loads;

insert into public.load_stops (
  organization_id, load_id, position, stop_type, location,
  scheduled_start, scheduled_end, schedule_precision, time_zone
)
select
  organization_id, id, 1, 'Delivery', delivery_location,
  delivery_date::timestamp,
  case when delivery_date is null then null else delivery_date::timestamp + interval '23 hours 59 minutes' end,
  'date',
  case when delivery_date is null then null else 'America/Los_Angeles' end
from public.loads;

insert into public.load_stops (
  organization_id, load_id, position, stop_type, location,
  schedule_precision, instructions
)
select
  organization_id, id, 2, 'Return', coalesce(nullif(return_location, ''), pickup_location),
  'window', round_trip_details
from public.loads
where is_round_trip;

create or replace function public.create_load_with_deductions(
  p_load jsonb,
  p_deductions jsonb,
  p_stops jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_load_id uuid;
  stop jsonb;
  stop_position integer := 0;
  stop_timezone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_stops, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_stops, '[]'::jsonb)) < 2 then
    raise exception 'A load requires at least two stops' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Pickup')
    or not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Delivery') then
    raise exception 'A load requires a pickup and delivery stop' using errcode = '22023';
  end if;

  created_load_id := public.create_load_with_deductions(p_load, p_deductions);

  update public.loads set
    commodity = nullif(btrim(p_load ->> 'commodity'), ''),
    weight_lbs = nullif(p_load ->> 'weight_lbs', '')::numeric,
    pallet_count = nullif(p_load ->> 'pallet_count', '')::integer,
    special_instructions = nullif(btrim(p_load ->> 'special_instructions'), '')
  where id = created_load_id;

  for stop in select * from jsonb_array_elements(p_stops)
  loop
    stop_timezone := nullif(btrim(stop ->> 'time_zone'), '');
    if stop_timezone is not null and not exists (select 1 from pg_timezone_names where name = stop_timezone) then
      raise exception 'Unknown stop time zone: %', stop_timezone using errcode = '22023';
    end if;
    insert into public.load_stops (
      load_id, position, stop_type, location, scheduled_start, scheduled_end,
      schedule_precision, time_zone, appointment_number, reference_number, instructions
    ) values (
      created_load_id,
      stop_position,
      stop ->> 'stop_type',
      btrim(stop ->> 'location'),
      nullif(stop ->> 'scheduled_start', '')::timestamp,
      nullif(stop ->> 'scheduled_end', '')::timestamp,
      coalesce(nullif(stop ->> 'schedule_precision', ''), 'window'),
      stop_timezone,
      nullif(btrim(stop ->> 'appointment_number'), ''),
      nullif(btrim(stop ->> 'reference_number'), ''),
      nullif(btrim(stop ->> 'instructions'), '')
    );
    stop_position := stop_position + 1;
  end loop;

  update public.loads set
    pickup_location = (select location from public.load_stops where load_id = created_load_id and stop_type = 'Pickup' order by position limit 1),
    pickup_date = (select scheduled_start::date from public.load_stops where load_id = created_load_id and stop_type = 'Pickup' order by position limit 1),
    delivery_location = (select location from public.load_stops where load_id = created_load_id and stop_type = 'Delivery' order by position limit 1),
    delivery_date = (select scheduled_start::date from public.load_stops where load_id = created_load_id and stop_type = 'Delivery' order by position limit 1),
    is_round_trip = exists (select 1 from public.load_stops where load_id = created_load_id and stop_type = 'Return'),
    return_location = (select location from public.load_stops where load_id = created_load_id and stop_type = 'Return' order by position limit 1),
    round_trip_details = (select instructions from public.load_stops where load_id = created_load_id and stop_type = 'Return' order by position limit 1)
  where id = created_load_id;

  insert into public.activity_logs(load_id, action)
  values (created_load_id, stop_position || ' structured stops added');

  return created_load_id;
end;
$$;

create or replace function public.update_load_with_payment(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb,
  p_deductions jsonb,
  p_stops jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  stop jsonb;
  stop_position integer := 0;
  stop_timezone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_stops, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_stops, '[]'::jsonb)) < 2 then
    raise exception 'A load requires at least two stops' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Pickup')
    or not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Delivery') then
    raise exception 'A load requires a pickup and delivery stop' using errcode = '22023';
  end if;

  perform public.update_load_with_payment(p_load_id, p_load, p_payment, p_deductions);

  update public.loads set
    commodity = nullif(btrim(p_load ->> 'commodity'), ''),
    weight_lbs = nullif(p_load ->> 'weight_lbs', '')::numeric,
    pallet_count = nullif(p_load ->> 'pallet_count', '')::integer,
    special_instructions = nullif(btrim(p_load ->> 'special_instructions'), '')
  where id = p_load_id;
  if not found then raise exception 'Load not found' using errcode = 'P0002'; end if;

  delete from public.load_stops where load_id = p_load_id;
  for stop in select * from jsonb_array_elements(p_stops)
  loop
    stop_timezone := nullif(btrim(stop ->> 'time_zone'), '');
    if stop_timezone is not null and not exists (select 1 from pg_timezone_names where name = stop_timezone) then
      raise exception 'Unknown stop time zone: %', stop_timezone using errcode = '22023';
    end if;
    insert into public.load_stops (
      load_id, position, stop_type, location, scheduled_start, scheduled_end,
      schedule_precision, time_zone, appointment_number, reference_number, instructions
    ) values (
      p_load_id,
      stop_position,
      stop ->> 'stop_type',
      btrim(stop ->> 'location'),
      nullif(stop ->> 'scheduled_start', '')::timestamp,
      nullif(stop ->> 'scheduled_end', '')::timestamp,
      coalesce(nullif(stop ->> 'schedule_precision', ''), 'window'),
      stop_timezone,
      nullif(btrim(stop ->> 'appointment_number'), ''),
      nullif(btrim(stop ->> 'reference_number'), ''),
      nullif(btrim(stop ->> 'instructions'), '')
    );
    stop_position := stop_position + 1;
  end loop;

  update public.loads set
    pickup_location = (select location from public.load_stops where load_id = p_load_id and stop_type = 'Pickup' order by position limit 1),
    pickup_date = (select scheduled_start::date from public.load_stops where load_id = p_load_id and stop_type = 'Pickup' order by position limit 1),
    delivery_location = (select location from public.load_stops where load_id = p_load_id and stop_type = 'Delivery' order by position limit 1),
    delivery_date = (select scheduled_start::date from public.load_stops where load_id = p_load_id and stop_type = 'Delivery' order by position limit 1),
    is_round_trip = exists (select 1 from public.load_stops where load_id = p_load_id and stop_type = 'Return'),
    return_location = (select location from public.load_stops where load_id = p_load_id and stop_type = 'Return' order by position limit 1),
    round_trip_details = (select instructions from public.load_stops where load_id = p_load_id and stop_type = 'Return' order by position limit 1)
  where id = p_load_id;

  insert into public.activity_logs(load_id, action)
  values (p_load_id, 'Structured stops and shipment details updated');
end;
$$;

grant execute on function public.create_load_with_deductions(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

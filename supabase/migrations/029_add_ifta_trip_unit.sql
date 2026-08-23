-- Keep each IFTA trip tied to the same durable fleet unit used by fuel records.
alter table public.ifta_trips
  add column unit_id uuid references public.fleet_units(id) on delete restrict;

create index ifta_trips_organization_unit_idx
on public.ifta_trips(organization_id, unit_id, start_date);

create trigger ifta_trips_validate_unit_tenant
before insert or update of organization_id, unit_id
on public.ifta_trips for each row
execute function public.validate_tenant_reference('fleet_units', 'unit_id');

create or replace function public.validate_ifta_trip_unit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_unit public.fleet_units%rowtype;
begin
  if new.unit_id is null then
    new.truck_number := btrim(new.truck_number);
    return new;
  end if;

  select * into selected_unit
  from public.fleet_units
  where id = new.unit_id and organization_id = new.organization_id;

  if not found then
    raise foreign_key_violation using message = 'unit_id must belong to the same organization';
  end if;
  if selected_unit.unit_type <> 'Truck' then
    raise check_violation using message = 'unit_id must reference a Truck unit';
  end if;

  new.truck_number := selected_unit.unit_number;
  return new;
end;
$$;

create trigger ifta_trips_validate_unit
before insert or update on public.ifta_trips
for each row execute function public.validate_ifta_trip_unit();

with matches as (
  select trip.id, (array_agg(unit.id order by unit.id))[1] as unit_id
  from public.ifta_trips trip
  join public.fleet_units unit
    on unit.organization_id = trip.organization_id
   and unit.unit_type = 'Truck'
   and lower(btrim(unit.unit_number)) = lower(btrim(trip.truck_number))
  where trip.unit_id is null
  group by trip.id
  having count(*) = 1
)
update public.ifta_trips trip
set unit_id = matches.unit_id
from matches
where trip.id = matches.id;

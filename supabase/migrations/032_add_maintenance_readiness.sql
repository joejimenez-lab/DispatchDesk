-- Maintenance readiness and safe bulk initial setup.

alter table public.fleet_units
  add column odometer_updated_at timestamptz;

create or replace function public.track_fleet_odometer_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.odometer is not null and new.odometer_updated_at is null then
    new.odometer_updated_at := now();
  elsif tg_op = 'UPDATE' and new.odometer is distinct from old.odometer then
    new.odometer_updated_at := case when new.odometer is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger fleet_units_track_odometer_update
before insert or update of odometer on public.fleet_units
for each row execute function public.track_fleet_odometer_update();

create or replace function public.configure_maintenance_units(
  p_updates jsonb,
  p_apply_templates boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  target public.fleet_units%rowtype;
  requested_odometer integer;
  updated_count integer := 0;
  schedule_count integer := 0;
  inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    raise exception 'Select at least one fleet unit' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_updates)
  loop
    select * into target
    from public.fleet_units
    where id = (item ->> 'unit_id')::uuid
      and organization_id = public.current_organization_id()
    for update;

    if not found then
      raise exception 'Fleet unit not found' using errcode = 'P0002';
    end if;

    if item ? 'odometer' and item ->> 'odometer' is not null then
      requested_odometer := (item ->> 'odometer')::integer;
      if requested_odometer < 0 then
        raise exception 'Odometer cannot be negative' using errcode = '22023';
      end if;
      if target.odometer is not null and requested_odometer < target.odometer then
        raise exception 'Odometer cannot be lower than the current reading for unit %', target.unit_number using errcode = '22023';
      end if;
      update public.fleet_units
      set odometer = requested_odometer
      where id = target.id and organization_id = target.organization_id;
      target.odometer := requested_odometer;
      updated_count := updated_count + 1;
    end if;

    if p_apply_templates then
      insert into public.maintenance_reminders (
        organization_id, unit_id, reminder_type, due_date, due_odometer,
        interval_days, interval_miles, warning_days, warning_miles
      )
      select
        target.organization_id,
        target.id,
        template.reminder_type,
        case when template.interval_days is null then null else current_date + template.interval_days end,
        case when template.interval_miles is null or target.odometer is null then null else target.odometer + template.interval_miles end,
        template.interval_days,
        template.interval_miles,
        30,
        500
      from (
        values
          ('90-day inspection', 90, null::integer),
          ('Annual inspection', 365, null::integer),
          ('Monthly service', 30, null::integer),
          ('Oil change', null::integer, 5000)
      ) as template(reminder_type, interval_days, interval_miles)
      where (target.unit_type = 'Truck' or template.reminder_type not in ('Monthly service', 'Oil change'))
        and (template.interval_miles is null or target.odometer is not null)
        and not exists (
          select 1
          from public.maintenance_reminders existing
          where existing.organization_id = target.organization_id
            and existing.unit_id = target.id
            and existing.reminder_type = template.reminder_type
            and existing.completed_at is null
        );
      get diagnostics inserted_count = row_count;
      schedule_count := schedule_count + inserted_count;
    end if;
  end loop;

  return jsonb_build_object(
    'units_selected', jsonb_array_length(p_updates),
    'odometers_updated', updated_count,
    'schedules_created', schedule_count
  );
end;
$$;

revoke all on function public.configure_maintenance_units(jsonb, boolean) from public, anon;
grant execute on function public.configure_maintenance_units(jsonb, boolean) to authenticated;

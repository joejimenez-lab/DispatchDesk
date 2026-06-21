-- Daily repair logs are manual history entries, not recurring reminders.

alter table public.repair_logs
  add column log_type text not null default 'Repair'
  check (log_type in ('Repair', 'Daily repair log'));

-- Remove any active schedules created during the brief daily-reminder rollout.
-- Completed maintenance history remains untouched.
delete from public.maintenance_reminders
where reminder_type = 'Daily repair log'
  and completed_at is null;

create or replace function public.validate_maintenance_reminder_unit_type()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_unit_type public.unit_type;
begin
  if new.reminder_type = 'Daily repair log' then
    raise exception 'Daily repair logs are history entries, not maintenance schedules' using errcode = '23514';
  end if;

  select unit_type into target_unit_type
  from public.fleet_units
  where id = new.unit_id;

  if target_unit_type = 'Trailer' and new.reminder_type in ('Monthly service', 'Oil change') then
    raise exception '% is only available for trucks', new.reminder_type using errcode = '23514';
  end if;

  return new;
end;
$$;

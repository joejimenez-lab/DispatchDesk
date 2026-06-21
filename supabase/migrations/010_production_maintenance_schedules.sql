-- Production maintenance scheduling: recurrence, mileage alerts, snoozing,
-- audit attribution, duplicate prevention, and atomic completion/history.

alter table public.maintenance_reminders
  alter column due_date drop not null,
  add column due_odometer integer check (due_odometer >= 0),
  add column interval_days integer check (interval_days > 0),
  add column interval_miles integer check (interval_miles > 0),
  add column warning_days integer not null default 30 check (warning_days >= 0),
  add column warning_miles integer not null default 500 check (warning_miles >= 0),
  add column snoozed_until date,
  add column created_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column created_by_email text default (auth.jwt() ->> 'email'),
  add column completed_by uuid references auth.users(id) on delete set null,
  add column completed_by_email text,
  add column completion_record_table text check (completion_record_table in ('service_records', 'inspection_records', 'repair_logs')),
  add column completion_record_id uuid,
  add column updated_at timestamptz not null default now(),
  add constraint maintenance_reminders_due_target_check
    check (due_date is not null or due_odometer is not null);

update public.maintenance_reminders
set interval_days = case reminder_type
  when 'Monthly service' then 30
  when '90-day inspection' then 90
  when 'Annual inspection' then 365
  else interval_days
end
where interval_days is null;

drop index if exists public.maintenance_reminders_due_idx;

create index maintenance_reminders_due_idx
on public.maintenance_reminders (due_date, due_odometer, unit_id)
where completed_at is null;

create unique index maintenance_reminders_one_active_type_idx
on public.maintenance_reminders (unit_id, reminder_type)
where completed_at is null;

create trigger maintenance_reminders_set_updated_at
before update on public.maintenance_reminders
for each row execute function public.set_updated_at();

create or replace function public.complete_maintenance_reminder(
  p_reminder_id uuid,
  p_completed_date date default current_date,
  p_odometer integer default null,
  p_notes text default null,
  p_cost numeric default 0
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  reminder public.maintenance_reminders%rowtype;
  unit_odometer integer;
  history_id uuid;
  history_table text;
  next_due_date date;
  next_due_odometer integer;
  next_reminder_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_completed_date is null then
    raise exception 'Completion date is required' using errcode = '22023';
  end if;

  if p_odometer is not null and p_odometer < 0 then
    raise exception 'Odometer cannot be negative' using errcode = '22023';
  end if;

  if p_cost is null or p_cost < 0 then
    raise exception 'Cost cannot be negative' using errcode = '22023';
  end if;

  select * into reminder
  from public.maintenance_reminders
  where id = p_reminder_id
  for update;

  if not found then
    raise exception 'Maintenance reminder not found' using errcode = 'P0002';
  end if;

  if reminder.completed_at is not null then
    raise exception 'Maintenance reminder is already complete' using errcode = '23514';
  end if;

  select odometer into unit_odometer
  from public.fleet_units
  where id = reminder.unit_id;

  if reminder.reminder_type in ('Monthly service', 'Oil change') then
    insert into public.service_records (unit_id, service_date, odometer, description, cost, notes)
    values (reminder.unit_id, p_completed_date, p_odometer, reminder.reminder_type, p_cost, coalesce(p_notes, reminder.notes))
    returning id into history_id;
    history_table := 'service_records';
  elsif reminder.reminder_type in ('90-day inspection', 'Annual inspection') then
    insert into public.inspection_records (unit_id, inspection_date, odometer, inspector, result, notes)
    values (
      reminder.unit_id,
      p_completed_date,
      p_odometer,
      auth.jwt() ->> 'email',
      'Completed',
      coalesce(p_notes, reminder.notes)
    )
    returning id into history_id;
    history_table := 'inspection_records';
  else
    insert into public.repair_logs (unit_id, repair_date, odometer, description, cost, notes)
    values (
      reminder.unit_id,
      p_completed_date,
      p_odometer,
      'Repair follow-up completed',
      p_cost,
      coalesce(p_notes, reminder.notes)
    )
    returning id into history_id;
    history_table := 'repair_logs';
  end if;

  if p_odometer is not null then
    update public.fleet_units
    set odometer = greatest(coalesce(odometer, 0), p_odometer)
    where id = reminder.unit_id;
    unit_odometer := greatest(coalesce(unit_odometer, 0), p_odometer);
  end if;

  update public.maintenance_reminders
  set completed_at = now(),
      completed_by = auth.uid(),
      completed_by_email = auth.jwt() ->> 'email',
      completion_record_table = history_table,
      completion_record_id = history_id,
      snoozed_until = null
  where id = reminder.id;

  if reminder.interval_days is not null then
    next_due_date := p_completed_date + reminder.interval_days;
  end if;

  if reminder.interval_miles is not null then
    if coalesce(p_odometer, unit_odometer) is null then
      raise exception 'An odometer reading is required to schedule the next mileage reminder' using errcode = '22023';
    end if;
    next_due_odometer := coalesce(p_odometer, unit_odometer) + reminder.interval_miles;
  end if;

  if next_due_date is not null or next_due_odometer is not null then
    insert into public.maintenance_reminders (
      unit_id,
      reminder_type,
      due_date,
      due_odometer,
      interval_days,
      interval_miles,
      warning_days,
      warning_miles,
      notes,
      created_by,
      created_by_email
    ) values (
      reminder.unit_id,
      reminder.reminder_type,
      next_due_date,
      next_due_odometer,
      reminder.interval_days,
      reminder.interval_miles,
      reminder.warning_days,
      reminder.warning_miles,
      reminder.notes,
      auth.uid(),
      auth.jwt() ->> 'email'
    )
    returning id into next_reminder_id;
  end if;

  return next_reminder_id;
end;
$$;

revoke all on function public.complete_maintenance_reminder(uuid, date, integer, text, numeric) from public;
revoke all on function public.complete_maintenance_reminder(uuid, date, integer, text, numeric) from anon;
grant execute on function public.complete_maintenance_reminder(uuid, date, integer, text, numeric) to authenticated;

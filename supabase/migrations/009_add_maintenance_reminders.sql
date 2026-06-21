-- In-app maintenance reminders and dashboard alerts. (Issue #6)

create table public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.fleet_units(id) on delete cascade,
  reminder_type text not null check (reminder_type in (
    'Monthly service',
    '90-day inspection',
    'Annual inspection',
    'Oil change',
    'Repair follow-up'
  )),
  due_date date not null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index maintenance_reminders_due_idx
on public.maintenance_reminders (due_date, unit_id)
where completed_at is null;

alter table public.maintenance_reminders enable row level security;

create policy "Authenticated users can manage maintenance reminders"
on public.maintenance_reminders for all to authenticated
using (true) with check (true);

grant select, insert, update, delete on table public.maintenance_reminders to authenticated;

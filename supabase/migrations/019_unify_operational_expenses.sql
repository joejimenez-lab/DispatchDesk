-- Make Bookkeeping the authoritative ledger for operational spending while
-- preserving Maintenance and IFTA as focused source workflows. (Issue #47)

alter table public.inspection_records
  add column cost numeric(12, 2) not null default 0 check (cost >= 0);

alter table public.ifta_fuel_purchases
  add column unit_id uuid references public.fleet_units(id) on delete restrict,
  add column vendor text,
  add column updated_at timestamptz not null default now();

-- Safely recover the fleet relationship for historical fuel rows only where
-- the stored report truck number has exactly one fleet-truck match. Rows with
-- no match or multiple matches remain unlinked for reconciliation review.
with unique_truck_matches as (
  select f.id as purchase_id, (array_agg(u.id))[1] as unit_id
  from public.ifta_fuel_purchases f
  join public.fleet_units u
    on u.unit_type = 'Truck'
   and lower(trim(u.unit_number)) = lower(trim(f.truck_number))
  group by f.id
  having count(*) = 1
)
update public.ifta_fuel_purchases f
set unit_id = matches.unit_id
from unique_truck_matches matches
where f.id = matches.purchase_id;

create trigger ifta_fuel_purchases_set_updated_at
before update on public.ifta_fuel_purchases
for each row execute function public.set_updated_at();

create table public.bookkeeping_expense_groups (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  vendor text,
  notes text,
  unit_id uuid references public.fleet_units(id) on delete restrict,
  load_id uuid references public.loads(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual', 'maintenance', 'ifta')),
  source_id uuid,
  service_record_id uuid references public.service_records(id) on delete restrict,
  inspection_record_id uuid references public.inspection_records(id) on delete restrict,
  repair_log_id uuid references public.repair_logs(id) on delete restrict,
  ifta_fuel_purchase_id uuid references public.ifta_fuel_purchases(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookkeeping_groups_source_consistency check (
    (source_type = 'manual' and source_id is null and service_record_id is null and inspection_record_id is null and repair_log_id is null and ifta_fuel_purchase_id is null)
    or
    (source_type = 'maintenance' and source_id = coalesce(service_record_id, inspection_record_id, repair_log_id)
      and ((service_record_id is not null)::integer + (inspection_record_id is not null)::integer + (repair_log_id is not null)::integer) = 1
      and ifta_fuel_purchase_id is null)
    or
    (source_type = 'ifta' and source_id = ifta_fuel_purchase_id and ifta_fuel_purchase_id is not null
      and service_record_id is null and inspection_record_id is null and repair_log_id is null)
  )
);

create unique index bookkeeping_groups_source_idx
on public.bookkeeping_expense_groups(source_type, source_id)
where source_type <> 'manual';
create index bookkeeping_groups_date_idx on public.bookkeeping_expense_groups(expense_date desc, created_at desc);
create index bookkeeping_groups_unit_idx on public.bookkeeping_expense_groups(unit_id);
create index bookkeeping_groups_load_idx on public.bookkeeping_expense_groups(load_id);
create index bookkeeping_groups_driver_idx on public.bookkeeping_expense_groups(driver_id);

create trigger bookkeeping_expense_groups_set_updated_at
before update on public.bookkeeping_expense_groups
for each row execute function public.set_updated_at();

-- Preserve every existing expense as a one-line manual transaction. Reusing the
-- original expense id for the group keeps migration and audit mapping explicit.
with ranked_expenses as (
  select e.*,
    row_number() over (
      partition by coalesce(service_record_id, inspection_record_id, repair_log_id)
      order by created_at, id
    ) as source_rank
  from public.bookkeeping_expenses e
)
insert into public.bookkeeping_expense_groups (
  id, expense_date, vendor, notes, unit_id, load_id, driver_id,
  source_type, source_id, service_record_id, inspection_record_id, repair_log_id,
  created_by, created_by_email, created_at, updated_at
)
select
  id, expense_date, vendor, notes, unit_id, load_id, driver_id,
  case when coalesce(service_record_id, inspection_record_id, repair_log_id) is not null and source_rank = 1 then 'maintenance' else 'manual' end,
  case when source_rank = 1 then coalesce(service_record_id, inspection_record_id, repair_log_id) end,
  case when source_rank = 1 then service_record_id end,
  case when source_rank = 1 then inspection_record_id end,
  case when source_rank = 1 then repair_log_id end,
  created_by, created_by_email, created_at, updated_at
from ranked_expenses;

alter table public.bookkeeping_expenses
  add column group_id uuid,
  add column line_type text not null default 'total' check (line_type in ('total', 'labor', 'parts'));

update public.bookkeeping_expenses set group_id = id;
alter table public.bookkeeping_expenses alter column group_id set not null;
alter table public.bookkeeping_expenses
  add constraint bookkeeping_expenses_group_id_fkey foreign key (group_id)
  references public.bookkeeping_expense_groups(id) on delete cascade;
create unique index bookkeeping_expenses_group_line_idx on public.bookkeeping_expenses(group_id, line_type);
create index bookkeeping_expenses_category_idx_v2 on public.bookkeeping_expenses(category);

alter table public.bookkeeping_receipts add column group_id uuid;
update public.bookkeeping_receipts r
set group_id = e.group_id
from public.bookkeeping_expenses e
where e.id = r.expense_id;
alter table public.bookkeeping_receipts alter column group_id set not null;
alter table public.bookkeeping_receipts
  add constraint bookkeeping_receipts_group_id_fkey foreign key (group_id)
  references public.bookkeeping_expense_groups(id) on delete cascade;
create index bookkeeping_receipts_group_idx on public.bookkeeping_receipts(group_id, created_at desc);

drop index if exists public.bookkeeping_expenses_date_idx;
drop index if exists public.bookkeeping_expenses_category_idx;
drop index if exists public.bookkeeping_expenses_unit_idx;
drop index if exists public.bookkeeping_expenses_load_idx;
drop index if exists public.bookkeeping_expenses_driver_idx;
drop index if exists public.bookkeeping_expenses_service_record_idx;
drop index if exists public.bookkeeping_expenses_inspection_record_idx;
drop index if exists public.bookkeeping_expenses_repair_log_idx;
drop index if exists public.bookkeeping_receipts_expense_idx;

alter table public.bookkeeping_receipts drop column expense_id;
alter table public.bookkeeping_expenses
  drop constraint if exists bookkeeping_expenses_one_maintenance_record,
  drop column expense_date,
  drop column vendor,
  drop column notes,
  drop column unit_id,
  drop column load_id,
  drop column driver_id,
  drop column service_record_id,
  drop column inspection_record_id,
  drop column repair_log_id,
  drop column created_by,
  drop column created_by_email;

alter table public.bookkeeping_expense_groups enable row level security;
create policy "Authenticated users can manage bookkeeping expense groups"
on public.bookkeeping_expense_groups for all to authenticated using (true) with check (true);
grant select, insert, update, delete on table public.bookkeeping_expense_groups to authenticated;

-- Extend the recoverable object cleanup queue to bookkeeping receipts.
alter table public.storage_cleanup_jobs drop constraint storage_cleanup_jobs_source_check;
alter table public.storage_cleanup_jobs
  add constraint storage_cleanup_jobs_source_check
  check (source in ('delete_load', 'delete_document', 'upload_document', 'delete_bookkeeping', 'delete_ifta', 'upload_receipt'));
alter table public.storage_cleanup_jobs
  add column expense_group_id uuid;
create index storage_cleanup_jobs_expense_group_idx on public.storage_cleanup_jobs(expense_group_id);

create or replace function public.create_manual_bookkeeping_expense(
  p_group_id uuid,
  p_expense jsonb,
  p_receipt jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  maintenance_table text := nullif(p_expense ->> 'maintenance_table', '');
  maintenance_id uuid := nullif(p_expense ->> 'maintenance_id', '')::uuid;
  maintenance_unit_id uuid;
  selected_unit_id uuid := nullif(p_expense ->> 'unit_id', '')::uuid;
  amount numeric := (p_expense ->> 'amount')::numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  -- The form supplies a stable transaction id. A transport retry of the same
  -- successful submission returns the original transaction instead of adding a
  -- duplicate. UUID collisions with a different transaction remain errors.
  if exists (
    select 1 from public.bookkeeping_expense_groups
    where id = p_group_id
      and source_type in ('manual', 'maintenance')
      and created_by = auth.uid()
  ) then
    return p_group_id;
  end if;
  if amount <= 0 then raise exception 'Expense amount must be greater than zero' using errcode = '22023'; end if;
  if maintenance_id is not null and p_expense ->> 'category' not in ('Maintenance', 'Parts') then
    raise exception 'Linked maintenance expenses must use Maintenance or Parts' using errcode = '23514';
  end if;

  if maintenance_id is not null then
    if maintenance_table = 'service_records' then select unit_id into maintenance_unit_id from public.service_records where id = maintenance_id;
    elsif maintenance_table = 'inspection_records' then select unit_id into maintenance_unit_id from public.inspection_records where id = maintenance_id;
    elsif maintenance_table = 'repair_logs' then select unit_id into maintenance_unit_id from public.repair_logs where id = maintenance_id;
    else raise exception 'Choose a valid maintenance record' using errcode = '22023';
    end if;
    if maintenance_unit_id is null then raise exception 'Maintenance record not found' using errcode = 'P0002'; end if;
    if selected_unit_id is not null and selected_unit_id <> maintenance_unit_id then raise exception 'Maintenance record belongs to another unit' using errcode = '23514'; end if;
    selected_unit_id := maintenance_unit_id;
  end if;

  insert into public.bookkeeping_expense_groups (
    id, expense_date, vendor, notes, unit_id, load_id, driver_id,
    source_type, source_id, service_record_id, inspection_record_id, repair_log_id, created_by, created_by_email
  ) values (
    p_group_id,
    (p_expense ->> 'expense_date')::date,
    nullif(p_expense ->> 'vendor', ''),
    nullif(p_expense ->> 'notes', ''),
    selected_unit_id,
    nullif(p_expense ->> 'load_id', '')::uuid,
    nullif(p_expense ->> 'driver_id', '')::uuid,
    case when maintenance_id is null then 'manual' else 'maintenance' end,
    maintenance_id,
    case when maintenance_table = 'service_records' then maintenance_id end,
    case when maintenance_table = 'inspection_records' then maintenance_id end,
    case when maintenance_table = 'repair_logs' then maintenance_id end,
    auth.uid(), auth.jwt() ->> 'email'
  );

  insert into public.bookkeeping_expenses (group_id, category, amount, line_type)
  values (p_group_id, (p_expense ->> 'category')::public.expense_category, amount, 'total');

  if maintenance_table = 'service_records' then update public.service_records set cost = amount where id = maintenance_id;
  elsif maintenance_table = 'inspection_records' then update public.inspection_records set cost = amount where id = maintenance_id;
  elsif maintenance_table = 'repair_logs' then update public.repair_logs set cost = amount where id = maintenance_id;
  end if;

  if p_receipt is not null then
    insert into public.bookkeeping_receipts (group_id, file_name, storage_path, content_type, file_size)
    values (p_group_id, p_receipt ->> 'file_name', p_receipt ->> 'storage_path', p_receipt ->> 'content_type', (p_receipt ->> 'file_size')::integer);
  end if;
  return p_group_id;
end;
$$;

create or replace function public.update_bookkeeping_expense_group(
  p_group_id uuid,
  p_expense jsonb,
  p_lines jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  group_row public.bookkeeping_expense_groups%rowtype;
  line jsonb;
  line_total numeric := 0;
  selected_truck_number text;
  selected_unit_id uuid := nullif(p_expense ->> 'unit_id', '')::uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into group_row from public.bookkeeping_expense_groups where id = p_group_id for update;
  if not found then raise exception 'Bookkeeping transaction not found' using errcode = 'P0002'; end if;
  if group_row.source_type <> 'manual' and selected_unit_id is null then
    raise exception 'Source-linked expenses require a fleet unit' using errcode = '23514';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one expense line is required' using errcode = '22023';
  end if;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    if (line ->> 'amount')::numeric <= 0 then raise exception 'Expense amounts must be greater than zero' using errcode = '22023'; end if;
    line_total := line_total + (line ->> 'amount')::numeric;
  end loop;

  if group_row.source_type = 'ifta' and (
    jsonb_array_length(p_lines) <> 1 or p_lines -> 0 ->> 'category' <> 'Fuel' or p_lines -> 0 ->> 'line_type' <> 'total'
  ) then raise exception 'IFTA transactions must remain a single Fuel line' using errcode = '23514'; end if;

  update public.bookkeeping_expense_groups
  set expense_date = (p_expense ->> 'expense_date')::date,
      vendor = nullif(p_expense ->> 'vendor', ''),
      notes = nullif(p_expense ->> 'notes', ''),
      unit_id = selected_unit_id,
      load_id = nullif(p_expense ->> 'load_id', '')::uuid,
      driver_id = nullif(p_expense ->> 'driver_id', '')::uuid
  where id = p_group_id;

  delete from public.bookkeeping_expenses where group_id = p_group_id;
  for line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.bookkeeping_expenses (group_id, category, amount, line_type)
    values (p_group_id, (line ->> 'category')::public.expense_category, (line ->> 'amount')::numeric, line ->> 'line_type');
  end loop;

  if group_row.service_record_id is not null then
    update public.service_records set unit_id = selected_unit_id, service_date = (p_expense ->> 'expense_date')::date, cost = line_total, notes = nullif(p_expense ->> 'notes', '') where id = group_row.service_record_id;
  elsif group_row.inspection_record_id is not null then
    update public.inspection_records set unit_id = selected_unit_id, inspection_date = (p_expense ->> 'expense_date')::date, cost = line_total, notes = nullif(p_expense ->> 'notes', '') where id = group_row.inspection_record_id;
  elsif group_row.repair_log_id is not null then
    update public.repair_logs set unit_id = selected_unit_id, repair_date = (p_expense ->> 'expense_date')::date, cost = line_total, notes = nullif(p_expense ->> 'notes', '') where id = group_row.repair_log_id;
  elsif group_row.ifta_fuel_purchase_id is not null then
    select fleet_units.unit_number into selected_truck_number from public.fleet_units
    where id = selected_unit_id and unit_type = 'Truck';
    if selected_truck_number is null then raise exception 'Choose a truck for an IFTA fuel expense' using errcode = '23514'; end if;
    update public.ifta_fuel_purchases
    set purchase_date = (p_expense ->> 'expense_date')::date,
        amount_paid = line_total,
        vendor = nullif(p_expense ->> 'vendor', ''),
        notes = nullif(p_expense ->> 'notes', ''),
        unit_id = selected_unit_id,
        truck_number = selected_truck_number
    where id = group_row.ifta_fuel_purchase_id;
  end if;
end;
$$;

create or replace function public.complete_maintenance_with_expense(
  p_reminder_id uuid,
  p_completed_date date,
  p_odometer integer,
  p_notes text,
  p_cost_mode text,
  p_total_cost numeric,
  p_labor_cost numeric,
  p_parts_cost numeric,
  p_vendor text,
  p_group_id uuid,
  p_receipt jsonb default null
)
returns jsonb
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
  existing_group_id uuid;
  final_cost numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_completed_date is null then raise exception 'Completion date is required' using errcode = '22023'; end if;
  if p_odometer is not null and p_odometer < 0 then raise exception 'Odometer cannot be negative' using errcode = '22023'; end if;
  if p_cost_mode not in ('total', 'breakdown') then raise exception 'Choose a valid cost mode' using errcode = '22023'; end if;
  if coalesce(p_total_cost, 0) < 0 or coalesce(p_labor_cost, 0) < 0 or coalesce(p_parts_cost, 0) < 0 then
    raise exception 'Costs cannot be negative' using errcode = '22023';
  end if;
  final_cost := case when p_cost_mode = 'breakdown' then coalesce(p_labor_cost, 0) + coalesce(p_parts_cost, 0) else coalesce(p_total_cost, 0) end;
  if final_cost = 0 and p_receipt is not null then raise exception 'A receipt requires a positive expense amount' using errcode = '23514'; end if;

  select * into reminder from public.maintenance_reminders where id = p_reminder_id for update;
  if not found then raise exception 'Maintenance reminder not found' using errcode = 'P0002'; end if;
  if reminder.completed_at is not null then
    select id into existing_group_id from public.bookkeeping_expense_groups
    where id = p_group_id and source_id = reminder.completion_record_id;
    if final_cost = 0 or existing_group_id is not null then
      return jsonb_build_object(
        'history_id', reminder.completion_record_id,
        'history_table', reminder.completion_record_table,
        'expense_group_id', existing_group_id,
        'next_reminder_id', null
      );
    end if;
    raise exception 'Maintenance reminder is already complete' using errcode = '23514';
  end if;
  select odometer into unit_odometer from public.fleet_units where id = reminder.unit_id;
  perform set_config('dispatchdesk.skip_maintenance_expense_trigger', 'true', true);

  if reminder.reminder_type in ('Monthly service', 'Oil change') then
    insert into public.service_records (unit_id, service_date, odometer, description, cost, notes)
    values (reminder.unit_id, p_completed_date, p_odometer, reminder.reminder_type, final_cost, coalesce(p_notes, reminder.notes)) returning id into history_id;
    history_table := 'service_records';
  elsif reminder.reminder_type in ('90-day inspection', 'Annual inspection') then
    insert into public.inspection_records (unit_id, inspection_date, odometer, inspector, result, cost, notes)
    values (reminder.unit_id, p_completed_date, p_odometer, auth.jwt() ->> 'email', 'Completed', final_cost, coalesce(p_notes, reminder.notes)) returning id into history_id;
    history_table := 'inspection_records';
  else
    insert into public.repair_logs (unit_id, repair_date, odometer, description, cost, notes)
    values (reminder.unit_id, p_completed_date, p_odometer, reminder.reminder_type || ' completed', final_cost, coalesce(p_notes, reminder.notes)) returning id into history_id;
    history_table := 'repair_logs';
  end if;
  perform set_config('dispatchdesk.skip_maintenance_expense_trigger', 'false', true);

  if final_cost > 0 then
    insert into public.bookkeeping_expense_groups (
      id, expense_date, vendor, notes, unit_id, source_type, source_id,
      service_record_id, inspection_record_id, repair_log_id, created_by, created_by_email
    ) values (
      p_group_id, p_completed_date, nullif(trim(p_vendor), ''), p_notes, reminder.unit_id, 'maintenance', history_id,
      case when history_table = 'service_records' then history_id end,
      case when history_table = 'inspection_records' then history_id end,
      case when history_table = 'repair_logs' then history_id end,
      auth.uid(), auth.jwt() ->> 'email'
    );
    if p_cost_mode = 'total' then
      insert into public.bookkeeping_expenses (group_id, category, amount, line_type) values (p_group_id, 'Maintenance', final_cost, 'total');
    else
      if coalesce(p_labor_cost, 0) > 0 then insert into public.bookkeeping_expenses (group_id, category, amount, line_type) values (p_group_id, 'Maintenance', p_labor_cost, 'labor'); end if;
      if coalesce(p_parts_cost, 0) > 0 then insert into public.bookkeeping_expenses (group_id, category, amount, line_type) values (p_group_id, 'Parts', p_parts_cost, 'parts'); end if;
    end if;
    if p_receipt is not null then
      insert into public.bookkeeping_receipts (group_id, file_name, storage_path, content_type, file_size)
      values (p_group_id, p_receipt ->> 'file_name', p_receipt ->> 'storage_path', p_receipt ->> 'content_type', (p_receipt ->> 'file_size')::integer);
    end if;
  end if;

  if p_odometer is not null then
    update public.fleet_units set odometer = greatest(coalesce(odometer, 0), p_odometer) where id = reminder.unit_id;
    unit_odometer := greatest(coalesce(unit_odometer, 0), p_odometer);
  end if;
  update public.maintenance_reminders set completed_at = now(), completed_by = auth.uid(), completed_by_email = auth.jwt() ->> 'email',
    completion_record_table = history_table, completion_record_id = history_id, snoozed_until = null where id = reminder.id;
  if reminder.interval_days is not null then next_due_date := p_completed_date + reminder.interval_days; end if;
  if reminder.interval_miles is not null then
    if coalesce(p_odometer, unit_odometer) is null then raise exception 'An odometer reading is required to schedule the next mileage reminder' using errcode = '22023'; end if;
    next_due_odometer := coalesce(p_odometer, unit_odometer) + reminder.interval_miles;
  end if;
  if next_due_date is not null or next_due_odometer is not null then
    insert into public.maintenance_reminders (unit_id, reminder_type, due_date, due_odometer, interval_days, interval_miles, warning_days, warning_miles, notes, created_by, created_by_email)
    values (reminder.unit_id, reminder.reminder_type, next_due_date, next_due_odometer, reminder.interval_days, reminder.interval_miles, reminder.warning_days, reminder.warning_miles, reminder.notes, auth.uid(), auth.jwt() ->> 'email')
    returning id into next_reminder_id;
  end if;
  return jsonb_build_object('history_id', history_id, 'history_table', history_table, 'expense_group_id', case when final_cost > 0 then p_group_id end, 'next_reminder_id', next_reminder_id);
end;
$$;

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
declare result jsonb;
begin
  result := public.complete_maintenance_with_expense(p_reminder_id, p_completed_date, p_odometer, p_notes, 'total', p_cost, 0, 0, null, gen_random_uuid(), null);
  return nullif(result ->> 'next_reminder_id', '')::uuid;
end;
$$;

create or replace function public.save_ifta_fuel_purchase_with_expense(
  p_purchase_id uuid,
  p_group_id uuid,
  p_purchase jsonb,
  p_receipt jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  truck public.fleet_units%rowtype;
  existing_group_id uuid;
  purchase_amount numeric := (p_purchase ->> 'amount_paid')::numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if purchase_amount <= 0 then raise exception 'Fuel amount must be greater than zero' using errcode = '22023'; end if;
  select * into truck from public.fleet_units where id = (p_purchase ->> 'unit_id')::uuid and unit_type = 'Truck';
  if not found then raise exception 'Choose a valid fleet truck' using errcode = '23514'; end if;

  select id into existing_group_id from public.bookkeeping_expense_groups where ifta_fuel_purchase_id = p_purchase_id for update;
  if exists (select 1 from public.ifta_fuel_purchases where id = p_purchase_id) then
    update public.ifta_fuel_purchases set
      unit_id = truck.id, truck_number = truck.unit_number, purchase_date = (p_purchase ->> 'purchase_date')::date,
      city = nullif(p_purchase ->> 'city', ''), state = p_purchase ->> 'state', gallons = (p_purchase ->> 'gallons')::numeric,
      amount_paid = purchase_amount, vendor = nullif(p_purchase ->> 'vendor', ''), notes = nullif(p_purchase ->> 'notes', '')
    where id = p_purchase_id;
    if existing_group_id is null then raise exception 'Linked Bookkeeping transaction is missing' using errcode = '23514'; end if;
    update public.bookkeeping_expense_groups set expense_date = (p_purchase ->> 'purchase_date')::date, vendor = nullif(p_purchase ->> 'vendor', ''),
      notes = nullif(p_purchase ->> 'notes', ''), unit_id = truck.id where id = existing_group_id;
    update public.bookkeeping_expenses set amount = purchase_amount where group_id = existing_group_id and category = 'Fuel';
    return existing_group_id;
  end if;

  insert into public.ifta_fuel_purchases (id, unit_id, truck_number, purchase_date, city, state, gallons, amount_paid, vendor, notes)
  values (p_purchase_id, truck.id, truck.unit_number, (p_purchase ->> 'purchase_date')::date, nullif(p_purchase ->> 'city', ''), p_purchase ->> 'state',
    (p_purchase ->> 'gallons')::numeric, purchase_amount, nullif(p_purchase ->> 'vendor', ''), nullif(p_purchase ->> 'notes', ''));
  insert into public.bookkeeping_expense_groups (id, expense_date, vendor, notes, unit_id, source_type, source_id, ifta_fuel_purchase_id, created_by, created_by_email)
  values (p_group_id, (p_purchase ->> 'purchase_date')::date, nullif(p_purchase ->> 'vendor', ''), nullif(p_purchase ->> 'notes', ''), truck.id,
    'ifta', p_purchase_id, p_purchase_id, auth.uid(), auth.jwt() ->> 'email');
  insert into public.bookkeeping_expenses (group_id, category, amount, line_type) values (p_group_id, 'Fuel', purchase_amount, 'total');
  if p_receipt is not null then
    insert into public.bookkeeping_receipts (group_id, file_name, storage_path, content_type, file_size)
    values (p_group_id, p_receipt ->> 'file_name', p_receipt ->> 'storage_path', p_receipt ->> 'content_type', (p_receipt ->> 'file_size')::integer);
  end if;
  return p_group_id;
end;
$$;

create or replace function public.queue_bookkeeping_group_delete(p_group_id uuid, p_allow_source text default null)
returns table (job_id uuid, bucket_id text, storage_path text, expense_group_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare group_row public.bookkeeping_expense_groups%rowtype; receipt_row public.bookkeeping_receipts%rowtype; cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into group_row from public.bookkeeping_expense_groups where id = p_group_id for update;
  if not found then raise exception 'Bookkeeping transaction not found' using errcode = 'P0002'; end if;
  if group_row.source_type <> 'manual' and group_row.source_type is distinct from p_allow_source then
    raise exception 'Source-linked transactions must be deleted from their source workflow' using errcode = '23514';
  end if;
  for receipt_row in select * from public.bookkeeping_receipts where group_id = p_group_id for update loop
    insert into public.storage_cleanup_jobs (bucket_id, storage_path, source, expense_group_id)
    values ('bookkeeping-receipts', receipt_row.storage_path, case when p_allow_source = 'ifta' then 'delete_ifta' else 'delete_bookkeeping' end, p_group_id)
    on conflict on constraint storage_cleanup_jobs_bucket_id_storage_path_key do update set source = excluded.source, expense_group_id = excluded.expense_group_id, last_error = null, last_attempted_at = null
    returning * into cleanup_job;
    job_id := cleanup_job.id; bucket_id := cleanup_job.bucket_id; storage_path := cleanup_job.storage_path; expense_group_id := p_group_id; return next;
  end loop;
  delete from public.bookkeeping_expense_groups where id = p_group_id;
end;
$$;

create or replace function public.delete_ifta_fuel_purchase_with_expense(p_purchase_id uuid)
returns table (job_id uuid, bucket_id text, storage_path text, expense_group_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare group_id uuid; cleanup record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.ifta_fuel_purchases where id = p_purchase_id for update;
  if not found then raise exception 'Fuel purchase not found' using errcode = 'P0002'; end if;
  select id into group_id from public.bookkeeping_expense_groups where ifta_fuel_purchase_id = p_purchase_id;
  if group_id is not null then
    for cleanup in select * from public.queue_bookkeeping_group_delete(group_id, 'ifta') loop
      job_id := cleanup.job_id; bucket_id := cleanup.bucket_id; storage_path := cleanup.storage_path; expense_group_id := cleanup.expense_group_id; return next;
    end loop;
  end if;
  delete from public.ifta_fuel_purchases where id = p_purchase_id;
end;
$$;

create or replace function public.queue_bookkeeping_receipt_delete(p_receipt_id uuid)
returns table (job_id uuid, bucket_id text, storage_path text, expense_group_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare receipt_row public.bookkeeping_receipts%rowtype; cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into receipt_row from public.bookkeeping_receipts where id = p_receipt_id for update;
  if not found then raise exception 'Receipt not found' using errcode = 'P0002'; end if;
  insert into public.storage_cleanup_jobs (bucket_id, storage_path, source, expense_group_id)
  values ('bookkeeping-receipts', receipt_row.storage_path, 'delete_bookkeeping', receipt_row.group_id)
  on conflict on constraint storage_cleanup_jobs_bucket_id_storage_path_key do update set source = excluded.source, expense_group_id = excluded.expense_group_id, last_error = null, last_attempted_at = null
  returning * into cleanup_job;
  delete from public.bookkeeping_receipts where id = receipt_row.id;
  job_id := cleanup_job.id; bucket_id := cleanup_job.bucket_id; storage_path := cleanup_job.storage_path; expense_group_id := receipt_row.group_id; return next;
end;
$$;

create or replace function public.reconcile_operational_expenses(p_apply boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_row record;
  candidate_id uuid;
  candidate_count integer;
  created_count integer := 0;
  matched_count integer := 0;
  skipped_count integer := 0;
  ambiguous_count integer := 0;
  new_group_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  for source_row in
    select 'service'::text kind, s.id source_id, s.unit_id, s.service_date expense_date, s.cost amount, s.notes, 'Maintenance'::public.expense_category category
    from public.service_records s where s.cost > 0
    union all
    select 'inspection', i.id, i.unit_id, i.inspection_date, i.cost, i.notes, 'Maintenance'::public.expense_category from public.inspection_records i where i.cost > 0
    union all
    select 'repair', r.id, r.unit_id, r.repair_date, r.cost, r.notes, 'Maintenance'::public.expense_category from public.repair_logs r where r.cost > 0
    union all
    select 'ifta', f.id, f.unit_id, f.purchase_date, f.amount_paid, f.notes, 'Fuel'::public.expense_category from public.ifta_fuel_purchases f where f.amount_paid > 0
  loop
    if exists (select 1 from public.bookkeeping_expense_groups g where g.source_id = source_row.source_id and g.source_type <> 'manual') then
      skipped_count := skipped_count + 1; continue;
    end if;
    if source_row.kind = 'ifta' and source_row.unit_id is null then
      ambiguous_count := ambiguous_count + 1; continue;
    end if;
    select count(*), (array_agg(candidate.id))[1] into candidate_count, candidate_id
    from (
      select g.id
      from public.bookkeeping_expense_groups g join public.bookkeeping_expenses e on e.group_id = g.id
      where g.source_type = 'manual' and g.unit_id = source_row.unit_id and g.expense_date = source_row.expense_date
      group by g.id
      having sum(e.amount) = source_row.amount
        and (
          (source_row.kind = 'ifta' and bool_and(e.category = 'Fuel'))
          or
          (source_row.kind <> 'ifta' and bool_and(e.category in ('Maintenance', 'Parts')))
        )
    ) candidate;
    if candidate_count = 1 then
      matched_count := matched_count + 1;
      if p_apply then
        update public.bookkeeping_expense_groups set source_type = case when source_row.kind = 'ifta' then 'ifta' else 'maintenance' end,
          source_id = source_row.source_id,
          service_record_id = case when source_row.kind = 'service' then source_row.source_id end,
          inspection_record_id = case when source_row.kind = 'inspection' then source_row.source_id end,
          repair_log_id = case when source_row.kind = 'repair' then source_row.source_id end,
          ifta_fuel_purchase_id = case when source_row.kind = 'ifta' then source_row.source_id end
        where id = candidate_id;
      end if;
    elsif candidate_count > 1 then ambiguous_count := ambiguous_count + 1;
    else
      created_count := created_count + 1;
      if p_apply then
        new_group_id := gen_random_uuid();
        insert into public.bookkeeping_expense_groups (id, expense_date, notes, unit_id, source_type, source_id, service_record_id, inspection_record_id, repair_log_id, ifta_fuel_purchase_id, created_by, created_by_email)
        values (new_group_id, source_row.expense_date, source_row.notes, source_row.unit_id, case when source_row.kind = 'ifta' then 'ifta' else 'maintenance' end, source_row.source_id,
          case when source_row.kind = 'service' then source_row.source_id end, case when source_row.kind = 'inspection' then source_row.source_id end,
          case when source_row.kind = 'repair' then source_row.source_id end, case when source_row.kind = 'ifta' then source_row.source_id end, auth.uid(), auth.jwt() ->> 'email');
        insert into public.bookkeeping_expenses (group_id, category, amount, line_type) values (new_group_id, source_row.category, source_row.amount, 'total');
      end if;
    end if;
  end loop;
  return jsonb_build_object('created', created_count, 'matched', matched_count, 'skipped', skipped_count, 'ambiguous', ambiguous_count, 'applied', p_apply);
end;
$$;

create or replace function public.create_expense_for_manual_maintenance_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare group_id uuid := gen_random_uuid(); record_date date; record_notes text; record_cost numeric;
begin
  if current_setting('dispatchdesk.skip_maintenance_expense_trigger', true) = 'true' then return new; end if;
  if tg_table_name = 'service_records' then record_date := new.service_date; record_notes := new.notes; record_cost := new.cost;
  elsif tg_table_name = 'inspection_records' then record_date := new.inspection_date; record_notes := new.notes; record_cost := new.cost;
  else record_date := new.repair_date; record_notes := new.notes; record_cost := new.cost;
  end if;
  if coalesce(record_cost, 0) = 0 then return new; end if;
  insert into public.bookkeeping_expense_groups (
    id, expense_date, notes, unit_id, source_type, source_id,
    service_record_id, inspection_record_id, repair_log_id, created_by, created_by_email
  ) values (
    group_id, coalesce(record_date, current_date), record_notes, new.unit_id, 'maintenance', new.id,
    case when tg_table_name = 'service_records' then new.id end,
    case when tg_table_name = 'inspection_records' then new.id end,
    case when tg_table_name = 'repair_logs' then new.id end,
    auth.uid(), auth.jwt() ->> 'email'
  );
  insert into public.bookkeeping_expenses (group_id, category, amount, line_type)
  values (group_id, 'Maintenance', record_cost, 'total');
  return new;
end;
$$;

create trigger service_records_create_expense after insert on public.service_records
for each row execute function public.create_expense_for_manual_maintenance_history();
create trigger inspection_records_create_expense after insert on public.inspection_records
for each row execute function public.create_expense_for_manual_maintenance_history();
create trigger repair_logs_create_expense after insert on public.repair_logs
for each row execute function public.create_expense_for_manual_maintenance_history();

revoke all on function public.create_manual_bookkeeping_expense(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.update_bookkeeping_expense_group(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.complete_maintenance_with_expense(uuid, date, integer, text, text, numeric, numeric, numeric, text, uuid, jsonb) from public, anon;
revoke all on function public.save_ifta_fuel_purchase_with_expense(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.queue_bookkeeping_group_delete(uuid, text) from public, anon;
revoke all on function public.delete_ifta_fuel_purchase_with_expense(uuid) from public, anon;
revoke all on function public.queue_bookkeeping_receipt_delete(uuid) from public, anon;
revoke all on function public.reconcile_operational_expenses(boolean) from public, anon;
grant execute on function public.create_manual_bookkeeping_expense(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.update_bookkeeping_expense_group(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.complete_maintenance_with_expense(uuid, date, integer, text, text, numeric, numeric, numeric, text, uuid, jsonb) to authenticated;
grant execute on function public.save_ifta_fuel_purchase_with_expense(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.queue_bookkeeping_group_delete(uuid, text) to authenticated;
grant execute on function public.delete_ifta_fuel_purchase_with_expense(uuid) to authenticated;
grant execute on function public.queue_bookkeeping_receipt_delete(uuid) to authenticated;
grant execute on function public.reconcile_operational_expenses(boolean) to authenticated;

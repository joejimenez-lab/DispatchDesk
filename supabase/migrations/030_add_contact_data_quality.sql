-- Auditable, tenant-safe contact merging. Duplicate detection remains advisory
-- in the application; only an explicit call to one of these functions mutates
-- contact records.

create table public.contact_merge_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_type text not null check (contact_type in ('broker', 'driver')),
  survivor_id uuid not null,
  duplicate_id uuid not null,
  survivor_before jsonb not null,
  duplicate_before jsonb not null,
  survivor_after jsonb not null,
  reassigned_records jsonb not null default '{}'::jsonb,
  merged_by uuid not null,
  merged_by_email text,
  created_at timestamptz not null default now(),
  check (survivor_id <> duplicate_id)
);

create index contact_merge_logs_organization_created_idx
on public.contact_merge_logs(organization_id, created_at desc);

alter table public.contact_merge_logs enable row level security;

create policy "Members can read contact merge history"
on public.contact_merge_logs for select to authenticated
using (organization_id = public.current_organization_id());

grant select on table public.contact_merge_logs to authenticated;

create or replace function public.merge_broker_records(
  p_survivor_id uuid,
  p_duplicate_id uuid,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organization uuid := public.current_organization_id();
  actor uuid := auth.uid();
  survivor public.brokers%rowtype;
  duplicate public.brokers%rowtype;
  merged public.brokers%rowtype;
  load_count integer := 0;
begin
  if actor is null or organization is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_survivor_id = p_duplicate_id then
    raise exception 'Choose two different broker records' using errcode = '22023';
  end if;

  select * into survivor from public.brokers
  where id = p_survivor_id and organization_id = organization
  for update;
  select * into duplicate from public.brokers
  where id = p_duplicate_id and organization_id = organization
  for update;
  if survivor.id is null or duplicate.id is null then
    raise exception 'Both broker records must belong to the current organization' using errcode = '42501';
  end if;

  update public.brokers set
    company_name = coalesce(nullif(trim(p_values ->> 'company_name'), ''), survivor.company_name),
    contact_name = nullif(trim(p_values ->> 'contact_name'), ''),
    phone = nullif(trim(p_values ->> 'phone'), ''),
    email = nullif(trim(p_values ->> 'email'), ''),
    notes = nullif(trim(p_values ->> 'notes'), '')
  where id = survivor.id and organization_id = organization
  returning * into merged;

  update public.loads set broker_id = survivor.id
  where broker_id = duplicate.id and organization_id = organization;
  get diagnostics load_count = row_count;

  delete from public.brokers
  where id = duplicate.id and organization_id = organization;

  insert into public.contact_merge_logs (
    organization_id, contact_type, survivor_id, duplicate_id,
    survivor_before, duplicate_before, survivor_after, reassigned_records,
    merged_by, merged_by_email
  ) values (
    organization, 'broker', survivor.id, duplicate.id,
    to_jsonb(survivor), to_jsonb(duplicate), to_jsonb(merged),
    jsonb_build_object('loads', load_count),
    actor, auth.jwt() ->> 'email'
  );

  return jsonb_build_object('survivor_id', survivor.id, 'loads_reassigned', load_count);
end;
$$;

create or replace function public.merge_driver_records(
  p_survivor_id uuid,
  p_duplicate_id uuid,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organization uuid := public.current_organization_id();
  actor uuid := auth.uid();
  survivor public.drivers%rowtype;
  duplicate public.drivers%rowtype;
  merged public.drivers%rowtype;
  load_count integer := 0;
  expense_count integer := 0;
begin
  if actor is null or organization is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if p_survivor_id = p_duplicate_id then
    raise exception 'Choose two different driver records' using errcode = '22023';
  end if;

  select * into survivor from public.drivers
  where id = p_survivor_id and organization_id = organization
  for update;
  select * into duplicate from public.drivers
  where id = p_duplicate_id and organization_id = organization
  for update;
  if survivor.id is null or duplicate.id is null then
    raise exception 'Both driver records must belong to the current organization' using errcode = '42501';
  end if;

  update public.drivers set
    name = coalesce(nullif(trim(p_values ->> 'name'), ''), survivor.name),
    phone = nullif(trim(p_values ->> 'phone'), ''),
    email = nullif(trim(p_values ->> 'email'), ''),
    truck_number = nullif(trim(p_values ->> 'truck_number'), ''),
    trailer_number = nullif(trim(p_values ->> 'trailer_number'), ''),
    notes = nullif(trim(p_values ->> 'notes'), '')
  where id = survivor.id and organization_id = organization
  returning * into merged;

  update public.loads set driver_id = survivor.id
  where driver_id = duplicate.id and organization_id = organization;
  get diagnostics load_count = row_count;

  update public.bookkeeping_expense_groups set driver_id = survivor.id
  where driver_id = duplicate.id and organization_id = organization;
  get diagnostics expense_count = row_count;

  delete from public.drivers
  where id = duplicate.id and organization_id = organization;

  insert into public.contact_merge_logs (
    organization_id, contact_type, survivor_id, duplicate_id,
    survivor_before, duplicate_before, survivor_after, reassigned_records,
    merged_by, merged_by_email
  ) values (
    organization, 'driver', survivor.id, duplicate.id,
    to_jsonb(survivor), to_jsonb(duplicate), to_jsonb(merged),
    jsonb_build_object('loads', load_count, 'bookkeeping_expense_groups', expense_count),
    actor, auth.jwt() ->> 'email'
  );

  return jsonb_build_object(
    'survivor_id', survivor.id,
    'loads_reassigned', load_count,
    'bookkeeping_expense_groups_reassigned', expense_count
  );
end;
$$;

revoke all on function public.merge_broker_records(uuid, uuid, jsonb) from public, anon;
revoke all on function public.merge_driver_records(uuid, uuid, jsonb) from public, anon;
grant execute on function public.merge_broker_records(uuid, uuid, jsonb) to authenticated;
grant execute on function public.merge_driver_records(uuid, uuid, jsonb) to authenticated;

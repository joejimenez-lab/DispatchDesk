-- Isolate every operational record by organization. Existing business data is
-- assigned to the demo organization; every other existing or future Auth user
-- receives a separate, empty organization.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create index organization_members_organization_idx
on public.organization_members(organization_id);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- This stable ID is used only for the committed fictional demo dataset.
insert into public.organizations (id, name, is_demo)
values ('00000000-0000-4000-8000-000000000001', 'DispatchDesk Demo', true);

-- The hosted demo login and the local seed identity share the demo workspace.
insert into public.organization_members (user_id, organization_id, role)
select id, '00000000-0000-4000-8000-000000000001', 'owner'
from auth.users
where lower(email) in (
  'dispatchdesk123@maildrop.cc',
  'andres.castillo@dispatchdesk.demo'
)
on conflict (user_id) do nothing;

-- Any other account that already exists gets its own clean workspace. This
-- assigns dcgemscorp@gmail.com to production without coupling isolation to a
-- hard-coded user UUID.
do $$
declare
  account record;
  new_organization_id uuid;
begin
  for account in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1 from public.organization_members m where m.user_id = u.id
    )
  loop
    new_organization_id := gen_random_uuid();

    insert into public.organizations (id, name)
    values (
      new_organization_id,
      coalesce(
        nullif(account.raw_user_meta_data ->> 'company_name', ''),
        nullif(account.raw_user_meta_data ->> 'full_name', ''),
        case
          when lower(account.email) = 'dcgemscorp@gmail.com' then 'DCG EMS Corp'
          else split_part(account.email, '@', 1)
        end,
        'Workspace'
      )
    );

    insert into public.organization_members (user_id, organization_id, role)
    values (account.id, new_organization_id, 'owner');
  end loop;
end;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
$$;

revoke all on function public.current_organization_id() from public, anon;
grant execute on function public.current_organization_id() to authenticated;

create policy "Members can read their organization"
on public.organizations for select to authenticated
using (id = public.current_organization_id());

create policy "Members can read their membership"
on public.organization_members for select to authenticated
using (user_id = auth.uid());

grant select on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;

-- Provision an isolated workspace whenever a user is created from now on.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  target_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);

  if exists (select 1 from public.organization_members where user_id = new.id) then
    return new;
  end if;

  if lower(new.email) in (
    'dispatchdesk123@maildrop.cc',
    'andres.castillo@dispatchdesk.demo'
  ) then
    target_organization_id := '00000000-0000-4000-8000-000000000001';
  else
    target_organization_id := gen_random_uuid();
    target_name := coalesce(
      nullif(new.raw_user_meta_data ->> 'company_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      case
        when lower(new.email) = 'dcgemscorp@gmail.com' then 'DCG EMS Corp'
        else split_part(new.email, '@', 1)
      end,
      'Workspace'
    );

    insert into public.organizations (id, name)
    values (target_organization_id, target_name);
  end if;

  insert into public.organization_members (user_id, organization_id, role)
  values (new.id, target_organization_id, 'owner');

  return new;
end;
$$;

-- Add ownership to every table that contains tenant business data.
alter table public.drivers add column organization_id uuid;
alter table public.brokers add column organization_id uuid;
alter table public.loads add column organization_id uuid;
alter table public.payments add column organization_id uuid;
alter table public.documents add column organization_id uuid;
alter table public.notes add column organization_id uuid;
alter table public.activity_logs add column organization_id uuid;
alter table public.fleet_units add column organization_id uuid;
alter table public.service_records add column organization_id uuid;
alter table public.inspection_records add column organization_id uuid;
alter table public.repair_logs add column organization_id uuid;
alter table public.maintenance_reminders add column organization_id uuid;
alter table public.ifta_trips add column organization_id uuid;
alter table public.ifta_trip_miles add column organization_id uuid;
alter table public.ifta_fuel_purchases add column organization_id uuid;
alter table public.bookkeeping_expense_groups add column organization_id uuid;
alter table public.bookkeeping_expenses add column organization_id uuid;
alter table public.bookkeeping_receipts add column organization_id uuid;
alter table public.storage_cleanup_jobs add column organization_id uuid;

-- All data present before this migration is the fictional demo dataset.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'drivers', 'brokers', 'loads', 'payments', 'documents', 'notes',
    'activity_logs', 'fleet_units', 'service_records', 'inspection_records',
    'repair_logs', 'maintenance_reminders', 'ifta_trips', 'ifta_trip_miles',
    'ifta_fuel_purchases', 'bookkeeping_expense_groups',
    'bookkeeping_expenses', 'bookkeeping_receipts', 'storage_cleanup_jobs'
  ]
  loop
    execute format(
      'update public.%I set organization_id = %L where organization_id is null',
      table_name,
      '00000000-0000-4000-8000-000000000001'
    );
    execute format(
      'alter table public.%I alter column organization_id set default public.current_organization_id()',
      table_name
    );
    execute format(
      'alter table public.%I alter column organization_id set not null',
      table_name
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (organization_id) references public.organizations(id) on delete restrict',
      table_name,
      table_name || '_organization_id_fkey'
    );
    execute format(
      'create index %I on public.%I(organization_id)',
      table_name || '_organization_id_idx',
      table_name
    );
  end loop;
end;
$$;

-- IDs remain globally unique, while these pairs let foreign keys prove that a
-- referenced row belongs to the same organization as its child. Migration 022
-- replaces these duplicate API relationships with equivalent validation
-- triggers so PostgREST embedding remains unambiguous.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'drivers', 'brokers', 'loads', 'documents', 'fleet_units',
    'service_records', 'inspection_records', 'repair_logs', 'ifta_trips',
    'ifta_fuel_purchases', 'bookkeeping_expense_groups'
  ]
  loop
    execute format(
      'alter table public.%I add constraint %I unique (organization_id, id)',
      table_name,
      table_name || '_organization_id_id_key'
    );
  end loop;
end;
$$;

alter table public.loads
  add constraint loads_organization_broker_fkey foreign key (organization_id, broker_id) references public.brokers(organization_id, id),
  add constraint loads_organization_driver_fkey foreign key (organization_id, driver_id) references public.drivers(organization_id, id);
alter table public.payments add constraint payments_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id);
alter table public.documents add constraint documents_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id);
alter table public.notes add constraint notes_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id);
alter table public.activity_logs add constraint activity_logs_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id);
alter table public.service_records add constraint service_records_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id);
alter table public.inspection_records add constraint inspection_records_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id);
alter table public.repair_logs add constraint repair_logs_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id);
alter table public.maintenance_reminders add constraint maintenance_reminders_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id);
alter table public.ifta_trip_miles add constraint ifta_trip_miles_organization_trip_fkey foreign key (organization_id, trip_id) references public.ifta_trips(organization_id, id);
alter table public.ifta_fuel_purchases add constraint ifta_fuel_purchases_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id);
alter table public.bookkeeping_expense_groups
  add constraint bookkeeping_groups_organization_unit_fkey foreign key (organization_id, unit_id) references public.fleet_units(organization_id, id),
  add constraint bookkeeping_groups_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id),
  add constraint bookkeeping_groups_organization_driver_fkey foreign key (organization_id, driver_id) references public.drivers(organization_id, id),
  add constraint bookkeeping_groups_organization_service_fkey foreign key (organization_id, service_record_id) references public.service_records(organization_id, id),
  add constraint bookkeeping_groups_organization_inspection_fkey foreign key (organization_id, inspection_record_id) references public.inspection_records(organization_id, id),
  add constraint bookkeeping_groups_organization_repair_fkey foreign key (organization_id, repair_log_id) references public.repair_logs(organization_id, id),
  add constraint bookkeeping_groups_organization_ifta_fkey foreign key (organization_id, ifta_fuel_purchase_id) references public.ifta_fuel_purchases(organization_id, id);
alter table public.bookkeeping_expenses add constraint bookkeeping_expenses_organization_group_fkey foreign key (organization_id, group_id) references public.bookkeeping_expense_groups(organization_id, id);
alter table public.bookkeeping_receipts add constraint bookkeeping_receipts_organization_group_fkey foreign key (organization_id, group_id) references public.bookkeeping_expense_groups(organization_id, id);

-- Cleanup rows intentionally outlive the load, document, or expense they refer
-- to, so their source IDs cannot use normal foreign keys. Validate the path
-- while its tenant-owned parent still exists instead.
create or replace function public.validate_storage_cleanup_job_tenant()
returns trigger
language plpgsql
set search_path = public, storage
as $$
declare
  path_owner uuid;
  root_id text := (storage.foldername(new.storage_path))[1];
begin
  if new.bucket_id = 'load-documents' then
    select organization_id into path_owner
    from public.loads
    where id::text = root_id;
  elsif new.bucket_id = 'bookkeeping-receipts' then
    select organization_id into path_owner
    from public.bookkeeping_expense_groups
    where id::text = root_id;
  else
    raise exception 'Unsupported cleanup bucket' using errcode = '23514';
  end if;

  if path_owner is null or path_owner <> public.current_organization_id() then
    raise exception 'Storage cleanup path is outside the current organization' using errcode = '42501';
  end if;

  if new.organization_id <> path_owner then
    raise exception 'Storage cleanup organization does not match its path' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger storage_cleanup_jobs_validate_tenant
before insert or update of bucket_id, storage_path, organization_id
on public.storage_cleanup_jobs
for each row execute function public.validate_storage_cleanup_job_tenant();

-- Allow different clients to use the same human-readable load and unit
-- numbers. UUID and storage-path uniqueness remains global.
alter table public.loads drop constraint loads_load_number_key;
alter table public.loads
  add constraint loads_organization_load_number_key
  unique (organization_id, load_number);

alter table public.fleet_units drop constraint maintenance_units_unit_type_unit_number_key;
alter table public.fleet_units
  add constraint fleet_units_organization_type_number_key
  unique (organization_id, unit_type, unit_number);

-- Replace the original allow-all policies with tenant ownership checks.
do $$
declare
  policy_row record;
  table_name text;
begin
  foreach table_name in array array[
    'drivers', 'brokers', 'loads', 'payments', 'documents', 'notes',
    'activity_logs', 'fleet_units', 'service_records', 'inspection_records',
    'repair_logs', 'maintenance_reminders', 'ifta_trips', 'ifta_trip_miles',
    'ifta_fuel_purchases', 'bookkeeping_expense_groups',
    'bookkeeping_expenses', 'bookkeeping_receipts', 'storage_cleanup_jobs'
  ]
  loop
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_row.policyname, table_name);
    end loop;

    execute format(
      'create policy "Members can manage tenant rows" on public.%I for all to authenticated using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id())',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "Authenticated users can manage profiles" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select to authenticated
using (id = auth.uid());
create policy "Users can update their profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Private Storage is scoped through the tenant-owned load or bookkeeping
-- transaction at the first path segment. Cleanup jobs keep deletion possible
-- after the database metadata or parent row has been removed.
drop policy if exists "Authenticated users can read load documents" on storage.objects;
drop policy if exists "Authenticated users can upload load documents" on storage.objects;
drop policy if exists "Authenticated users can update load documents" on storage.objects;
drop policy if exists "Authenticated users can delete load documents" on storage.objects;

create policy "Members can read their load documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'load-documents'
  and exists (
    select 1 from public.documents d
    where d.storage_path = name
      and d.organization_id = public.current_organization_id()
  )
);

create policy "Members can upload their load documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'load-documents'
  and exists (
    select 1 from public.loads l
    where l.id::text = (storage.foldername(name))[1]
      and l.organization_id = public.current_organization_id()
  )
);

create policy "Members can update their load documents"
on storage.objects for update to authenticated
using (
  bucket_id = 'load-documents'
  and exists (
    select 1 from public.loads l
    where l.id::text = (storage.foldername(name))[1]
      and l.organization_id = public.current_organization_id()
  )
)
with check (
  bucket_id = 'load-documents'
  and exists (
    select 1 from public.loads l
    where l.id::text = (storage.foldername(name))[1]
      and l.organization_id = public.current_organization_id()
  )
);

create policy "Members can delete their load documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'load-documents'
  and (
    exists (
      select 1 from public.loads l
      where l.id::text = (storage.foldername(name))[1]
        and l.organization_id = public.current_organization_id()
    )
    or exists (
      select 1 from public.storage_cleanup_jobs j
      where j.bucket_id = storage.objects.bucket_id
        and j.storage_path = storage.objects.name
        and j.organization_id = public.current_organization_id()
    )
  )
);

drop policy if exists "Authenticated users can read bookkeeping receipts" on storage.objects;
drop policy if exists "Authenticated users can upload bookkeeping receipts" on storage.objects;
drop policy if exists "Authenticated users can update bookkeeping receipts" on storage.objects;
drop policy if exists "Authenticated users can delete bookkeeping receipts" on storage.objects;

create policy "Members can read their bookkeeping receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'bookkeeping-receipts'
  and exists (
    select 1 from public.bookkeeping_receipts r
    where r.storage_path = name
      and r.organization_id = public.current_organization_id()
  )
);

create policy "Members can upload their bookkeeping receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bookkeeping-receipts'
  and exists (
    select 1 from public.bookkeeping_expense_groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.organization_id = public.current_organization_id()
  )
);

create policy "Members can update their bookkeeping receipts"
on storage.objects for update to authenticated
using (
  bucket_id = 'bookkeeping-receipts'
  and exists (
    select 1 from public.bookkeeping_expense_groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.organization_id = public.current_organization_id()
  )
)
with check (
  bucket_id = 'bookkeeping-receipts'
  and exists (
    select 1 from public.bookkeeping_expense_groups g
    where g.id::text = (storage.foldername(name))[1]
      and g.organization_id = public.current_organization_id()
  )
);

create policy "Members can delete their bookkeeping receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'bookkeeping-receipts'
  and (
    exists (
      select 1 from public.bookkeeping_expense_groups g
      where g.id::text = (storage.foldername(name))[1]
        and g.organization_id = public.current_organization_id()
    )
    or exists (
      select 1 from public.storage_cleanup_jobs j
      where j.bucket_id = storage.objects.bucket_id
        and j.storage_path = storage.objects.name
        and j.organization_id = public.current_organization_id()
    )
  )
);

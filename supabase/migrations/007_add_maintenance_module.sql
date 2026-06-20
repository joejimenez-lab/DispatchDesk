-- Maintenance module: track trucks and trailers separately, each with its own
-- service, inspection, and repair history. (Issue #5)

create type public.unit_type as enum ('Truck', 'Trailer');

create table public.maintenance_units (
  id uuid primary key default gen_random_uuid(),
  unit_number text not null,
  unit_type public.unit_type not null,
  company text,
  odometer integer check (odometer >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_type, unit_number)
);

create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.maintenance_units(id) on delete cascade,
  service_date date,
  odometer integer check (odometer >= 0),
  description text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.inspection_records (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.maintenance_units(id) on delete cascade,
  inspection_date date,
  odometer integer check (odometer >= 0),
  inspector text,
  result text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.repair_logs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.maintenance_units(id) on delete cascade,
  repair_date date,
  odometer integer check (odometer >= 0),
  description text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index maintenance_units_type_idx on public.maintenance_units(unit_type);
create index maintenance_units_search_idx on public.maintenance_units using gin (
  to_tsvector('simple', coalesce(unit_number, '') || ' ' || coalesce(company, ''))
);
create index service_records_unit_id_idx on public.service_records(unit_id, service_date desc);
create index inspection_records_unit_id_idx on public.inspection_records(unit_id, inspection_date desc);
create index repair_logs_unit_id_idx on public.repair_logs(unit_id, repair_date desc);

create trigger maintenance_units_set_updated_at
before update on public.maintenance_units
for each row execute function public.set_updated_at();

alter table public.maintenance_units enable row level security;
alter table public.service_records enable row level security;
alter table public.inspection_records enable row level security;
alter table public.repair_logs enable row level security;

create policy "Authenticated users can manage maintenance units" on public.maintenance_units for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage service records" on public.service_records for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage inspection records" on public.inspection_records for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage repair logs" on public.repair_logs for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table public.maintenance_units to authenticated;
grant select, insert, update, delete on table public.service_records to authenticated;
grant select, insert, update, delete on table public.inspection_records to authenticated;
grant select, insert, update, delete on table public.repair_logs to authenticated;

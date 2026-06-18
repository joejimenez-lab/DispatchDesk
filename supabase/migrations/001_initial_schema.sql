create extension if not exists pgcrypto;

create type public.load_status as enum (
  'Booked',
  'Dispatched',
  'Picked Up',
  'In Transit',
  'Delivered',
  'Closed',
  'Cancelled'
);

create type public.document_category as enum (
  'Rate Confirmation',
  'Invoice',
  'BOL',
  'Fuel Receipt',
  'Lumper Receipt',
  'Insurance',
  'Carrier Packet',
  'Other'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  truck_number text,
  trailer_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  load_number text not null unique,
  broker_id uuid references public.brokers(id) on delete set null,
  carrier_company text,
  driver_id uuid references public.drivers(id) on delete set null,
  pickup_location text not null,
  pickup_date date,
  delivery_location text not null,
  delivery_date date,
  load_rate numeric(12, 2) not null default 0 check (load_rate >= 0),
  driver_pay numeric(12, 2) not null default 0 check (driver_pay >= 0),
  dispatcher_fee numeric(12, 2) not null default 0 check (dispatcher_fee >= 0),
  fuel_cost numeric(12, 2) not null default 0 check (fuel_cost >= 0),
  notes text,
  status public.load_status not null default 'Booked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null unique references public.loads(id) on delete cascade,
  invoice_sent boolean not null default false,
  invoice_sent_date date,
  client_paid boolean not null default false,
  client_amount_received numeric(12, 2) not null default 0 check (client_amount_received >= 0),
  client_date_received date,
  driver_paid boolean not null default false,
  driver_amount_paid numeric(12, 2) not null default 0 check (driver_amount_paid >= 0),
  driver_date_paid date,
  dispatcher_fee_amount numeric(12, 2) not null default 0 check (dispatcher_fee_amount >= 0),
  dispatcher_paid boolean not null default false,
  dispatcher_date_paid date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  file_name text not null,
  category public.document_category not null default 'Other',
  notes text,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  load_id uuid references public.loads(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index drivers_name_idx on public.drivers using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(phone, '') || ' ' || coalesce(email, '')));
create index brokers_company_idx on public.brokers using gin (to_tsvector('simple', coalesce(company_name, '') || ' ' || coalesce(contact_name, '') || ' ' || coalesce(email, '')));
create index loads_status_idx on public.loads(status);
create index loads_pickup_date_idx on public.loads(pickup_date);
create index loads_delivery_date_idx on public.loads(delivery_date);
create index loads_broker_id_idx on public.loads(broker_id);
create index loads_driver_id_idx on public.loads(driver_id);
create index loads_search_idx on public.loads using gin (
  to_tsvector('simple', coalesce(load_number, '') || ' ' || coalesce(carrier_company, '') || ' ' || coalesce(pickup_location, '') || ' ' || coalesce(delivery_location, ''))
);
create index documents_load_id_idx on public.documents(load_id);
create index notes_load_id_created_at_idx on public.notes(load_id, created_at desc);
create index activity_logs_load_id_created_at_idx on public.activity_logs(load_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger drivers_set_updated_at before update on public.drivers for each row execute function public.set_updated_at();
create trigger brokers_set_updated_at before update on public.brokers for each row execute function public.set_updated_at();
create trigger loads_set_updated_at before update on public.loads for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_payment_for_load()
returns trigger
language plpgsql
as $$
begin
  insert into public.payments (load_id, dispatcher_fee_amount)
  values (new.id, new.dispatcher_fee);

  insert into public.activity_logs (load_id, action)
  values (new.id, 'Load created');

  return new;
end;
$$;

create trigger loads_create_payment
after insert on public.loads
for each row execute function public.create_payment_for_load();

create or replace function public.log_load_changes()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    insert into public.activity_logs (load_id, action)
    values (new.id, 'Status changed from ' || old.status || ' to ' || new.status);
  else
    insert into public.activity_logs (load_id, action)
    values (new.id, 'Load updated');
  end if;

  return new;
end;
$$;

create trigger loads_log_changes
after update on public.loads
for each row execute function public.log_load_changes();

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.brokers enable row level security;
alter table public.loads enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;
alter table public.activity_logs enable row level security;

create policy "Authenticated users can manage profiles" on public.profiles for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage drivers" on public.drivers for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage brokers" on public.brokers for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage loads" on public.loads for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage payments" on public.payments for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage documents" on public.documents for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage notes" on public.notes for all to authenticated using (true) with check (true);
create policy "Authenticated users can read activity logs" on public.activity_logs for select to authenticated using (true);
create policy "Authenticated users can add activity logs" on public.activity_logs for insert to authenticated with check (true);

insert into storage.buckets (id, name, public)
values ('load-documents', 'load-documents', false)
on conflict (id) do update set public = false;

create policy "Authenticated users can read load documents"
on storage.objects for select
to authenticated
using (bucket_id = 'load-documents');

create policy "Authenticated users can upload load documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'load-documents');

create policy "Authenticated users can update load documents"
on storage.objects for update
to authenticated
using (bucket_id = 'load-documents')
with check (bucket_id = 'load-documents');

create policy "Authenticated users can delete load documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'load-documents');

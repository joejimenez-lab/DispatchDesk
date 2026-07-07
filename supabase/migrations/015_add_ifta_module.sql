-- IFTA fuel tax tracking: trips with miles per state and fuel purchases per
-- state, separate from loads, aggregated by quarter for reporting. (Issue #10)

create table public.ifta_trips (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null,
  start_date date not null,
  end_date date,
  pickup_city text not null,
  dropoff_city text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.ifta_trip_miles (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.ifta_trips(id) on delete cascade,
  state text not null check (state ~ '^[A-Z]{2}$'),
  miles numeric(8, 1) not null check (miles > 0),
  unique (trip_id, state)
);

create table public.ifta_fuel_purchases (
  id uuid primary key default gen_random_uuid(),
  truck_number text not null,
  purchase_date date not null,
  city text,
  state text not null check (state ~ '^[A-Z]{2}$'),
  gallons numeric(8, 1) not null check (gallons > 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index ifta_trips_start_idx on public.ifta_trips (start_date, truck_number);
create index ifta_trip_miles_trip_idx on public.ifta_trip_miles (trip_id);
create index ifta_fuel_purchases_date_idx on public.ifta_fuel_purchases (purchase_date, truck_number);

create trigger ifta_trips_set_updated_at
before update on public.ifta_trips
for each row execute function public.set_updated_at();

alter table public.ifta_trips enable row level security;
alter table public.ifta_trip_miles enable row level security;
alter table public.ifta_fuel_purchases enable row level security;

create policy "Authenticated users can manage IFTA trips" on public.ifta_trips for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage IFTA trip miles" on public.ifta_trip_miles for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage IFTA fuel purchases" on public.ifta_fuel_purchases for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table public.ifta_trips to authenticated;
grant select, insert, update, delete on table public.ifta_trip_miles to authenticated;
grant select, insert, update, delete on table public.ifta_fuel_purchases to authenticated;

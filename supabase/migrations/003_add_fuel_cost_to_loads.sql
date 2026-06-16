alter table public.loads
add column if not exists fuel_cost numeric(12, 2) not null default 0 check (fuel_cost >= 0);

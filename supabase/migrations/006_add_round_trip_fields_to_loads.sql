alter table public.loads
add column if not exists is_round_trip boolean not null default false,
add column if not exists return_location text,
add column if not exists round_trip_details text;

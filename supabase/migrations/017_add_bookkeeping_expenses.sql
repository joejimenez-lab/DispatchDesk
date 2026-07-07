-- Bookkeeping expense and receipt tracking for tax/accounting exports.

create type public.expense_category as enum (
  'Fuel',
  'Maintenance',
  'Tolls',
  'Insurance',
  'Permits',
  'Parking',
  'Parts',
  'Supplies',
  'Other'
);

create table public.bookkeeping_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category public.expense_category not null,
  amount numeric(12, 2) not null check (amount >= 0),
  vendor text,
  notes text,
  unit_id uuid references public.fleet_units(id) on delete set null,
  load_id uuid references public.loads(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  service_record_id uuid references public.service_records(id) on delete set null,
  inspection_record_id uuid references public.inspection_records(id) on delete set null,
  repair_log_id uuid references public.repair_logs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookkeeping_expenses_one_maintenance_record check (
    (case when service_record_id is null then 0 else 1 end) +
    (case when inspection_record_id is null then 0 else 1 end) +
    (case when repair_log_id is null then 0 else 1 end) <= 1
  )
);

create table public.bookkeeping_receipts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.bookkeeping_expenses(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  content_type text not null,
  file_size integer not null check (file_size > 0),
  created_at timestamptz not null default now()
);

create index bookkeeping_expenses_date_idx on public.bookkeeping_expenses (expense_date desc, created_at desc);
create index bookkeeping_expenses_category_idx on public.bookkeeping_expenses (category);
create index bookkeeping_expenses_unit_idx on public.bookkeeping_expenses (unit_id);
create index bookkeeping_expenses_load_idx on public.bookkeeping_expenses (load_id);
create index bookkeeping_expenses_driver_idx on public.bookkeeping_expenses (driver_id);
create index bookkeeping_expenses_service_record_idx on public.bookkeeping_expenses (service_record_id);
create index bookkeeping_expenses_inspection_record_idx on public.bookkeeping_expenses (inspection_record_id);
create index bookkeeping_expenses_repair_log_idx on public.bookkeeping_expenses (repair_log_id);
create index bookkeeping_receipts_expense_idx on public.bookkeeping_receipts (expense_id, created_at desc);

create trigger bookkeeping_expenses_set_updated_at
before update on public.bookkeeping_expenses
for each row execute function public.set_updated_at();

alter table public.bookkeeping_expenses enable row level security;
alter table public.bookkeeping_receipts enable row level security;

create policy "Authenticated users can manage bookkeeping expenses"
on public.bookkeeping_expenses for all
to authenticated
using (true)
with check (true);

create policy "Authenticated users can manage bookkeeping receipts"
on public.bookkeeping_receipts for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.bookkeeping_expenses to authenticated;
grant select, insert, update, delete on table public.bookkeeping_receipts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bookkeeping-receipts',
  'bookkeeping-receipts',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif'];

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif']
where id = 'load-documents';

create policy "Authenticated users can read bookkeeping receipts"
on storage.objects for select
to authenticated
using (bucket_id = 'bookkeeping-receipts');

create policy "Authenticated users can upload bookkeeping receipts"
on storage.objects for insert
to authenticated
with check (bucket_id = 'bookkeeping-receipts');

create policy "Authenticated users can update bookkeeping receipts"
on storage.objects for update
to authenticated
using (bucket_id = 'bookkeeping-receipts')
with check (bucket_id = 'bookkeeping-receipts');

create policy "Authenticated users can delete bookkeeping receipts"
on storage.objects for delete
to authenticated
using (bucket_id = 'bookkeeping-receipts');

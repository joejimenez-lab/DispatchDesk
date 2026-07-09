-- Queue object-storage cleanup before deleting database metadata. The app removes
-- queued objects after commit and clears these rows only after Storage succeeds.
create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null default 'load-documents',
  storage_path text not null,
  source text not null check (source in ('delete_load', 'delete_document', 'upload_document')),
  load_id uuid,
  document_id uuid,
  last_error text,
  last_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, storage_path)
);

create index storage_cleanup_jobs_created_at_idx on public.storage_cleanup_jobs(created_at);
create index storage_cleanup_jobs_load_id_idx on public.storage_cleanup_jobs(load_id);

create trigger storage_cleanup_jobs_set_updated_at
before update on public.storage_cleanup_jobs
for each row execute function public.set_updated_at();

alter table public.storage_cleanup_jobs enable row level security;

create policy "Authenticated users can manage storage cleanup jobs"
on public.storage_cleanup_jobs for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on table public.storage_cleanup_jobs to authenticated;

create or replace function public.update_load_with_payment(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.loads
  set load_number = p_load ->> 'load_number',
      broker_id = nullif(p_load ->> 'broker_id', '')::uuid,
      carrier_company = p_load ->> 'carrier_company',
      driver_id = nullif(p_load ->> 'driver_id', '')::uuid,
      pickup_location = p_load ->> 'pickup_location',
      pickup_date = nullif(p_load ->> 'pickup_date', '')::date,
      delivery_location = p_load ->> 'delivery_location',
      delivery_date = nullif(p_load ->> 'delivery_date', '')::date,
      is_round_trip = coalesce((p_load ->> 'is_round_trip')::boolean, false),
      return_location = p_load ->> 'return_location',
      round_trip_details = p_load ->> 'round_trip_details',
      load_rate = coalesce((p_load ->> 'load_rate')::numeric, 0),
      driver_pay = coalesce((p_load ->> 'driver_pay')::numeric, 0),
      dispatcher_fee = coalesce((p_load ->> 'dispatcher_fee')::numeric, 0),
      fuel_cost = coalesce((p_load ->> 'fuel_cost')::numeric, 0),
      notes = p_load ->> 'notes',
      status = (p_load ->> 'status')::public.load_status
  where id = p_load_id;

  if not found then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  insert into public.payments (
    load_id,
    invoice_sent,
    invoice_sent_date,
    client_paid,
    client_amount_received,
    client_date_received,
    driver_paid,
    driver_amount_paid,
    driver_date_paid,
    dispatcher_fee_amount,
    dispatcher_paid,
    dispatcher_date_paid
  ) values (
    p_load_id,
    coalesce((p_payment ->> 'invoice_sent')::boolean, false),
    nullif(p_payment ->> 'invoice_sent_date', '')::date,
    coalesce((p_payment ->> 'client_paid')::boolean, false),
    coalesce((p_payment ->> 'client_amount_received')::numeric, 0),
    nullif(p_payment ->> 'client_date_received', '')::date,
    coalesce((p_payment ->> 'driver_paid')::boolean, false),
    coalesce((p_payment ->> 'driver_amount_paid')::numeric, 0),
    nullif(p_payment ->> 'driver_date_paid', '')::date,
    coalesce((p_payment ->> 'dispatcher_fee_amount')::numeric, 0),
    coalesce((p_payment ->> 'dispatcher_paid')::boolean, false),
    nullif(p_payment ->> 'dispatcher_date_paid', '')::date
  )
  on conflict (load_id) do update
  set invoice_sent = excluded.invoice_sent,
      invoice_sent_date = excluded.invoice_sent_date,
      client_paid = excluded.client_paid,
      client_amount_received = excluded.client_amount_received,
      client_date_received = excluded.client_date_received,
      driver_paid = excluded.driver_paid,
      driver_amount_paid = excluded.driver_amount_paid,
      driver_date_paid = excluded.driver_date_paid,
      dispatcher_fee_amount = excluded.dispatcher_fee_amount,
      dispatcher_paid = excluded.dispatcher_paid,
      dispatcher_date_paid = excluded.dispatcher_date_paid;

  insert into public.activity_logs (load_id, action)
  values (p_load_id, 'Load and payment details updated');
end;
$$;

create or replace function public.delete_document_with_cleanup(p_document_id uuid)
returns table (
  job_id uuid,
  bucket_id text,
  storage_path text,
  load_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_row public.documents%rowtype;
  cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into document_row
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  insert into public.storage_cleanup_jobs (
    bucket_id,
    storage_path,
    source,
    load_id,
    document_id,
    last_error,
    last_attempted_at
  ) values (
    'load-documents',
    document_row.storage_path,
    'delete_document',
    document_row.load_id,
    document_row.id,
    null,
    null
  )
  on conflict (bucket_id, storage_path) do update
  set source = excluded.source,
      load_id = excluded.load_id,
      document_id = excluded.document_id,
      last_error = null,
      last_attempted_at = null
  returning * into cleanup_job;

  delete from public.documents where id = document_row.id;

  insert into public.activity_logs (load_id, action)
  values (document_row.load_id, 'Document deleted');

  job_id := cleanup_job.id;
  bucket_id := cleanup_job.bucket_id;
  storage_path := cleanup_job.storage_path;
  load_id := document_row.load_id;
  return next;
end;
$$;

create or replace function public.delete_load_with_document_cleanup(p_load_id uuid)
returns table (
  job_id uuid,
  bucket_id text,
  storage_path text,
  load_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_row public.documents%rowtype;
  cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1 from public.loads where id = p_load_id for update;
  if not found then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  for document_row in
    select d.* from public.documents d where d.load_id = p_load_id for update
  loop
    insert into public.storage_cleanup_jobs (
      bucket_id,
      storage_path,
      source,
      load_id,
      document_id,
      last_error,
      last_attempted_at
    ) values (
      'load-documents',
      document_row.storage_path,
      'delete_load',
      document_row.load_id,
      document_row.id,
      null,
      null
    )
    on conflict (bucket_id, storage_path) do update
    set source = excluded.source,
        load_id = excluded.load_id,
        document_id = excluded.document_id,
        last_error = null,
        last_attempted_at = null
    returning * into cleanup_job;

    job_id := cleanup_job.id;
    bucket_id := cleanup_job.bucket_id;
    storage_path := cleanup_job.storage_path;
    load_id := document_row.load_id;
    return next;
  end loop;

  delete from public.loads where id = p_load_id;
end;
$$;

revoke all on function public.update_load_with_payment(uuid, jsonb, jsonb) from public;
revoke all on function public.update_load_with_payment(uuid, jsonb, jsonb) from anon;
grant execute on function public.update_load_with_payment(uuid, jsonb, jsonb) to authenticated;

revoke all on function public.delete_document_with_cleanup(uuid) from public;
revoke all on function public.delete_document_with_cleanup(uuid) from anon;
grant execute on function public.delete_document_with_cleanup(uuid) to authenticated;

revoke all on function public.delete_load_with_document_cleanup(uuid) from public;
revoke all on function public.delete_load_with_document_cleanup(uuid) from anon;
grant execute on function public.delete_load_with_document_cleanup(uuid) to authenticated;

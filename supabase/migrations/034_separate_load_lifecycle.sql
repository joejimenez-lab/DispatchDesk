-- Separate transportation status from the post-delivery closeout workflow.
-- The legacy `Closed` enum value remains available for older clients, but all
-- stored closed loads are represented as Delivered + a Closed closeout stage.

create type public.load_closeout_status as enum (
  'Awaiting Documents',
  'Documents Complete',
  'Invoiced',
  'Paid',
  'Closed'
);

alter table public.loads
  add column documents_complete_at timestamptz,
  add column closed_at timestamptz,
  add column post_delivery_status public.load_closeout_status;

create index loads_post_delivery_status_idx
  on public.loads(organization_id, post_delivery_status)
  where post_delivery_status is not null;

-- Backfill is system maintenance, not a user edit; avoid noisy activity rows and
-- the tenant default used by the normal change logger during migration.
alter table public.loads disable trigger loads_log_changes;

-- Preserve the meaning of legacy Closed loads while moving closure out of the
-- operational status. Existing invoice/payment facts remain the source of truth.
update public.loads
set
  status = 'Delivered',
  documents_complete_at = coalesce(documents_complete_at, updated_at),
  closed_at = coalesce(closed_at, updated_at),
  post_delivery_status = 'Closed'
where status = 'Closed';

-- An invoice or recorded payment is strong evidence that documents had already
-- been completed. Do not infer completion for other delivered loads.
update public.loads l
set documents_complete_at = coalesce(l.documents_complete_at, p.invoice_sent_date::timestamptz, p.client_date_received::timestamptz, l.updated_at)
from public.payments p
where p.load_id = l.id
  and l.status = 'Delivered'
  and l.documents_complete_at is null
  and (p.invoice_sent or p.client_paid);

create or replace function public.load_closeout_stage(p_load_id uuid)
returns public.load_closeout_status
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when l.status <> 'Delivered' then null
    when l.closed_at is not null then 'Closed'::public.load_closeout_status
    when l.documents_complete_at is null then 'Awaiting Documents'::public.load_closeout_status
    when not coalesce(p.invoice_sent, false) then 'Documents Complete'::public.load_closeout_status
    when not (
      coalesce(p.client_paid, false)
      and coalesce(p.driver_paid, false)
      and coalesce(p.dispatcher_paid, false)
    ) then 'Invoiced'::public.load_closeout_status
    else 'Paid'::public.load_closeout_status
  end
  from public.loads l
  left join public.payments p on p.load_id = l.id
  where l.id = p_load_id
    and l.organization_id = public.current_organization_id()
$$;

update public.loads l
set post_delivery_status = case
  when l.status <> 'Delivered' then null
  when l.closed_at is not null then 'Closed'::public.load_closeout_status
  when l.documents_complete_at is null then 'Awaiting Documents'::public.load_closeout_status
  when not coalesce(p.invoice_sent, false) then 'Documents Complete'::public.load_closeout_status
  when not (
    coalesce(p.client_paid, false)
    and coalesce(p.driver_paid, false)
    and coalesce(p.dispatcher_paid, false)
  ) then 'Invoiced'::public.load_closeout_status
  else 'Paid'::public.load_closeout_status
end
from public.payments p
where p.load_id = l.id;

-- Loads without a payment row are still placed in the correct initial stage.
update public.loads
set post_delivery_status = case
  when documents_complete_at is null then 'Awaiting Documents'::public.load_closeout_status
  else 'Documents Complete'::public.load_closeout_status
end
where status = 'Delivered' and post_delivery_status is null;

alter table public.loads enable trigger loads_log_changes;

create or replace function public.sync_load_closeout_from_load()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
begin
  -- Translate the deprecated combined status for backwards compatibility.
  if new.status = 'Closed' then
    new.status := 'Delivered';
    new.documents_complete_at := coalesce(new.documents_complete_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  end if;

  if new.status <> 'Delivered' then
    if tg_op = 'UPDATE' and old.closed_at is not null and new.status is distinct from old.status then
      raise exception 'Reopen the closeout before changing operational status' using errcode = '22023';
    end if;
    new.post_delivery_status := null;
    if old.status = 'Delivered' and new.status is distinct from old.status then
      new.closed_at := null;
    end if;
    return new;
  end if;

  select * into payment_row from public.payments where load_id = new.id;
  if new.closed_at is not null and (tg_op = 'INSERT' or old.closed_at is null) then
    if new.documents_complete_at is null
      or not coalesce(payment_row.invoice_sent, false)
      or not coalesce(payment_row.client_paid, false)
      or not coalesce(payment_row.driver_paid, false)
      or not coalesce(payment_row.dispatcher_paid, false) then
      raise exception 'Complete documents, invoicing, and all payments before closing the load' using errcode = '22023';
    end if;
  end if;
  new.post_delivery_status := case
    when new.closed_at is not null then 'Closed'::public.load_closeout_status
    when new.documents_complete_at is null then 'Awaiting Documents'::public.load_closeout_status
    when not coalesce(payment_row.invoice_sent, false) then 'Documents Complete'::public.load_closeout_status
    when not (
      coalesce(payment_row.client_paid, false)
      and coalesce(payment_row.driver_paid, false)
      and coalesce(payment_row.dispatcher_paid, false)
    ) then 'Invoiced'::public.load_closeout_status
    else 'Paid'::public.load_closeout_status
  end;
  return new;
end;
$$;

create trigger loads_sync_closeout
before insert or update of status, documents_complete_at, closed_at, post_delivery_status
on public.loads
for each row execute function public.sync_load_closeout_from_load();

create or replace function public.sync_load_closeout_from_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_load_id uuid := coalesce(new.load_id, old.load_id);
  target_organization_id uuid := coalesce(new.organization_id, old.organization_id);
begin
  update public.loads l
  set post_delivery_status = case
    when l.closed_at is not null then 'Closed'::public.load_closeout_status
    when l.documents_complete_at is null then 'Awaiting Documents'::public.load_closeout_status
    when tg_op = 'DELETE' or not coalesce(new.invoice_sent, false) then 'Documents Complete'::public.load_closeout_status
    when not (
      coalesce(new.client_paid, false)
      and coalesce(new.driver_paid, false)
      and coalesce(new.dispatcher_paid, false)
    ) then 'Invoiced'::public.load_closeout_status
    else 'Paid'::public.load_closeout_status
  end
  where l.id = target_load_id
    and l.organization_id = target_organization_id
    and l.status = 'Delivered';
  return coalesce(new, old);
end;
$$;

create trigger payments_sync_load_closeout_insert_delete
after insert or delete
on public.payments
for each row execute function public.sync_load_closeout_from_payment();

create trigger payments_sync_load_closeout_update
after update of invoice_sent, client_paid, driver_paid, dispatcher_paid
on public.payments
for each row execute function public.sync_load_closeout_from_payment();

create or replace function public.set_load_closeout_milestone(
  p_load_id uuid,
  p_milestone text,
  p_complete boolean
)
returns public.load_closeout_status
language plpgsql
security invoker
set search_path = public
as $$
declare
  load_row public.loads%rowtype;
  payment_row public.payments%rowtype;
  result public.load_closeout_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into load_row
  from public.loads
  where id = p_load_id
    and organization_id = public.current_organization_id()
  for update;
  if not found then raise exception 'Load not found' using errcode = 'P0002'; end if;

  if load_row.status <> 'Delivered' then
    raise exception 'Closeout milestones require a Delivered load' using errcode = '22023';
  end if;

  if p_milestone = 'documents_complete' then
    update public.loads
    set documents_complete_at = case when p_complete then coalesce(documents_complete_at, now()) else null end,
        closed_at = case when p_complete then closed_at else null end
    where id = p_load_id;
  elsif p_milestone = 'closed' then
    if p_complete then
      select * into payment_row from public.payments where load_id = p_load_id;
      if load_row.documents_complete_at is null
        or not coalesce(payment_row.invoice_sent, false)
        or not coalesce(payment_row.client_paid, false)
        or not coalesce(payment_row.driver_paid, false)
        or not coalesce(payment_row.dispatcher_paid, false) then
        raise exception 'Complete documents, invoicing, and all payments before closing the load' using errcode = '22023';
      end if;
    end if;
    update public.loads
    set closed_at = case when p_complete then coalesce(closed_at, now()) else null end
    where id = p_load_id;
  else
    raise exception 'Unknown closeout milestone' using errcode = '22023';
  end if;

  select post_delivery_status into result from public.loads where id = p_load_id;
  insert into public.activity_logs(load_id, action)
  values (
    p_load_id,
    case p_milestone
      when 'documents_complete' then 'Documents marked ' || case when p_complete then 'complete' else 'incomplete' end
      when 'closed' then 'Load ' || case when p_complete then 'closed' else 'reopened' end
    end
  );
  return result;
end;
$$;

grant execute on function public.load_closeout_stage(uuid) to authenticated;
grant execute on function public.set_load_closeout_milestone(uuid, text, boolean) to authenticated;

comment on column public.loads.status is 'Operational transportation status. The legacy Closed value is normalized to Delivered.';
comment on column public.loads.post_delivery_status is 'Derived post-delivery stage kept in sync with documents, invoicing, payments, and closure.';

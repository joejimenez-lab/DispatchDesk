-- Invoice aging and auditable receivables. Existing payment facts are preserved;
-- invoice dates are only backfilled from an existing invoice-sent date.

create type public.invoice_status as enum ('Draft', 'Sent', 'Void');
create type public.receivable_entry_type as enum ('Payment', 'Adjustment', 'Credit', 'Write-off');
create type public.collection_contact_type as enum ('Note', 'Phone', 'Email');

alter table public.payments
  add column invoice_status public.invoice_status not null default 'Draft',
  add column invoice_number text,
  add column invoice_date date,
  add column payment_terms_days integer not null default 30,
  add column due_date date,
  add column collection_owner_id uuid references auth.users(id) on delete set null,
  add column next_follow_up_date date,
  add constraint payments_terms_range check (payment_terms_days between 0 and 365),
  add constraint payments_due_after_invoice check (due_date is null or invoice_date is null or due_date >= invoice_date);

update public.payments
set invoice_status = case when invoice_sent then 'Sent'::public.invoice_status else 'Draft'::public.invoice_status end,
    invoice_date = invoice_sent_date,
    due_date = case when invoice_sent_date is not null then invoice_sent_date + 30 else null end;

create unique index payments_invoice_number_org_unique
  on public.payments(organization_id, lower(invoice_number))
  where invoice_number is not null and btrim(invoice_number) <> '';
create index payments_collections_due_idx on public.payments(organization_id, due_date, next_follow_up_date);
create index payments_collections_owner_idx on public.payments(organization_id, collection_owner_id);

create or replace function public.validate_collection_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.collection_owner_id is not null and not exists (
    select 1 from public.organization_members
    where user_id = new.collection_owner_id and organization_id = new.organization_id
  ) then
    raise exception 'Collection owner must belong to the invoice organization' using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger payments_validate_collection_owner before insert or update of collection_owner_id, organization_id
  on public.payments for each row execute function public.validate_collection_owner();

create table public.receivable_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete cascade,
  entry_type public.receivable_entry_type not null,
  amount numeric(12,2) not null,
  entry_date date not null default current_date,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  constraint receivable_entries_amount_check check (
    (entry_type = 'Adjustment' and amount <> 0)
    or (entry_type <> 'Adjustment' and amount > 0)
  )
);

create table public.collection_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete cascade,
  contact_type public.collection_contact_type not null,
  contacted_at timestamptz not null default now(),
  note text not null check (btrim(note) <> ''),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now()
);

create index receivable_entries_load_idx on public.receivable_entries(organization_id, load_id, entry_date, created_at);
create index collection_contacts_load_idx on public.collection_contacts(organization_id, load_id, contacted_at desc);

alter table public.receivable_entries enable row level security;
alter table public.collection_contacts enable row level security;
create policy "Organization members can read receivable entries" on public.receivable_entries
  for select to authenticated using (organization_id = public.current_organization_id());
create policy "Organization members can add receivable entries" on public.receivable_entries
  for insert to authenticated with check (organization_id = public.current_organization_id());
create policy "Organization members can read collection contacts" on public.collection_contacts
  for select to authenticated using (organization_id = public.current_organization_id());
create policy "Organization members can add collection contacts" on public.collection_contacts
  for insert to authenticated with check (organization_id = public.current_organization_id());
grant select, insert on public.receivable_entries to authenticated;
grant select, insert on public.collection_contacts to authenticated;

create trigger receivable_entries_validate_load_tenant before insert or update of organization_id, load_id
  on public.receivable_entries for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger collection_contacts_validate_load_tenant before insert or update of organization_id, load_id
  on public.collection_contacts for each row execute function public.validate_tenant_reference('loads', 'load_id');

-- Preserve the historical aggregate as a dated, immutable opening ledger fact.
insert into public.receivable_entries (
  organization_id, load_id, entry_type, amount, entry_date, note, created_by, created_by_email
)
select p.organization_id, p.load_id, 'Payment'::public.receivable_entry_type,
       case when p.client_amount_received > 0 then p.client_amount_received else l.load_rate end,
       coalesce(p.client_date_received, p.updated_at::date),
       'Opening balance from payment history', null, null
from public.payments p
join public.loads l on l.id = p.load_id
where p.client_amount_received > 0 or p.client_paid;

create or replace function public.receivable_entry_effect(p_type public.receivable_entry_type, p_amount numeric)
returns numeric language sql immutable parallel safe as $$
  select case when p_type = 'Adjustment' then -p_amount else p_amount end
$$;

create or replace function public.receivable_balance(p_load_id uuid)
returns numeric
language sql stable security invoker set search_path = public as $$
  select greatest(
    coalesce(l.load_rate, 0) - coalesce(sum(public.receivable_entry_effect(e.entry_type, e.amount)), 0),
    0
  )
  from public.loads l
  left join public.receivable_entries e on e.load_id = l.id and e.organization_id = l.organization_id
  where l.id = p_load_id and l.organization_id = public.current_organization_id()
  group by l.load_rate
$$;

create or replace function public.validate_invoice_state()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.invoice_status = 'Void' then
    if public.receivable_balance(new.load_id) > 0 then
      raise exception 'Reconcile the outstanding balance before voiding the invoice' using errcode = '22023';
    end if;
    new.invoice_sent := false;
    new.invoice_sent_date := null;
    new.due_date := null;
    new.next_follow_up_date := null;
  end if;
  return new;
end;
$$;
create trigger payments_validate_invoice_state before insert or update of invoice_status
  on public.payments for each row execute function public.validate_invoice_state();

create or replace function public.invoice_aging_bucket(p_due_date date, p_as_of date default current_date)
returns text language sql immutable parallel safe as $$
  select case
    when p_due_date is null or p_due_date >= p_as_of then 'Current'
    when p_as_of - p_due_date between 1 and 30 then '1–30'
    when p_as_of - p_due_date between 31 and 60 then '31–60'
    when p_as_of - p_due_date between 61 and 90 then '61–90'
    else '90+'
  end
$$;

create or replace function public.sync_receivable_payment_summary(p_load_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  paid_total numeric;
  remaining numeric;
  latest_payment date;
begin
  select coalesce(sum(amount), 0), max(entry_date)
  into paid_total, latest_payment
  from public.receivable_entries
  where load_id = p_load_id
    and organization_id = public.current_organization_id()
    and entry_type = 'Payment';
  remaining := public.receivable_balance(p_load_id);
  update public.payments
  set client_amount_received = paid_total,
      client_paid = remaining <= 0,
      client_date_received = case when paid_total > 0 then latest_payment else null end
  where load_id = p_load_id and organization_id = public.current_organization_id();
end;
$$;

create or replace function public.update_invoice_collection(
  p_load_id uuid,
  p_invoice_status text,
  p_invoice_number text,
  p_invoice_date date,
  p_payment_terms_days integer,
  p_due_date date,
  p_collection_owner_id uuid,
  p_next_follow_up_date date
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  status_value public.invoice_status;
  resolved_due date;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.loads where id = p_load_id and organization_id = public.current_organization_id()) then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;
  status_value := p_invoice_status::public.invoice_status;
  if p_payment_terms_days not between 0 and 365 then raise exception 'Payment terms must be between 0 and 365 days' using errcode = '22023'; end if;
  if status_value = 'Sent' and p_invoice_date is null then raise exception 'Invoice date is required when an invoice is sent' using errcode = '22023'; end if;
  if status_value = 'Sent' and nullif(btrim(p_invoice_number), '') is null then raise exception 'Invoice number is required when an invoice is sent' using errcode = '22023'; end if;
  if status_value = 'Void' and public.receivable_balance(p_load_id) > 0 then
    raise exception 'Reconcile the outstanding balance before voiding the invoice' using errcode = '22023';
  end if;
  resolved_due := case when p_invoice_date is null then null else coalesce(p_due_date, p_invoice_date + p_payment_terms_days) end;
  if resolved_due is not null and resolved_due < p_invoice_date then raise exception 'Due date cannot be before invoice date' using errcode = '22023'; end if;
  if p_collection_owner_id is not null and not exists (
    select 1 from public.organization_members where user_id = p_collection_owner_id and organization_id = public.current_organization_id()
  ) then raise exception 'Collection owner must belong to your organization' using errcode = '23503'; end if;

  update public.payments
  set invoice_status = status_value,
      invoice_sent = status_value = 'Sent',
      invoice_number = nullif(btrim(p_invoice_number), ''),
      invoice_date = p_invoice_date,
      invoice_sent_date = case when status_value = 'Sent' then p_invoice_date else null end,
      payment_terms_days = p_payment_terms_days,
      due_date = case when status_value = 'Void' then null else resolved_due end,
      collection_owner_id = p_collection_owner_id,
      next_follow_up_date = case when status_value = 'Void' then null else p_next_follow_up_date end
  where load_id = p_load_id and organization_id = public.current_organization_id();

  insert into public.activity_logs(load_id, action)
  values (p_load_id, 'Invoice and collection details updated');
end;
$$;

create or replace function public.record_receivable_entry(
  p_load_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_entry_date date,
  p_note text
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  kind public.receivable_entry_type;
  entry_id uuid;
  remaining numeric;
  reduction numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.loads where id = p_load_id and organization_id = public.current_organization_id() for update) then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.payments
    where load_id = p_load_id
      and organization_id = public.current_organization_id()
      and invoice_status = 'Void'
  ) then
    raise exception 'Cannot record entries against a void invoice' using errcode = '22023';
  end if;
  kind := p_entry_type::public.receivable_entry_type;
  if p_amount is null or p_amount = 0 or (kind <> 'Adjustment' and p_amount < 0) then raise exception 'Enter a valid non-zero amount' using errcode = '22023'; end if;
  if kind in ('Credit', 'Write-off') and nullif(btrim(p_note), '') is null then raise exception 'Credits and write-offs require a note' using errcode = '22023'; end if;
  remaining := public.receivable_balance(p_load_id);
  reduction := case when kind = 'Adjustment' then greatest(-p_amount, 0) else p_amount end;
  if reduction > remaining then raise exception 'Entry exceeds the outstanding balance' using errcode = '22023'; end if;

  insert into public.receivable_entries(load_id, entry_type, amount, entry_date, note)
  values (p_load_id, kind, p_amount, coalesce(p_entry_date, current_date), nullif(btrim(p_note), ''))
  returning id into entry_id;
  perform public.sync_receivable_payment_summary(p_load_id);
  insert into public.activity_logs(load_id, action)
  values (p_load_id, kind::text || ' recorded: $' || trim(to_char(abs(p_amount), 'FM9999999990.00')));
  return entry_id;
end;
$$;

create or replace function public.record_collection_contact(
  p_load_id uuid, p_contact_type text, p_contacted_at timestamptz, p_note text, p_next_follow_up_date date
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare contact_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.loads where id = p_load_id and organization_id = public.current_organization_id()) then raise exception 'Load not found' using errcode = 'P0002'; end if;
  insert into public.collection_contacts(load_id, contact_type, contacted_at, note)
  values (p_load_id, p_contact_type::public.collection_contact_type, coalesce(p_contacted_at, now()), btrim(p_note)) returning id into contact_id;
  update public.payments
  set next_follow_up_date = case when invoice_status = 'Void' then null else p_next_follow_up_date end
  where load_id = p_load_id and organization_id = public.current_organization_id();
  insert into public.activity_logs(load_id, action) values (p_load_id, 'Collection ' || lower(p_contact_type) || ' logged');
  return contact_id;
end;
$$;

create or replace function public.collection_owner_options()
returns table(id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = public.current_organization_id()
  order by coalesce(p.full_name, p.email), p.email
$$;

-- Load edits continue to manage driver and dispatcher disbursements, but invoice
-- and client receivable facts are exclusively owned by the collections ledger.
create or replace function public.update_load_with_payment(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb,
  p_deductions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deduction jsonb;
  deduction_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then
    raise exception 'Load deductions must be an array' using errcode = '22023';
  end if;

  update public.loads
  set load_number = p_load ->> 'load_number',
      broker_id = nullif(p_load ->> 'broker_id', '')::uuid,
      carrier_company = nullif(p_load ->> 'carrier_company', ''),
      driver_id = nullif(p_load ->> 'driver_id', '')::uuid,
      fleet_company = nullif(p_load ->> 'fleet_company', ''),
      truck_unit_id = nullif(p_load ->> 'truck_unit_id', '')::uuid,
      trailer_unit_id = nullif(p_load ->> 'trailer_unit_id', '')::uuid,
      pickup_location = p_load ->> 'pickup_location',
      pickup_date = nullif(p_load ->> 'pickup_date', '')::date,
      delivery_location = p_load ->> 'delivery_location',
      delivery_date = nullif(p_load ->> 'delivery_date', '')::date,
      is_round_trip = coalesce((p_load ->> 'is_round_trip')::boolean, false),
      return_location = nullif(p_load ->> 'return_location', ''),
      round_trip_details = nullif(p_load ->> 'round_trip_details', ''),
      load_rate = coalesce((p_load ->> 'load_rate')::numeric, 0),
      driver_pay = coalesce((p_load ->> 'driver_pay')::numeric, 0),
      dispatcher_fee = coalesce((p_load ->> 'dispatcher_fee')::numeric, 0),
      fuel_cost = coalesce((p_load ->> 'fuel_cost')::numeric, 0),
      factoring_mode = coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
      factoring_percent = coalesce((p_load ->> 'factoring_percent')::numeric, 0),
      factoring_fixed_amount = coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
      notes = nullif(p_load ->> 'notes', ''),
      status = (p_load ->> 'status')::public.load_status
  where id = p_load_id;
  if not found then raise exception 'Load not found' using errcode = 'P0002'; end if;

  delete from public.load_deductions where load_id = p_load_id;
  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions(load_id, label, amount, position)
    values (
      p_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

  insert into public.payments (
    load_id, driver_paid, driver_amount_paid, driver_date_paid,
    dispatcher_fee_amount, dispatcher_paid, dispatcher_date_paid
  ) values (
    p_load_id,
    coalesce((p_payment ->> 'driver_paid')::boolean, false),
    coalesce((p_payment ->> 'driver_amount_paid')::numeric, 0),
    nullif(p_payment ->> 'driver_date_paid', '')::date,
    coalesce((p_payment ->> 'dispatcher_fee_amount')::numeric, 0),
    coalesce((p_payment ->> 'dispatcher_paid')::boolean, false),
    nullif(p_payment ->> 'dispatcher_date_paid', '')::date
  )
  on conflict (load_id) do update
  set driver_paid = excluded.driver_paid,
      driver_amount_paid = excluded.driver_amount_paid,
      driver_date_paid = excluded.driver_date_paid,
      dispatcher_fee_amount = excluded.dispatcher_fee_amount,
      dispatcher_paid = excluded.dispatcher_paid,
      dispatcher_date_paid = excluded.dispatcher_date_paid;

  insert into public.activity_logs(load_id, action)
  values (p_load_id, 'Load and payment details updated');
end;
$$;

grant execute on function public.receivable_balance(uuid) to authenticated;
grant execute on function public.invoice_aging_bucket(date, date) to authenticated;
grant execute on function public.update_invoice_collection(uuid, text, text, date, integer, date, uuid, date) to authenticated;
grant execute on function public.record_receivable_entry(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.record_collection_contact(uuid, text, timestamptz, text, date) to authenticated;
grant execute on function public.collection_owner_options() to authenticated;

revoke all on function public.update_invoice_collection(uuid, text, text, date, integer, date, uuid, date) from public, anon;
revoke all on function public.record_receivable_entry(uuid, text, numeric, date, text) from public, anon;
revoke all on function public.record_collection_contact(uuid, text, timestamptz, text, date) from public, anon;
revoke all on function public.collection_owner_options() from public, anon;

comment on column public.payments.invoice_date is 'Set explicitly or from the existing invoice-sent date; never inferred from delivery.';
comment on column public.payments.due_date is 'Contractual invoice due date used for collections aging.';

notify pgrst, 'reload schema';

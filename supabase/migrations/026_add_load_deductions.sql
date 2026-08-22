-- Track load-level factoring and labeled deductions separately from dispatcher fees.

alter table public.loads
  add column factoring_percent numeric(5, 2) not null default 0
    check (factoring_percent >= 0 and factoring_percent <= 100),
  add column factoring_amount numeric(12, 2)
    generated always as (round(load_rate * factoring_percent / 100, 2)) stored;

alter table public.loads alter column factoring_amount set not null;

create table public.load_deductions (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads(id) on delete cascade,
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete restrict,
  label text not null check (btrim(label) <> ''),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index load_deductions_load_position_idx
on public.load_deductions(load_id, position, created_at);

create index load_deductions_organization_idx
on public.load_deductions(organization_id);

create trigger load_deductions_set_updated_at
before update on public.load_deductions
for each row execute function public.set_updated_at();

create trigger load_deductions_validate_load_tenant
before insert or update of organization_id, load_id on public.load_deductions
for each row execute function public.validate_tenant_reference('loads', 'load_id');

alter table public.load_deductions enable row level security;

create policy "Members can manage tenant rows"
on public.load_deductions for all to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

grant select, insert, update, delete on table public.load_deductions to authenticated;

create or replace function public.create_load_with_deductions(
  p_load jsonb,
  p_deductions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_load_id uuid;
  deduction jsonb;
  deduction_position integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then
    raise exception 'Load deductions must be an array' using errcode = '22023';
  end if;

  insert into public.loads (
    load_number,
    broker_id,
    carrier_company,
    driver_id,
    pickup_location,
    pickup_date,
    delivery_location,
    delivery_date,
    is_round_trip,
    return_location,
    round_trip_details,
    load_rate,
    driver_pay,
    dispatcher_fee,
    fuel_cost,
    factoring_percent,
    notes,
    status
  ) values (
    p_load ->> 'load_number',
    nullif(p_load ->> 'broker_id', '')::uuid,
    nullif(p_load ->> 'carrier_company', ''),
    nullif(p_load ->> 'driver_id', '')::uuid,
    p_load ->> 'pickup_location',
    nullif(p_load ->> 'pickup_date', '')::date,
    p_load ->> 'delivery_location',
    nullif(p_load ->> 'delivery_date', '')::date,
    coalesce((p_load ->> 'is_round_trip')::boolean, false),
    nullif(p_load ->> 'return_location', ''),
    nullif(p_load ->> 'round_trip_details', ''),
    coalesce((p_load ->> 'load_rate')::numeric, 0),
    coalesce((p_load ->> 'driver_pay')::numeric, 0),
    coalesce((p_load ->> 'dispatcher_fee')::numeric, 0),
    coalesce((p_load ->> 'fuel_cost')::numeric, 0),
    coalesce((p_load ->> 'factoring_percent')::numeric, 0),
    nullif(p_load ->> 'notes', ''),
    (p_load ->> 'status')::public.load_status
  )
  returning id into created_load_id;

  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions (load_id, label, amount, position)
    values (
      created_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

  return created_load_id;
end;
$$;

revoke all on function public.create_load_with_deductions(jsonb, jsonb) from public;
revoke all on function public.create_load_with_deductions(jsonb, jsonb) from anon;
grant execute on function public.create_load_with_deductions(jsonb, jsonb) to authenticated;

drop function public.update_load_with_payment(uuid, jsonb, jsonb);

create function public.update_load_with_payment(
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
      factoring_percent = coalesce((p_load ->> 'factoring_percent')::numeric, 0),
      notes = nullif(p_load ->> 'notes', ''),
      status = (p_load ->> 'status')::public.load_status
  where id = p_load_id;

  if not found then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  delete from public.load_deductions where load_id = p_load_id;

  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions (load_id, label, amount, position)
    values (
      p_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

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

revoke all on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb) from anon;
grant execute on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb) to authenticated;

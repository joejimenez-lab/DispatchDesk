-- Remove the collections workflow while preserving its reconciled balances in
-- the original payment summary fields used by DispatchDesk.

drop view if exists public.load_list_index;

with reconciled as (
  select
    entry.load_id,
    greatest(sum(
      case when entry.entry_type = 'Adjustment' then -entry.amount else entry.amount end
    ), 0) as amount_received,
    max(entry.entry_date) filter (where entry.entry_type = 'Payment') as payment_date
  from public.receivable_entries entry
  group by entry.load_id
)
update public.payments payment
set client_amount_received = reconciled.amount_received,
    client_paid = reconciled.amount_received >= greatest(load.load_rate - 0.01, 0),
    client_date_received = case
      when reconciled.amount_received > 0 then coalesce(reconciled.payment_date, payment.client_date_received)
      else null
    end
from reconciled
join public.loads load on load.id = reconciled.load_id
where payment.load_id = reconciled.load_id;

drop trigger if exists payments_validate_collection_owner on public.payments;
drop trigger if exists payments_validate_invoice_state on public.payments;

drop function if exists public.collection_owner_options();
drop function if exists public.record_collection_contact(uuid, text, timestamptz, text, date);
drop function if exists public.record_receivable_entry(uuid, text, numeric, date, text);
drop function if exists public.update_invoice_collection(uuid, text, text, date, integer, date, uuid, date);
drop function if exists public.sync_receivable_payment_summary(uuid);
drop function if exists public.validate_invoice_state();
drop function if exists public.validate_collection_owner();
drop function if exists public.receivable_balance(uuid);
drop function if exists public.invoice_aging_bucket(date, date);

drop table if exists public.collection_contacts;
drop table if exists public.receivable_entries;
drop function if exists public.receivable_entry_effect(public.receivable_entry_type, numeric);

drop index if exists public.payments_invoice_number_org_unique;
drop index if exists public.payments_collections_due_idx;
drop index if exists public.payments_collections_owner_idx;

alter table public.payments
  drop column if exists invoice_status,
  drop column if exists invoice_number,
  drop column if exists invoice_date,
  drop column if exists payment_terms_days,
  drop column if exists due_date,
  drop column if exists collection_owner_id,
  drop column if exists next_follow_up_date;

drop type if exists public.collection_contact_type;
drop type if exists public.receivable_entry_type;
drop type if exists public.invoice_status;

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
    load_id, invoice_sent, invoice_sent_date,
    client_paid, client_amount_received, client_date_received,
    driver_paid, driver_amount_paid, driver_date_paid,
    dispatcher_fee_amount, dispatcher_paid, dispatcher_date_paid
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

  insert into public.activity_logs(load_id, action)
  values (p_load_id, 'Load and payment details updated');
end;
$$;

create view public.load_list_index
with (security_invoker = true)
as
select
  load.id,
  load.status,
  load.post_delivery_status,
  load.broker_id,
  load.driver_id,
  load.fleet_company,
  load.pickup_date,
  load.delivery_date,
  load.created_at,
  case
    when load.status = 'Cancelled' then true
    else coalesce(payment.client_paid, false)
      or greatest(load.load_rate - coalesce(payment.client_amount_received, 0), 0) <= 0.01
  end as client_paid,
  concat_ws(
    ' ',
    load.load_number,
    load.pickup_location,
    load.delivery_location,
    load.return_location,
    load.carrier_company,
    load.fleet_company,
    load.truck_number,
    load.trailer_number,
    load.commodity,
    load.special_instructions,
    broker.company_name,
    broker.contact_name,
    broker.email,
    broker.phone,
    driver.name,
    driver.email,
    driver.phone,
    driver.truck_number,
    driver.trailer_number,
    stop_search.search_text
  ) as search_text,
  load.driver_pay_known,
  load.dispatcher_fee_known,
  load.fuel_cost_known
from public.loads load
left join public.payments payment on payment.load_id = load.id
left join public.brokers broker on broker.id = load.broker_id
left join public.drivers driver on driver.id = load.driver_id
left join lateral (
  select string_agg(
    concat_ws(' ', stop.stop_type, stop.location, stop.appointment_number, stop.reference_number, stop.instructions),
    ' ' order by stop.position
  ) as search_text
  from public.load_stops stop
  where stop.load_id = load.id
) stop_search on true;

comment on view public.load_list_index is
  'Security-invoker index for tenant-scoped load list search, payment state, filters, and pagination.';

revoke all on public.load_list_index from anon;
grant select on public.load_list_index to authenticated, service_role;
grant execute on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

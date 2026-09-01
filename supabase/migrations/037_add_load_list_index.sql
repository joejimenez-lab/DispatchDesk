-- Tenant-safe read model for server-side load search and pagination.
-- The view keeps payment completeness and related-record search in Postgres so
-- high-volume filters never need an unbounded client-side ID scan.

create or replace view public.load_list_index
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
    when payment.invoice_status = 'Void' then null
    when load.status = 'Cancelled' then true
    else greatest(load.load_rate - coalesce(receivable.reconciled_amount, 0), 0) <= 0.01
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
from public.loads as load
left join public.payments as payment on payment.load_id = load.id
left join lateral (
  select coalesce(sum(public.receivable_entry_effect(entry.entry_type, entry.amount)), 0) as reconciled_amount
  from public.receivable_entries as entry
  where entry.load_id = load.id
) as receivable on true
left join public.brokers as broker on broker.id = load.broker_id
left join public.drivers as driver on driver.id = load.driver_id
left join lateral (
  select string_agg(
    concat_ws(' ', stop.stop_type, stop.location, stop.appointment_number, stop.reference_number, stop.instructions),
    ' ' order by stop.position
  ) as search_text
  from public.load_stops as stop
  where stop.load_id = load.id
) as stop_search on true;

comment on view public.load_list_index is
  'Security-invoker index for tenant-scoped load list search, payment state, filters, and pagination.';

revoke all on public.load_list_index from anon;
grant select on public.load_list_index to authenticated, service_role;

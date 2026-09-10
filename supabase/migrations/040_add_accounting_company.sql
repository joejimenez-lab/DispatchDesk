-- Accounting follows the carrier named on the load, independently of equipment.
-- Preserve the original carrier text and normalize known historical spellings.
create or replace function public.normalize_accounting_company(value text)
returns text language sql immutable parallel safe
set search_path = public
as $$
  select case upper(nullif(btrim(value), ''))
    when 'DC GEMS CORP' then 'DC'
    when 'RD FREIGH' then 'RD'
    when 'RD FREIGHT LOGISTICS' then 'RD'
    when 'J S' then 'JS'
    else upper(nullif(btrim(value), ''))
  end;
$$;

alter table public.loads add column accounting_company text
  generated always as (public.normalize_accounting_company(carrier_company)) stored;
create index loads_organization_accounting_company_idx
  on public.loads (organization_id, accounting_company);
comment on column public.loads.accounting_company is
  'Normalized carrier company for accounting; never derived from the hauling fleet.';

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
  load.fuel_cost_known,
  load.accounting_company
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

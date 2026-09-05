-- Audit only the fixed DispatchDesk Demo tenant. This query never aggregates
-- another organization's business rows into the demo report.
with demo as (
  select '00000000-0000-4000-8000-000000000001'::uuid organization_id
), metrics as (
  select 'drivers' metric, count(*)::text value
  from public.drivers, demo
  where drivers.organization_id = demo.organization_id

  union all
  select 'brokers', count(*)::text
  from public.brokers, demo
  where brokers.organization_id = demo.organization_id

  union all
  select 'loads', count(*)::text
  from public.loads, demo
  where loads.organization_id = demo.organization_id

  union all
  select 'load_statuses', coalesce(string_agg(status::text || ':' || count::text, ', ' order by status::text), '')
  from (
    select status, count(*)
    from public.loads, demo
    where loads.organization_id = demo.organization_id
    group by status
  ) statuses

  union all
  select 'payments', count(*)::text
  from public.payments, demo
  where payments.organization_id = demo.organization_id

  union all
  select 'activity_logs', count(*)::text
  from public.activity_logs, demo
  where activity_logs.organization_id = demo.organization_id

  union all
  select 'load_stops', count(*)::text
  from public.load_stops, demo
  where load_stops.organization_id = demo.organization_id

  union all
  select 'contact_merge_logs', count(*)::text
  from public.contact_merge_logs, demo
  where contact_merge_logs.organization_id = demo.organization_id

  union all
  select 'documents', count(*)::text
  from public.documents, demo
  where documents.organization_id = demo.organization_id

  union all
  select 'maintenance_rows', (
    (select count(*) from public.fleet_units, demo where fleet_units.organization_id = demo.organization_id) +
    (select count(*) from public.service_records, demo where service_records.organization_id = demo.organization_id) +
    (select count(*) from public.inspection_records, demo where inspection_records.organization_id = demo.organization_id) +
    (select count(*) from public.repair_logs, demo where repair_logs.organization_id = demo.organization_id) +
    (select count(*) from public.maintenance_reminders, demo where maintenance_reminders.organization_id = demo.organization_id)
  )::text

  union all
  select 'ifta_rows', (
    (select count(*) from public.ifta_trips, demo where ifta_trips.organization_id = demo.organization_id) +
    (select count(*) from public.ifta_trip_miles, demo where ifta_trip_miles.organization_id = demo.organization_id) +
    (select count(*) from public.ifta_fuel_purchases, demo where ifta_fuel_purchases.organization_id = demo.organization_id) +
    (select count(*) from public.ifta_drafts, demo where ifta_drafts.organization_id = demo.organization_id)
  )::text

  union all
  select 'bookkeeping_rows', (
    (select count(*) from public.bookkeeping_expense_groups, demo where bookkeeping_expense_groups.organization_id = demo.organization_id) +
    (select count(*) from public.bookkeeping_expenses, demo where bookkeeping_expenses.organization_id = demo.organization_id) +
    (select count(*) from public.bookkeeping_receipts, demo where bookkeeping_receipts.organization_id = demo.organization_id)
  )::text
)
select * from metrics order by metric;

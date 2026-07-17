with metrics as (
  select 'fleet_companies' metric, string_agg(distinct company, ', ' order by company) value from public.fleet_units
  union all select 'fleet_units', count(*)::text from public.fleet_units
  union all select 'drivers', count(*)::text from public.drivers
  union all select 'brokers', count(*)::text from public.brokers
  union all select 'loads', count(*)::text from public.loads
  union all select 'load_statuses', string_agg(status::text || ':' || count::text, ', ' order by status::text) from (select status, count(*) from public.loads group by status) statuses
  union all select 'round_trips', count(*)::text from public.loads where is_round_trip
  union all select 'partial_client_payments', count(*)::text from public.payments p join public.loads l on l.id = p.load_id where p.client_amount_received > 0 and p.client_amount_received < l.load_rate
  union all select 'aged_unpaid_loads', count(*)::text from public.loads l join public.payments p on p.load_id = l.id where l.status <> 'Cancelled' and coalesce(l.delivery_date, l.pickup_date) <= current_date - 30 and p.client_amount_received < l.load_rate
  union all select 'active_reminders', count(*)::text from public.maintenance_reminders where completed_at is null
  union all select 'completed_reminders', count(*)::text from public.maintenance_reminders where completed_at is not null
  union all select 'maintenance_history', ((select count(*) from public.service_records) + (select count(*) from public.inspection_records) + (select count(*) from public.repair_logs))::text
  union all select 'ifta_trips', count(*)::text from public.ifta_trips
  union all select 'ifta_state_legs', count(*)::text from public.ifta_trip_miles
  union all select 'ifta_fuel_purchases', count(*)::text from public.ifta_fuel_purchases
  union all select 'expense_groups', count(*)::text from public.bookkeeping_expense_groups
  union all select 'expense_categories', string_agg(distinct category::text, ', ' order by category::text) from public.bookkeeping_expenses
  union all select 'bookkeeping_receipts', count(*)::text from public.bookkeeping_receipts
  union all select 'load_documents', count(*)::text from public.documents
  union all select 'notes', count(*)::text from public.notes
  union all select 'load_storage_objects', count(*)::text from storage.objects where bucket_id = 'load-documents'
  union all select 'receipt_storage_objects', count(*)::text from storage.objects where bucket_id = 'bookkeeping-receipts'
  union all select 'missing_load_files', count(*)::text from public.documents d left join storage.objects o on o.bucket_id = 'load-documents' and o.name = d.storage_path where o.id is null
  union all select 'missing_receipt_files', count(*)::text from public.bookkeeping_receipts r left join storage.objects o on o.bucket_id = 'bookkeeping-receipts' and o.name = r.storage_path where o.id is null
  union all select 'receipt_size_mismatches', count(*)::text from public.bookkeeping_receipts r join storage.objects o on o.bucket_id = 'bookkeeping-receipts' and o.name = r.storage_path where r.file_size <> (o.metadata ->> 'size')::integer
  union all select 'unexpected_fleets', count(*)::text from public.fleet_units where company not in ('RD', 'RC') or company is null
  union all select 'unreconciled_operational_sources', (
    (select count(*) from public.service_records s where s.cost > 0 and not exists (select 1 from public.bookkeeping_expense_groups g where g.service_record_id = s.id)) +
    (select count(*) from public.inspection_records i where i.cost > 0 and not exists (select 1 from public.bookkeeping_expense_groups g where g.inspection_record_id = i.id)) +
    (select count(*) from public.repair_logs r where r.cost > 0 and not exists (select 1 from public.bookkeeping_expense_groups g where g.repair_log_id = r.id)) +
    (select count(*) from public.ifta_fuel_purchases f where f.amount_paid > 0 and not exists (select 1 from public.bookkeeping_expense_groups g where g.ifta_fuel_purchase_id = f.id))
  )::text
)
select * from metrics;

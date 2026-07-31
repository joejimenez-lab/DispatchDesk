-- Migration 021 originally added composite organization foreign keys beside
-- the existing single-column keys. PostgreSQL accepted both, but PostgREST
-- correctly treated embedded relationships as ambiguous. Keep the original
-- API relationships and enforce same-organization references with triggers.

alter table public.loads
  drop constraint if exists loads_organization_broker_fkey,
  drop constraint if exists loads_organization_driver_fkey;
alter table public.payments drop constraint if exists payments_organization_load_fkey;
alter table public.documents drop constraint if exists documents_organization_load_fkey;
alter table public.notes drop constraint if exists notes_organization_load_fkey;
alter table public.activity_logs drop constraint if exists activity_logs_organization_load_fkey;
alter table public.service_records drop constraint if exists service_records_organization_unit_fkey;
alter table public.inspection_records drop constraint if exists inspection_records_organization_unit_fkey;
alter table public.repair_logs drop constraint if exists repair_logs_organization_unit_fkey;
alter table public.maintenance_reminders drop constraint if exists maintenance_reminders_organization_unit_fkey;
alter table public.ifta_trip_miles drop constraint if exists ifta_trip_miles_organization_trip_fkey;
alter table public.ifta_fuel_purchases drop constraint if exists ifta_fuel_purchases_organization_unit_fkey;
alter table public.bookkeeping_expense_groups
  drop constraint if exists bookkeeping_groups_organization_unit_fkey,
  drop constraint if exists bookkeeping_groups_organization_load_fkey,
  drop constraint if exists bookkeeping_groups_organization_driver_fkey,
  drop constraint if exists bookkeeping_groups_organization_service_fkey,
  drop constraint if exists bookkeeping_groups_organization_inspection_fkey,
  drop constraint if exists bookkeeping_groups_organization_repair_fkey,
  drop constraint if exists bookkeeping_groups_organization_ifta_fkey;
alter table public.bookkeeping_expenses drop constraint if exists bookkeeping_expenses_organization_group_fkey;
alter table public.bookkeeping_receipts drop constraint if exists bookkeeping_receipts_organization_group_fkey;

alter table public.drivers drop constraint if exists drivers_organization_id_id_key;
alter table public.brokers drop constraint if exists brokers_organization_id_id_key;
alter table public.loads drop constraint if exists loads_organization_id_id_key;
alter table public.documents drop constraint if exists documents_organization_id_id_key;
alter table public.fleet_units drop constraint if exists fleet_units_organization_id_id_key;
alter table public.service_records drop constraint if exists service_records_organization_id_id_key;
alter table public.inspection_records drop constraint if exists inspection_records_organization_id_id_key;
alter table public.repair_logs drop constraint if exists repair_logs_organization_id_id_key;
alter table public.ifta_trips drop constraint if exists ifta_trips_organization_id_id_key;
alter table public.ifta_fuel_purchases drop constraint if exists ifta_fuel_purchases_organization_id_id_key;
alter table public.bookkeeping_expense_groups drop constraint if exists bookkeeping_expense_groups_organization_id_id_key;

create or replace function public.validate_tenant_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_id uuid := nullif(to_jsonb(new) ->> tg_argv[1], '')::uuid;
  parent_matches boolean;
begin
  if parent_id is null then
    return new;
  end if;

  execute format(
    'select exists (select 1 from public.%I where id = $1 and organization_id = $2)',
    tg_argv[0]
  )
  into parent_matches
  using parent_id, new.organization_id;

  if not parent_matches then
    raise foreign_key_violation using
      message = format('%s must belong to the same organization', tg_argv[1]);
  end if;

  return new;
end;
$$;

drop trigger if exists loads_validate_broker_tenant on public.loads;
drop trigger if exists loads_validate_driver_tenant on public.loads;
drop trigger if exists payments_validate_load_tenant on public.payments;
drop trigger if exists documents_validate_load_tenant on public.documents;
drop trigger if exists notes_validate_load_tenant on public.notes;
drop trigger if exists activity_logs_validate_load_tenant on public.activity_logs;
drop trigger if exists service_records_validate_unit_tenant on public.service_records;
drop trigger if exists inspection_records_validate_unit_tenant on public.inspection_records;
drop trigger if exists repair_logs_validate_unit_tenant on public.repair_logs;
drop trigger if exists maintenance_reminders_validate_unit_tenant on public.maintenance_reminders;
drop trigger if exists ifta_trip_miles_validate_trip_tenant on public.ifta_trip_miles;
drop trigger if exists ifta_fuel_validate_unit_tenant on public.ifta_fuel_purchases;
drop trigger if exists bookkeeping_groups_validate_unit_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_load_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_driver_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_service_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_inspection_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_repair_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_groups_validate_ifta_tenant on public.bookkeeping_expense_groups;
drop trigger if exists bookkeeping_expenses_validate_group_tenant on public.bookkeeping_expenses;
drop trigger if exists bookkeeping_receipts_validate_group_tenant on public.bookkeeping_receipts;

create trigger loads_validate_broker_tenant before insert or update of organization_id, broker_id on public.loads for each row execute function public.validate_tenant_reference('brokers', 'broker_id');
create trigger loads_validate_driver_tenant before insert or update of organization_id, driver_id on public.loads for each row execute function public.validate_tenant_reference('drivers', 'driver_id');
create trigger payments_validate_load_tenant before insert or update of organization_id, load_id on public.payments for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger documents_validate_load_tenant before insert or update of organization_id, load_id on public.documents for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger notes_validate_load_tenant before insert or update of organization_id, load_id on public.notes for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger activity_logs_validate_load_tenant before insert or update of organization_id, load_id on public.activity_logs for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger service_records_validate_unit_tenant before insert or update of organization_id, unit_id on public.service_records for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger inspection_records_validate_unit_tenant before insert or update of organization_id, unit_id on public.inspection_records for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger repair_logs_validate_unit_tenant before insert or update of organization_id, unit_id on public.repair_logs for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger maintenance_reminders_validate_unit_tenant before insert or update of organization_id, unit_id on public.maintenance_reminders for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger ifta_trip_miles_validate_trip_tenant before insert or update of organization_id, trip_id on public.ifta_trip_miles for each row execute function public.validate_tenant_reference('ifta_trips', 'trip_id');
create trigger ifta_fuel_validate_unit_tenant before insert or update of organization_id, unit_id on public.ifta_fuel_purchases for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger bookkeeping_groups_validate_unit_tenant before insert or update of organization_id, unit_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('fleet_units', 'unit_id');
create trigger bookkeeping_groups_validate_load_tenant before insert or update of organization_id, load_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('loads', 'load_id');
create trigger bookkeeping_groups_validate_driver_tenant before insert or update of organization_id, driver_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('drivers', 'driver_id');
create trigger bookkeeping_groups_validate_service_tenant before insert or update of organization_id, service_record_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('service_records', 'service_record_id');
create trigger bookkeeping_groups_validate_inspection_tenant before insert or update of organization_id, inspection_record_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('inspection_records', 'inspection_record_id');
create trigger bookkeeping_groups_validate_repair_tenant before insert or update of organization_id, repair_log_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('repair_logs', 'repair_log_id');
create trigger bookkeeping_groups_validate_ifta_tenant before insert or update of organization_id, ifta_fuel_purchase_id on public.bookkeeping_expense_groups for each row execute function public.validate_tenant_reference('ifta_fuel_purchases', 'ifta_fuel_purchase_id');
create trigger bookkeeping_expenses_validate_group_tenant before insert or update of organization_id, group_id on public.bookkeeping_expenses for each row execute function public.validate_tenant_reference('bookkeeping_expense_groups', 'group_id');
create trigger bookkeeping_receipts_validate_group_tenant before insert or update of organization_id, group_id on public.bookkeeping_receipts for each row execute function public.validate_tenant_reference('bookkeeping_expense_groups', 'group_id');

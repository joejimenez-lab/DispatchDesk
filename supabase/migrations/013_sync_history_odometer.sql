-- Keep fleet mileage current when maintenance history is entered manually.
-- Odometers are monotonic: older history never lowers the current reading.

create or replace function public.sync_fleet_odometer_from_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.odometer is not null then
    update public.fleet_units
    set odometer = greatest(coalesce(odometer, 0), new.odometer)
    where id = new.unit_id;
  end if;

  return new;
end;
$$;

create trigger service_records_sync_fleet_odometer
after insert or update of unit_id, odometer on public.service_records
for each row execute function public.sync_fleet_odometer_from_history();

create trigger inspection_records_sync_fleet_odometer
after insert or update of unit_id, odometer on public.inspection_records
for each row execute function public.sync_fleet_odometer_from_history();

create trigger repair_logs_sync_fleet_odometer
after insert or update of unit_id, odometer on public.repair_logs
for each row execute function public.sync_fleet_odometer_from_history();

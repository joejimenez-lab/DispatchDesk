-- Keep the database terminology aligned with the user-facing Fleet module.

alter table public.maintenance_units rename to fleet_units;

alter index public.maintenance_units_type_idx rename to fleet_units_type_idx;
alter index public.maintenance_units_search_idx rename to fleet_units_search_idx;

alter trigger maintenance_units_set_updated_at
on public.fleet_units
rename to fleet_units_set_updated_at;

alter policy "Authenticated users can manage maintenance units"
on public.fleet_units
rename to "Authenticated users can manage fleet units";

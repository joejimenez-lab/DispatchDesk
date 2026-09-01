alter table public.loads
  add column if not exists driver_pay_known boolean not null default false,
  add column if not exists dispatcher_fee_known boolean not null default false,
  add column if not exists fuel_cost_known boolean not null default false;

-- Historical non-zero amounts are known values. Historical zeroes remain
-- unconfirmed because earlier versions could not distinguish zero from blank.
alter table public.loads disable trigger loads_log_changes;
alter table public.loads disable trigger loads_set_updated_at;
update public.loads set
  driver_pay_known = driver_pay_known or driver_pay <> 0,
  dispatcher_fee_known = dispatcher_fee_known or dispatcher_fee <> 0,
  fuel_cost_known = fuel_cost_known or fuel_cost <> 0;
alter table public.loads enable trigger loads_log_changes;
alter table public.loads enable trigger loads_set_updated_at;

create or replace function public.create_load_with_deductions(
  p_load jsonb,
  p_deductions jsonb,
  p_stops jsonb,
  p_financial_completeness jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_load_id uuid;
begin
  new_load_id := public.create_load_with_deductions(p_load, p_deductions, p_stops);
  update public.loads set
    driver_pay_known = coalesce((p_financial_completeness ->> 'driver_pay_known')::boolean, false),
    dispatcher_fee_known = coalesce((p_financial_completeness ->> 'dispatcher_fee_known')::boolean, false),
    fuel_cost_known = coalesce((p_financial_completeness ->> 'fuel_cost_known')::boolean, false)
  where id = new_load_id;
  return new_load_id;
end;
$$;

create or replace function public.update_load_with_payment(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb,
  p_deductions jsonb,
  p_stops jsonb,
  p_financial_completeness jsonb
) returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.update_load_with_payment(p_load_id, p_load, p_payment, p_deductions, p_stops);
  update public.loads set
    driver_pay_known = coalesce((p_financial_completeness ->> 'driver_pay_known')::boolean, false),
    dispatcher_fee_known = coalesce((p_financial_completeness ->> 'dispatcher_fee_known')::boolean, false),
    fuel_cost_known = coalesce((p_financial_completeness ->> 'fuel_cost_known')::boolean, false)
  where id = p_load_id;
  if not found then raise exception 'Load not found' using errcode = 'P0002'; end if;
end;
$$;

grant execute on function public.create_load_with_deductions(jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_load_with_payment(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

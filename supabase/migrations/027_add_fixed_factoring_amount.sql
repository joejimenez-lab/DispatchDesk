-- Let factoring be recorded as either a percentage of the load rate or a fixed amount.

alter table public.loads
  add column factoring_mode text not null default 'percentage'
    check (factoring_mode in ('percentage', 'amount')),
  add column factoring_fixed_amount numeric(12, 2) not null default 0
    check (factoring_fixed_amount >= 0);

alter table public.loads drop column factoring_amount;

alter table public.loads
  add column factoring_amount numeric(12, 2)
    generated always as (
      case factoring_mode
        when 'amount' then factoring_fixed_amount
        else round(load_rate * factoring_percent / 100, 2)
      end
    ) stored;

alter table public.loads alter column factoring_amount set not null;

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
    factoring_mode,
    factoring_percent,
    factoring_fixed_amount,
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
    coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
    coalesce((p_load ->> 'factoring_percent')::numeric, 0),
    coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
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

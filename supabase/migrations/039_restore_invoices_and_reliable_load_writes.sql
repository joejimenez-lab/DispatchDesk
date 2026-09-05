-- Restore focused invoice records without restoring the removed collections
-- ledger, aging dashboard, contact history, or ownership workflow. Also give
-- the application one stable, fully atomic load-write RPC instead of relying
-- on the historical chain of overloaded wrapper functions.

alter table public.payments
  add column invoice_status text,
  add column invoice_number text,
  add column invoice_date date,
  add column payment_terms_days integer,
  add column due_date date;

alter table public.payments
  add constraint payments_invoice_status_check
    check (invoice_status is null or invoice_status in ('Draft', 'Sent', 'Void')),
  add constraint payments_payment_terms_days_check
    check (payment_terms_days is null or payment_terms_days between 0 and 365),
  add constraint payments_due_after_invoice_check
    check (due_date is null or invoice_date is null or due_date >= invoice_date);

update public.payments
set invoice_status = 'Sent',
    invoice_date = invoice_sent_date,
    payment_terms_days = 30,
    due_date = case when invoice_sent_date is null then null else invoice_sent_date + 30 end
where invoice_sent;

create unique index payments_invoice_number_org_unique
  on public.payments (organization_id, lower(invoice_number))
  where invoice_number is not null and btrim(invoice_number) <> '' and invoice_status <> 'Void';

create or replace function public.save_load(
  p_load_id uuid,
  p_load jsonb,
  p_payment jsonb,
  p_deductions jsonb,
  p_stops jsonb,
  p_financial_completeness jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_load_id uuid := p_load_id;
  deduction jsonb;
  deduction_position integer := 0;
  stop jsonb;
  stop_position integer := 0;
  stop_timezone text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_load, '{}'::jsonb)) <> 'object' then
    raise exception 'Load details must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_deductions, '[]'::jsonb)) <> 'array' then
    raise exception 'Load deductions must be an array' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_stops, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_stops, '[]'::jsonb)) < 2 then
    raise exception 'A load requires at least two stops' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Pickup')
    or not exists (select 1 from jsonb_array_elements(p_stops) item where item ->> 'stop_type' = 'Delivery') then
    raise exception 'A load requires a pickup and delivery stop' using errcode = '22023';
  end if;
  if p_payment is not null and jsonb_typeof(p_payment) <> 'object' then
    raise exception 'Payment details must be an object' using errcode = '22023';
  end if;

  if saved_load_id is null then
    insert into public.loads (
      load_number, broker_id, carrier_company, driver_id,
      fleet_company, truck_unit_id, trailer_unit_id,
      pickup_location, pickup_date, delivery_location, delivery_date,
      is_round_trip, return_location, round_trip_details,
      load_rate, driver_pay, dispatcher_fee, fuel_cost,
      driver_pay_known, dispatcher_fee_known, fuel_cost_known,
      factoring_mode, factoring_percent, factoring_fixed_amount,
      commodity, weight_lbs, pallet_count, special_instructions,
      notes, status
    ) values (
      p_load ->> 'load_number',
      nullif(p_load ->> 'broker_id', '')::uuid,
      nullif(p_load ->> 'carrier_company', ''),
      nullif(p_load ->> 'driver_id', '')::uuid,
      nullif(p_load ->> 'fleet_company', ''),
      nullif(p_load ->> 'truck_unit_id', '')::uuid,
      nullif(p_load ->> 'trailer_unit_id', '')::uuid,
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
      coalesce((p_financial_completeness ->> 'driver_pay_known')::boolean, false),
      coalesce((p_financial_completeness ->> 'dispatcher_fee_known')::boolean, false),
      coalesce((p_financial_completeness ->> 'fuel_cost_known')::boolean, false),
      coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
      coalesce((p_load ->> 'factoring_percent')::numeric, 0),
      coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
      nullif(btrim(p_load ->> 'commodity'), ''),
      nullif(p_load ->> 'weight_lbs', '')::numeric,
      nullif(p_load ->> 'pallet_count', '')::integer,
      nullif(btrim(p_load ->> 'special_instructions'), ''),
      nullif(p_load ->> 'notes', ''),
      (p_load ->> 'status')::public.load_status
    ) returning id into saved_load_id;
  else
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
        driver_pay_known = coalesce((p_financial_completeness ->> 'driver_pay_known')::boolean, false),
        dispatcher_fee_known = coalesce((p_financial_completeness ->> 'dispatcher_fee_known')::boolean, false),
        fuel_cost_known = coalesce((p_financial_completeness ->> 'fuel_cost_known')::boolean, false),
        factoring_mode = coalesce(nullif(p_load ->> 'factoring_mode', ''), 'percentage'),
        factoring_percent = coalesce((p_load ->> 'factoring_percent')::numeric, 0),
        factoring_fixed_amount = coalesce((p_load ->> 'factoring_fixed_amount')::numeric, 0),
        commodity = nullif(btrim(p_load ->> 'commodity'), ''),
        weight_lbs = nullif(p_load ->> 'weight_lbs', '')::numeric,
        pallet_count = nullif(p_load ->> 'pallet_count', '')::integer,
        special_instructions = nullif(btrim(p_load ->> 'special_instructions'), ''),
        notes = nullif(p_load ->> 'notes', ''),
        status = (p_load ->> 'status')::public.load_status
    where id = saved_load_id;
    if not found then raise exception 'Load not found' using errcode = 'P0002'; end if;
  end if;

  delete from public.load_deductions where load_id = saved_load_id;
  for deduction in select * from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb))
  loop
    insert into public.load_deductions (load_id, label, amount, position)
    values (
      saved_load_id,
      btrim(deduction ->> 'label'),
      coalesce((deduction ->> 'amount')::numeric, 0),
      deduction_position
    );
    deduction_position := deduction_position + 1;
  end loop;

  delete from public.load_stops where load_id = saved_load_id;
  for stop in select * from jsonb_array_elements(p_stops)
  loop
    stop_timezone := nullif(btrim(stop ->> 'time_zone'), '');
    if stop_timezone is not null and not exists (select 1 from pg_timezone_names where name = stop_timezone) then
      raise exception 'Unknown stop time zone: %', stop_timezone using errcode = '22023';
    end if;
    insert into public.load_stops (
      load_id, position, stop_type, location, scheduled_start, scheduled_end,
      schedule_precision, time_zone, appointment_number, reference_number, instructions
    ) values (
      saved_load_id,
      stop_position,
      stop ->> 'stop_type',
      btrim(stop ->> 'location'),
      nullif(stop ->> 'scheduled_start', '')::timestamp,
      nullif(stop ->> 'scheduled_end', '')::timestamp,
      coalesce(nullif(stop ->> 'schedule_precision', ''), 'window'),
      stop_timezone,
      nullif(btrim(stop ->> 'appointment_number'), ''),
      nullif(btrim(stop ->> 'reference_number'), ''),
      nullif(btrim(stop ->> 'instructions'), '')
    );
    stop_position := stop_position + 1;
  end loop;

  update public.loads
  set pickup_location = (select location from public.load_stops where load_id = saved_load_id and stop_type = 'Pickup' order by position limit 1),
      pickup_date = (select scheduled_start::date from public.load_stops where load_id = saved_load_id and stop_type = 'Pickup' order by position limit 1),
      delivery_location = (select location from public.load_stops where load_id = saved_load_id and stop_type = 'Delivery' order by position limit 1),
      delivery_date = (select scheduled_start::date from public.load_stops where load_id = saved_load_id and stop_type = 'Delivery' order by position limit 1),
      is_round_trip = exists (select 1 from public.load_stops where load_id = saved_load_id and stop_type = 'Return'),
      return_location = (select location from public.load_stops where load_id = saved_load_id and stop_type = 'Return' order by position limit 1),
      round_trip_details = (select instructions from public.load_stops where load_id = saved_load_id and stop_type = 'Return' order by position limit 1)
  where id = saved_load_id;

  if p_payment is not null then
    update public.payments
    set invoice_sent = case when p_payment ? 'invoice_sent' then coalesce((p_payment ->> 'invoice_sent')::boolean, false) else invoice_sent end,
        invoice_sent_date = case when p_payment ? 'invoice_sent_date' then nullif(p_payment ->> 'invoice_sent_date', '')::date else invoice_sent_date end,
        client_paid = case when p_payment ? 'client_paid' then coalesce((p_payment ->> 'client_paid')::boolean, false) else client_paid end,
        client_amount_received = case when p_payment ? 'client_amount_received' then coalesce((p_payment ->> 'client_amount_received')::numeric, 0) else client_amount_received end,
        client_date_received = case when p_payment ? 'client_date_received' then nullif(p_payment ->> 'client_date_received', '')::date else client_date_received end,
        driver_paid = case when p_payment ? 'driver_paid' then coalesce((p_payment ->> 'driver_paid')::boolean, false) else driver_paid end,
        driver_amount_paid = case when p_payment ? 'driver_amount_paid' then coalesce((p_payment ->> 'driver_amount_paid')::numeric, 0) else driver_amount_paid end,
        driver_date_paid = case when p_payment ? 'driver_date_paid' then nullif(p_payment ->> 'driver_date_paid', '')::date else driver_date_paid end,
        dispatcher_fee_amount = case when p_payment ? 'dispatcher_fee_amount' then coalesce((p_payment ->> 'dispatcher_fee_amount')::numeric, 0) else dispatcher_fee_amount end,
        dispatcher_paid = case when p_payment ? 'dispatcher_paid' then coalesce((p_payment ->> 'dispatcher_paid')::boolean, false) else dispatcher_paid end,
        dispatcher_date_paid = case when p_payment ? 'dispatcher_date_paid' then nullif(p_payment ->> 'dispatcher_date_paid', '')::date else dispatcher_date_paid end
    where load_id = saved_load_id;
  end if;

  return saved_load_id;
end;
$$;

create or replace function public.save_invoice(
  p_load_id uuid,
  p_invoice_status text,
  p_invoice_number text,
  p_invoice_date date,
  p_payment_terms_days integer,
  p_due_date date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  status_value text := initcap(btrim(coalesce(p_invoice_status, '')));
  number_value text := nullif(btrim(p_invoice_number), '');
  terms_value integer := coalesce(p_payment_terms_days, 30);
  due_value date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if status_value not in ('Draft', 'Sent', 'Void') then
    raise exception 'Choose Draft, Sent, or Void for invoice status' using errcode = '22023';
  end if;
  if terms_value < 0 or terms_value > 365 then
    raise exception 'Payment terms must be between 0 and 365 days' using errcode = '22023';
  end if;
  if status_value = 'Sent' and (number_value is null or p_invoice_date is null) then
    raise exception 'Sent invoices require an invoice number and invoice date' using errcode = '22023';
  end if;

  due_value := case
    when p_invoice_date is null then null
    else coalesce(p_due_date, p_invoice_date + terms_value)
  end;
  if due_value is not null and due_value < p_invoice_date then
    raise exception 'Due date cannot be before invoice date' using errcode = '22023';
  end if;

  if not exists (select 1 from public.loads where id = p_load_id) then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  insert into public.payments (
    load_id, invoice_status, invoice_number, invoice_date,
    payment_terms_days, due_date, invoice_sent, invoice_sent_date
  ) values (
    p_load_id, status_value, number_value, p_invoice_date,
    terms_value, due_value, status_value = 'Sent',
    case when status_value = 'Sent' then p_invoice_date else null end
  )
  on conflict (load_id) do update
  set invoice_status = excluded.invoice_status,
      invoice_number = excluded.invoice_number,
      invoice_date = excluded.invoice_date,
      payment_terms_days = excluded.payment_terms_days,
      due_date = excluded.due_date,
      invoice_sent = excluded.invoice_sent,
      invoice_sent_date = excluded.invoice_sent_date;

  insert into public.activity_logs (load_id, action)
  values (p_load_id, 'Invoice saved as ' || status_value);

  return p_load_id;
end;
$$;

revoke all on function public.save_load(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.save_invoice(uuid, text, text, date, integer, date) from public, anon;
grant execute on function public.save_load(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_invoice(uuid, text, text, date, integer, date) to authenticated;

notify pgrst, 'reload schema';

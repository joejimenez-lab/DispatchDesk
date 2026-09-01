-- Reviewable IFTA imports from existing dispatch and bookkeeping records.
-- Drafts remain separate from posted IFTA totals until explicitly approved.

alter table public.ifta_trips
  add column source_load_id uuid references public.loads(id) on delete set null;

alter table public.ifta_fuel_purchases
  add column source_expense_group_id uuid references public.bookkeeping_expense_groups(id) on delete set null;

create unique index ifta_trips_source_load_idx
on public.ifta_trips(organization_id, source_load_id)
where source_load_id is not null;

create unique index ifta_fuel_source_expense_idx
on public.ifta_fuel_purchases(organization_id, source_expense_group_id)
where source_expense_group_id is not null;

create trigger ifta_trips_validate_source_load_tenant
before insert or update of organization_id, source_load_id on public.ifta_trips
for each row execute function public.validate_tenant_reference('loads', 'source_load_id');

create trigger ifta_fuel_validate_source_expense_tenant
before insert or update of organization_id, source_expense_group_id on public.ifta_fuel_purchases
for each row execute function public.validate_tenant_reference('bookkeeping_expense_groups', 'source_expense_group_id');

create table public.ifta_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete restrict,
  draft_type text not null check (draft_type in ('trip', 'fuel')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'excluded')),
  source_load_id uuid references public.loads(id) on delete cascade,
  source_expense_group_id uuid references public.bookkeeping_expense_groups(id) on delete cascade,
  report_date date not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  missing_fields text[] not null default '{}',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_trip_id uuid references public.ifta_trips(id) on delete set null,
  approved_fuel_purchase_id uuid references public.ifta_fuel_purchases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ifta_drafts_source_check check (
    (draft_type = 'trip' and source_load_id is not null and source_expense_group_id is null)
    or
    (draft_type = 'fuel' and source_load_id is null and source_expense_group_id is not null)
  ),
  constraint ifta_drafts_approval_check check (
    (status = 'approved' and reviewed_at is not null and reviewed_by is not null
      and ((draft_type = 'trip' and approved_trip_id is not null and approved_fuel_purchase_id is null)
        or (draft_type = 'fuel' and approved_trip_id is null and approved_fuel_purchase_id is not null)))
    or
    (status <> 'approved' and approved_trip_id is null and approved_fuel_purchase_id is null)
  )
);

create unique index ifta_drafts_load_source_idx
on public.ifta_drafts(organization_id, source_load_id)
where source_load_id is not null;

create unique index ifta_drafts_expense_source_idx
on public.ifta_drafts(organization_id, source_expense_group_id)
where source_expense_group_id is not null;

create index ifta_drafts_review_queue_idx
on public.ifta_drafts(organization_id, status, draft_type, created_at desc);

create trigger ifta_drafts_set_updated_at
before update on public.ifta_drafts
for each row execute function public.set_updated_at();

create trigger ifta_drafts_validate_source_load_tenant
before insert or update of organization_id, source_load_id on public.ifta_drafts
for each row execute function public.validate_tenant_reference('loads', 'source_load_id');

create trigger ifta_drafts_validate_source_expense_tenant
before insert or update of organization_id, source_expense_group_id on public.ifta_drafts
for each row execute function public.validate_tenant_reference('bookkeeping_expense_groups', 'source_expense_group_id');

create trigger ifta_drafts_validate_approved_trip_tenant
before insert or update of organization_id, approved_trip_id on public.ifta_drafts
for each row execute function public.validate_tenant_reference('ifta_trips', 'approved_trip_id');

create trigger ifta_drafts_validate_approved_fuel_tenant
before insert or update of organization_id, approved_fuel_purchase_id on public.ifta_drafts
for each row execute function public.validate_tenant_reference('ifta_fuel_purchases', 'approved_fuel_purchase_id');

create or replace function public.reopen_ifta_draft_on_post_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'ifta_trips' then
    update public.ifta_drafts
    set status = 'pending', approved_trip_id = null, reviewed_at = null, reviewed_by = null,
        review_note = 'Posted trip was removed; review this source again.'
    where approved_trip_id = old.id;
  else
    update public.ifta_drafts
    set status = 'pending', approved_fuel_purchase_id = null, reviewed_at = null, reviewed_by = null,
        review_note = 'Posted fuel purchase was removed; review this source again.'
    where approved_fuel_purchase_id = old.id;
  end if;
  return old;
end;
$$;

create trigger ifta_trip_reopen_draft_before_delete
before delete on public.ifta_trips
for each row execute function public.reopen_ifta_draft_on_post_delete();

create trigger ifta_fuel_reopen_draft_before_delete
before delete on public.ifta_fuel_purchases
for each row execute function public.reopen_ifta_draft_on_post_delete();

alter table public.ifta_drafts enable row level security;
create policy "Members can manage tenant rows"
on public.ifta_drafts for all to authenticated
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

grant select, insert, update, delete on table public.ifta_drafts to authenticated;

create or replace function public.ifta_location_state(p_location text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  matched text;
  jurisdictions constant text[] := array[
    'AL','AR','AZ','CA','CO','CT','DE','FL','GA','IA','ID','IL','IN','KS','KY','LA',
    'MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY',
    'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY'
  ];
begin
  matched := (regexp_match(
    upper(coalesce(p_location, '')),
    '(?:^|[,[:space:]])([A-Z]{2})(?:[[:space:]]+[0-9]{5}(?:-[0-9]{4})?)?(?:[[:space:]]*,?[[:space:]]*USA)?$'
  ))[1];
  return case when matched = any(jurisdictions) then matched end;
end;
$$;

create or replace function public.refresh_ifta_drafts(p_start date, p_end date)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  trip_count integer := 0;
  fuel_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_end < p_start then raise exception 'End date must be on or after start date' using errcode = '22023'; end if;

  with eligible as (
    select
      load.id,
      load.organization_id,
      load.load_number,
      load.truck_unit_id,
      unit.unit_number,
      coalesce(pickup.location, load.pickup_location) as pickup_location,
      coalesce(delivery.location, load.delivery_location) as delivery_location,
      coalesce(pickup.scheduled_start::date, load.pickup_date) as start_date,
      coalesce(delivery.scheduled_end::date, delivery.scheduled_start::date, load.delivery_date) as end_date,
      array_remove(array[
        public.ifta_location_state(coalesce(pickup.location, load.pickup_location)),
        public.ifta_location_state(coalesce(delivery.location, load.delivery_location))
      ], null)::text[] as suggested_states
    from public.loads load
    left join public.fleet_units unit on unit.id = load.truck_unit_id
    left join lateral (
      select stop.location, stop.scheduled_start
      from public.load_stops stop
      where stop.load_id = load.id and stop.stop_type = 'Pickup'
      order by stop.position limit 1
    ) pickup on true
    left join lateral (
      select stop.location, stop.scheduled_start, stop.scheduled_end
      from public.load_stops stop
      where stop.load_id = load.id and stop.stop_type = 'Delivery'
      order by stop.position desc limit 1
    ) delivery on true
    where load.status in ('Delivered', 'Closed')
      and coalesce(pickup.scheduled_start::date, load.pickup_date) between p_start and p_end
  ), candidates as (
    select eligible.*,
      coalesce(route.state_miles, '[]'::jsonb) as state_miles
    from eligible
    left join lateral (
      select jsonb_agg(jsonb_build_object('state', miles.state, 'miles', miles.miles) order by miles.state) as state_miles
      from public.ifta_trips trip
      join public.ifta_trip_miles miles on miles.trip_id = trip.id
      where trip.organization_id = eligible.organization_id
        and lower(btrim(trip.pickup_city)) = lower(btrim(eligible.pickup_location))
        and lower(btrim(trip.dropoff_city)) = lower(btrim(eligible.delivery_location))
      group by trip.id, trip.start_date, trip.created_at
      order by trip.start_date desc, trip.created_at desc
      limit 1
    ) route on true
  )
  insert into public.ifta_drafts (
    organization_id, draft_type, source_load_id, report_date, payload, missing_fields
  )
  select
    organization_id,
    'trip',
    id,
    start_date,
    jsonb_build_object(
      'unit_id', truck_unit_id,
      'truck_number', unit_number,
      'start_date', start_date,
      'end_date', end_date,
      'pickup_city', pickup_location,
      'dropoff_city', delivery_location,
      'state_miles', state_miles,
      'suggested_states', to_jsonb(suggested_states),
      'notes', 'Generated from load ' || load_number
    ),
    array_remove(array[
      case when truck_unit_id is null then 'truck' end,
      case when jsonb_array_length(state_miles) = 0 and cardinality(suggested_states) = 0 then 'state' end,
      case when jsonb_array_length(state_miles) = 0 then 'mileage' end
    ], null)::text[]
  from candidates
  on conflict (organization_id, source_load_id) where source_load_id is not null do nothing;
  get diagnostics trip_count = row_count;

  with candidates as (
    select
      groups.id,
      groups.organization_id,
      groups.expense_date,
      groups.vendor,
      groups.notes,
      groups.unit_id,
      unit.unit_number,
      fuel.amount_paid,
      receipts.receipt_count
    from public.bookkeeping_expense_groups groups
    join lateral (
      select sum(expenses.amount) as amount_paid
      from public.bookkeeping_expenses expenses
      where expenses.group_id = groups.id and expenses.category = 'Fuel'
    ) fuel on fuel.amount_paid > 0
    left join lateral (
      select count(*) as receipt_count
      from public.bookkeeping_receipts receipt
      where receipt.group_id = groups.id
    ) receipts on true
    left join public.fleet_units unit on unit.id = groups.unit_id and unit.unit_type = 'Truck'
    where groups.expense_date between p_start and p_end
      and groups.source_type <> 'ifta'
      and not exists (
        select 1 from public.ifta_fuel_purchases purchase
        where purchase.source_expense_group_id = groups.id
      )
  )
  insert into public.ifta_drafts (
    organization_id, draft_type, source_expense_group_id, report_date, payload, missing_fields
  )
  select
    organization_id,
    'fuel',
    id,
    expense_date,
    jsonb_build_object(
      'unit_id', unit_id,
      'truck_number', unit_number,
      'purchase_date', expense_date,
      'city', null,
      'state', null,
      'gallons', null,
      'amount_paid', amount_paid,
      'vendor', vendor,
      'notes', notes,
      'receipt_count', receipt_count
    ),
    array_remove(array[
      case when unit_number is null then 'truck' end,
      'state',
      'gallons'
    ], null)::text[]
  from candidates
  on conflict (organization_id, source_expense_group_id) where source_expense_group_id is not null do nothing;
  get diagnostics fuel_count = row_count;

  return jsonb_build_object('trip_drafts_created', trip_count, 'fuel_drafts_created', fuel_count);
end;
$$;

create or replace function public.review_ifta_draft(
  p_draft_id uuid,
  p_action text,
  p_payload jsonb default null,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  draft public.ifta_drafts%rowtype;
  next_payload jsonb;
  next_missing text[];
  posted_id uuid;
  unit_number text;
  miles_row jsonb;
  seen_states text[] := '{}';
  state_code text;
  state_miles numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_action not in ('save', 'approve', 'reject', 'exclude') then
    raise exception 'Choose a valid review action' using errcode = '22023';
  end if;

  select * into draft from public.ifta_drafts where id = p_draft_id for update;
  if not found then raise exception 'IFTA draft not found' using errcode = 'P0002'; end if;
  if draft.status = 'approved' then raise exception 'Approved drafts cannot be changed' using errcode = '23514'; end if;

  if p_action in ('reject', 'exclude') then
    update public.ifta_drafts
    set status = case p_action when 'reject' then 'rejected' else 'excluded' end,
        review_note = nullif(btrim(p_note), ''), reviewed_at = now(), reviewed_by = auth.uid()
    where id = draft.id;
    return draft.id;
  end if;

  next_payload := coalesce(p_payload, draft.payload);

  if draft.draft_type = 'trip' then
    select unit.unit_number into unit_number
    from public.fleet_units unit
    where unit.id = nullif(next_payload ->> 'unit_id', '')::uuid and unit.unit_type = 'Truck';

    next_payload := next_payload || jsonb_build_object('truck_number', unit_number);
    next_missing := array_remove(array[
      case when unit_number is null then 'truck' end,
      case when nullif(btrim(next_payload ->> 'start_date'), '') is null then 'start date' end,
      case when nullif(btrim(next_payload ->> 'pickup_city'), '') is null then 'pickup' end,
      case when nullif(btrim(next_payload ->> 'dropoff_city'), '') is null then 'delivery' end,
      case when jsonb_typeof(next_payload -> 'state_miles') <> 'array'
        or jsonb_array_length(coalesce(next_payload -> 'state_miles', '[]'::jsonb)) = 0 then 'state' end,
      case when jsonb_typeof(next_payload -> 'state_miles') <> 'array'
        or jsonb_array_length(coalesce(next_payload -> 'state_miles', '[]'::jsonb)) = 0 then 'mileage' end
    ], null)::text[];

    if jsonb_typeof(next_payload -> 'state_miles') = 'array' then
      for miles_row in select * from jsonb_array_elements(next_payload -> 'state_miles') loop
        state_code := upper(btrim(miles_row ->> 'state'));
        state_miles := nullif(miles_row ->> 'miles', '')::numeric;
        if public.ifta_location_state('X, ' || state_code) is null then
          raise exception 'Choose a valid IFTA state' using errcode = '23514';
        end if;
        if state_miles is null or state_miles <= 0 then
          raise exception 'State miles must be greater than zero' using errcode = '23514';
        end if;
        if state_code = any(seen_states) then
          raise exception 'Each state can only be listed once' using errcode = '23505';
        end if;
        seen_states := array_append(seen_states, state_code);
      end loop;
    end if;
  else
    select unit.unit_number into unit_number
    from public.fleet_units unit
    where unit.id = nullif(next_payload ->> 'unit_id', '')::uuid and unit.unit_type = 'Truck';

    next_payload := next_payload || jsonb_build_object('truck_number', unit_number);
    next_missing := array_remove(array[
      case when unit_number is null then 'truck' end,
      case when nullif(btrim(next_payload ->> 'purchase_date'), '') is null then 'purchase date' end,
      case when public.ifta_location_state('X, ' || coalesce(next_payload ->> 'state', '')) is null then 'state' end,
      case when nullif(next_payload ->> 'gallons', '')::numeric is null or (next_payload ->> 'gallons')::numeric <= 0 then 'gallons' end,
      case when nullif(next_payload ->> 'amount_paid', '')::numeric is null or (next_payload ->> 'amount_paid')::numeric <= 0 then 'purchase amount' end
    ], null)::text[];
  end if;

  update public.ifta_drafts
  set payload = next_payload,
      report_date = case draft.draft_type
        when 'trip' then (next_payload ->> 'start_date')::date
        else (next_payload ->> 'purchase_date')::date
      end,
      missing_fields = next_missing, status = 'pending',
      review_note = nullif(btrim(p_note), ''), reviewed_at = null, reviewed_by = null
  where id = draft.id;

  if p_action = 'save' then return draft.id; end if;
  if cardinality(next_missing) > 0 then
    raise exception 'Complete all missing fields before approval: %', array_to_string(next_missing, ', ') using errcode = '23514';
  end if;

  if draft.draft_type = 'trip' then
    insert into public.ifta_trips (
      unit_id, truck_number, start_date, end_date, pickup_city, dropoff_city, notes, source_load_id
    ) values (
      (next_payload ->> 'unit_id')::uuid,
      unit_number,
      (next_payload ->> 'start_date')::date,
      nullif(next_payload ->> 'end_date', '')::date,
      btrim(next_payload ->> 'pickup_city'),
      btrim(next_payload ->> 'dropoff_city'),
      nullif(btrim(next_payload ->> 'notes'), ''),
      draft.source_load_id
    ) returning id into posted_id;

    insert into public.ifta_trip_miles (trip_id, state, miles)
    select posted_id, upper(btrim(item ->> 'state')), (item ->> 'miles')::numeric
    from jsonb_array_elements(next_payload -> 'state_miles') item;

    update public.ifta_drafts
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), approved_trip_id = posted_id
    where id = draft.id;
  else
    insert into public.ifta_fuel_purchases (
      unit_id, truck_number, purchase_date, city, state, gallons, amount_paid, vendor, notes, source_expense_group_id
    ) values (
      (next_payload ->> 'unit_id')::uuid,
      unit_number,
      (next_payload ->> 'purchase_date')::date,
      nullif(btrim(next_payload ->> 'city'), ''),
      upper(btrim(next_payload ->> 'state')),
      (next_payload ->> 'gallons')::numeric,
      (next_payload ->> 'amount_paid')::numeric,
      nullif(btrim(next_payload ->> 'vendor'), ''),
      nullif(btrim(next_payload ->> 'notes'), ''),
      draft.source_expense_group_id
    ) returning id into posted_id;

    update public.ifta_drafts
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), approved_fuel_purchase_id = posted_id
    where id = draft.id;
  end if;

  return posted_id;
exception
  when unique_violation then
    raise exception 'This source has already been posted to IFTA' using errcode = '23505';
end;
$$;

revoke all on function public.refresh_ifta_drafts(date, date) from public, anon;
revoke all on function public.review_ifta_draft(uuid, text, jsonb, text) from public, anon;
grant execute on function public.refresh_ifta_drafts(date, date) to authenticated;
grant execute on function public.review_ifta_draft(uuid, text, jsonb, text) to authenticated;

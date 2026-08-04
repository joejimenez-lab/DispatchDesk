-- Shared AI assistant quotas must live in Postgres so every application
-- instance observes the same counters. The counter tables are kept outside the
-- API-exposed public schema and can only be mutated through the authenticated
-- RPC below.

create schema if not exists dispatchdesk_private;

revoke all on schema dispatchdesk_private from public, anon, authenticated;

create table dispatchdesk_private.ai_assistant_user_minute_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (user_id, organization_id, window_start)
);

create index ai_assistant_user_minute_usage_organization_idx
on dispatchdesk_private.ai_assistant_user_minute_usage(organization_id);

create index ai_assistant_user_minute_usage_expires_idx
on dispatchdesk_private.ai_assistant_user_minute_usage(expires_at);

create table dispatchdesk_private.ai_assistant_organization_day_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (organization_id, window_start)
);

create index ai_assistant_organization_day_usage_expires_idx
on dispatchdesk_private.ai_assistant_organization_day_usage(expires_at);

alter table dispatchdesk_private.ai_assistant_user_minute_usage enable row level security;
alter table dispatchdesk_private.ai_assistant_organization_day_usage enable row level security;

revoke all on table dispatchdesk_private.ai_assistant_user_minute_usage from public, anon, authenticated;
revoke all on table dispatchdesk_private.ai_assistant_organization_day_usage from public, anon, authenticated;

create or replace function public.check_ai_assistant_rate_limit()
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  minute_limit constant integer := 12;
  organization_day_limit constant integer := 500;
  cleanup_batch_size constant integer := 100;
  authenticated_user_id uuid := auth.uid();
  authenticated_organization_id uuid;
  checked_at timestamptz := statement_timestamp();
  minute_window_start timestamptz := date_trunc('minute', checked_at);
  day_window_start timestamptz := date_trunc('day', checked_at at time zone 'UTC') at time zone 'UTC';
  updated_count integer;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  authenticated_organization_id := public.current_organization_id();
  if authenticated_organization_id is null then
    raise exception 'Organization membership required' using errcode = '42501';
  end if;

  -- The hidden beta is restricted to organization owners. Enforce that here,
  -- before cleanup or counter mutations, so calling the RPC directly cannot
  -- consume another owner's organization quota.
  if not exists (
    select 1
    from public.organization_members membership
    where membership.user_id = authenticated_user_id
      and membership.organization_id = authenticated_organization_id
      and membership.role = 'owner'
  ) then
    raise exception 'Organization owner required' using errcode = '42501';
  end if;

  -- Keep cleanup work bounded on request paths. Expiry indexes make finding
  -- old buckets cheap, while skip locked prevents concurrent requests from
  -- waiting on the same cleanup rows.
  delete from dispatchdesk_private.ai_assistant_user_minute_usage usage
  where usage.ctid in (
    select expired.ctid
    from dispatchdesk_private.ai_assistant_user_minute_usage expired
    where expired.expires_at <= checked_at
    order by expired.expires_at
    limit cleanup_batch_size
    for update skip locked
  );

  delete from dispatchdesk_private.ai_assistant_organization_day_usage usage
  where usage.ctid in (
    select expired.ctid
    from dispatchdesk_private.ai_assistant_organization_day_usage expired
    where expired.expires_at <= checked_at
    order by expired.expires_at
    limit cleanup_batch_size
    for update skip locked
  );

  -- This upsert locks one user's current bucket. The WHERE clause ensures
  -- concurrent requests cannot increment beyond the minute limit.
  insert into dispatchdesk_private.ai_assistant_user_minute_usage (
    user_id,
    organization_id,
    window_start,
    request_count,
    expires_at
  ) values (
    authenticated_user_id,
    authenticated_organization_id,
    minute_window_start,
    1,
    minute_window_start + interval '2 minutes'
  )
  on conflict (user_id, organization_id, window_start) do update
  set request_count = ai_assistant_user_minute_usage.request_count + 1
  where ai_assistant_user_minute_usage.request_count < minute_limit
  returning request_count into updated_count;

  if updated_count is null then
    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (minute_window_start + interval '1 minute' - checked_at)))::integer
      );
    return;
  end if;

  updated_count := null;

  -- Every user in an organization shares this daily bucket. PostgreSQL row
  -- locking makes the cap atomic across users and application instances.
  insert into dispatchdesk_private.ai_assistant_organization_day_usage (
    organization_id,
    window_start,
    request_count,
    expires_at
  ) values (
    authenticated_organization_id,
    day_window_start,
    1,
    day_window_start + interval '2 days'
  )
  on conflict (organization_id, window_start) do update
  set request_count = ai_assistant_organization_day_usage.request_count + 1
  where ai_assistant_organization_day_usage.request_count < organization_day_limit
  returning request_count into updated_count;

  if updated_count is null then
    -- A daily denial must not consume this user's minute allowance. The user
    -- bucket is still locked by this transaction, so the compensation is
    -- atomic with the failed organization increment.
    update dispatchdesk_private.ai_assistant_user_minute_usage
    set request_count = request_count - 1
    where user_id = authenticated_user_id
      and organization_id = authenticated_organization_id
      and window_start = minute_window_start
      and request_count > 1;

    if not found then
      delete from dispatchdesk_private.ai_assistant_user_minute_usage
      where user_id = authenticated_user_id
        and organization_id = authenticated_organization_id
        and window_start = minute_window_start
        and request_count = 1;
    end if;

    return query select
      false,
      greatest(
        1,
        ceil(extract(epoch from (day_window_start + interval '1 day' - checked_at)))::integer
      );
    return;
  end if;

  return query select true, 0;
end;
$$;

revoke all on function public.check_ai_assistant_rate_limit() from public, anon;
grant execute on function public.check_ai_assistant_rate_limit() to authenticated;

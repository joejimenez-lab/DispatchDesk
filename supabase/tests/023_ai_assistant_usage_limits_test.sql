begin;

select plan(19);

select has_schema('dispatchdesk_private', 'private assistant quota schema exists');
select has_table(
  'dispatchdesk_private',
  'ai_assistant_user_minute_usage',
  'per-user minute counters exist'
);
select has_table(
  'dispatchdesk_private',
  'ai_assistant_organization_day_usage',
  'per-organization daily counters exist'
);
select has_function(
  'public',
  'check_ai_assistant_rate_limit',
  array[]::text[],
  'authenticated quota RPC exists'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'assistant-limit-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'assistant-limit-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '23000000-0000-4000-8000-000000000003',
  'authenticated', 'authenticated', 'assistant-limit-member@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
);

update public.organization_members
set organization_id = (
      select organization_id
      from public.organization_members
      where user_id = '23000000-0000-4000-8000-000000000001'
    ),
    role = 'member'
where user_id = '23000000-0000-4000-8000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated","email":"assistant-limit-one@example.com"}',
  true
);
set local role authenticated;

select is(
  (select allowed from public.check_ai_assistant_rate_limit()),
  true,
  'the first authenticated request is allowed'
);

select throws_ok(
  $$select count(*) from dispatchdesk_private.ai_assistant_user_minute_usage$$,
  '42501',
  null,
  'authenticated callers cannot read private counters directly'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-4000-8000-000000000003","role":"authenticated","email":"assistant-limit-member@example.com"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.check_ai_assistant_rate_limit()$$,
  '42501',
  'Organization owner required',
  'a non-owner member cannot consume the organization assistant quota'
);

reset role;

select is(
  (
    select count(*)
    from dispatchdesk_private.ai_assistant_user_minute_usage
    where user_id = '23000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'a denied member receives no user counter'
);

select is(
  (
    select request_count
    from dispatchdesk_private.ai_assistant_organization_day_usage
    where organization_id = (
      select organization_id
      from public.organization_members
      where user_id = '23000000-0000-4000-8000-000000000001'
    )
      and window_start = date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC'
  ),
  1,
  'a denied member does not change the shared organization counter'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated","email":"assistant-limit-one@example.com"}',
  true
);
set local role authenticated;

do $$
begin
  for request_number in 1..11 loop
    perform * from public.check_ai_assistant_rate_limit();
  end loop;
end;
$$;

select is(
  (select allowed from public.check_ai_assistant_rate_limit()),
  false,
  'a thirteenth request in the minute is rejected'
);

select ok(
  (select retry_after_seconds between 1 and 60 from public.check_ai_assistant_rate_limit()),
  'the minute rejection has a bounded retry delay'
);

reset role;

select is(
  (
    select request_count
    from dispatchdesk_private.ai_assistant_user_minute_usage
    where user_id = '23000000-0000-4000-8000-000000000001'
      and window_start = date_trunc('minute', statement_timestamp())
  ),
  12,
  'rejected requests do not increment the user counter'
);

select is(
  (
    select request_count
    from dispatchdesk_private.ai_assistant_organization_day_usage
    where organization_id = (
      select organization_id
      from public.organization_members
      where user_id = '23000000-0000-4000-8000-000000000001'
    )
      and window_start = date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC'
  ),
  12,
  'rejected user requests do not increment the organization counter'
);

insert into dispatchdesk_private.ai_assistant_user_minute_usage (
  user_id,
  organization_id,
  window_start,
  request_count,
  expires_at
)
select
  '23000000-0000-4000-8000-000000000001',
  organization_id,
  date_trunc('minute', statement_timestamp()) - (series_number + 10) * interval '1 minute',
  1,
  statement_timestamp() - interval '1 minute'
from public.organization_members
cross join generate_series(1, 101) series_number
where user_id = '23000000-0000-4000-8000-000000000001';

set local role authenticated;
do $$
begin
  perform * from public.check_ai_assistant_rate_limit();
end;
$$;
reset role;

select is(
  (
    select count(*)
    from dispatchdesk_private.ai_assistant_user_minute_usage
    where expires_at <= statement_timestamp()
  ),
  1::bigint,
  'request cleanup removes at most one bounded batch of stale user buckets'
);

insert into dispatchdesk_private.ai_assistant_organization_day_usage (
  organization_id,
  window_start,
  request_count,
  expires_at
)
select
  organization_id,
  date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC',
  500,
  (date_trunc('day', statement_timestamp() at time zone 'UTC') at time zone 'UTC') + interval '2 days'
from public.organization_members
where user_id = '23000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"23000000-0000-4000-8000-000000000002","role":"authenticated","email":"assistant-limit-two@example.com"}',
  true
);
set local role authenticated;

select is(
  (select allowed from public.check_ai_assistant_rate_limit()),
  false,
  'the organization daily cap rejects another request'
);

select ok(
  (select retry_after_seconds between 1 and 86400 from public.check_ai_assistant_rate_limit()),
  'the daily rejection retries at the next UTC day'
);

reset role;

select is(
  (
    select count(*)
    from dispatchdesk_private.ai_assistant_user_minute_usage
    where user_id = '23000000-0000-4000-8000-000000000002'
      and window_start = date_trunc('minute', statement_timestamp())
  ),
  0::bigint,
  'a daily denial is compensated and does not consume the user minute quota'
);

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select * from public.check_ai_assistant_rate_limit()$$,
  '42501',
  'Authentication required',
  'an authenticated role without a verified user cannot use the RPC'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.check_ai_assistant_rate_limit()$$,
  '42501',
  null,
  'anonymous callers cannot execute the quota RPC'
);

reset role;
select * from finish();
rollback;

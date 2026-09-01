begin;

select plan(28);

select has_column('public', 'loads', 'documents_complete_at', 'loads track document completion');
select has_column('public', 'loads', 'post_delivery_status', 'loads expose a separate closeout stage');
select has_column('public', 'loads', 'closed_at', 'loads track final closure');
select has_function('public', 'set_load_closeout_milestone', array['uuid', 'text', 'boolean'], 'tenant-safe closeout function exists');
select is((select count(*) from public.loads where status = 'Closed'), 0::bigint, 'legacy Closed rows are migrated out of operational status');
select is_empty(
  $$select id from public.loads where status = 'Delivered' and post_delivery_status is null$$,
  'every existing Delivered load receives a closeout stage'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '33000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'lifecycle-one@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Lifecycle One"}', now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '33000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'lifecycle-two@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Lifecycle Two"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000001","role":"authenticated","email":"lifecycle-one@example.com"}', true);
set local role authenticated;

insert into public.loads (
  id, load_number, pickup_location, delivery_location, delivery_date, status
) values (
  '33000000-0000-4000-8000-000000000010', 'LIFECYCLE-1', 'Los Angeles, CA', 'Phoenix, AZ', '2026-08-31', 'Booked'
);

select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), null::text, 'active transportation has no closeout stage');

update public.loads set status = 'Delivered' where load_number = 'LIFECYCLE-1';
select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), 'Awaiting Documents', 'delivery starts the closeout workflow');

select is(
  public.set_load_closeout_milestone('33000000-0000-4000-8000-000000000010', 'documents_complete', true)::text,
  'Documents Complete',
  'document completion advances the closeout stage'
);

update public.payments set invoice_sent = true, invoice_sent_date = '2026-09-01' where load_id = '33000000-0000-4000-8000-000000000010';
select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), 'Invoiced', 'sending the invoice advances the closeout stage');

select throws_ok(
  $$select public.set_load_closeout_milestone('33000000-0000-4000-8000-000000000010', 'closed', true)$$,
  '22023',
  'Complete documents, invoicing, and all payments before closing the load',
  'a load cannot close while payments remain outstanding'
);

update public.payments
set client_paid = true, client_date_received = '2026-09-02', client_amount_received = 1000,
    driver_paid = true, driver_date_paid = '2026-09-02',
    dispatcher_paid = true, dispatcher_date_paid = '2026-09-02'
where load_id = '33000000-0000-4000-8000-000000000010';
select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), 'Paid', 'all payments advance the load to Paid');

select is(
  public.set_load_closeout_milestone('33000000-0000-4000-8000-000000000010', 'closed', true)::text,
  'Closed',
  'a fully paid load can close'
);
select is((select status::text from public.loads where load_number = 'LIFECYCLE-1'), 'Delivered', 'closing never changes the operational Delivered status');
select isnt((select closed_at from public.loads where load_number = 'LIFECYCLE-1'), null::timestamptz, 'closure records its timestamp');

select throws_ok(
  $$update public.loads set status = 'In Transit' where load_number = 'LIFECYCLE-1'$$,
  '22023',
  'Reopen the closeout before changing operational status',
  'closed loads cannot silently return to active transportation'
);

select is(
  public.set_load_closeout_milestone('33000000-0000-4000-8000-000000000010', 'closed', false)::text,
  'Paid',
  'reopening restores the derived Paid stage'
);
select is((select closed_at from public.loads where load_number = 'LIFECYCLE-1'), null::timestamptz, 'reopening clears the closure timestamp');

select is(
  public.set_load_closeout_milestone('33000000-0000-4000-8000-000000000010', 'documents_complete', false)::text,
  'Awaiting Documents',
  'marking documents incomplete returns to the first stage'
);
select is((select documents_complete_at from public.loads where load_number = 'LIFECYCLE-1'), null::timestamptz, 'document completion can be corrected safely');

update public.loads set status = 'In Transit' where load_number = 'LIFECYCLE-1';
select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), null::text, 'correcting delivery status removes the closeout stage');

update public.loads set status = 'Delivered' where load_number = 'LIFECYCLE-1';
select is((select post_delivery_status::text from public.loads where load_number = 'LIFECYCLE-1'), 'Awaiting Documents', 'redelivery recalculates closeout from retained facts');

select throws_ok(
  $$update public.loads set closed_at = now() where load_number = 'LIFECYCLE-1'$$,
  '22023',
  'Complete documents, invoicing, and all payments before closing the load',
  'direct updates cannot bypass closeout prerequisites'
);

select ok(
  (select count(*) from public.activity_logs where load_id = '33000000-0000-4000-8000-000000000010' and action like 'Documents marked %') >= 2,
  'document milestone changes are recorded in activity'
);
select ok(
  (select count(*) from public.activity_logs where load_id = '33000000-0000-4000-8000-000000000010' and action in ('Load closed', 'Load reopened')) = 2,
  'close and reopen changes are recorded in activity'
);

select set_config('test.lifecycle_load_id', '33000000-0000-4000-8000-000000000010', true);
reset role;

select set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000002","role":"authenticated","email":"lifecycle-two@example.com"}', true);
set local role authenticated;

select is((select count(*) from public.loads where load_number = 'LIFECYCLE-1'), 0::bigint, 'another organization cannot read lifecycle data');
select throws_ok(
  $$select public.set_load_closeout_milestone(current_setting('test.lifecycle_load_id')::uuid, 'documents_complete', true)$$,
  'P0002',
  'Load not found',
  'another organization cannot mutate lifecycle data'
);
select is((select count(*) from public.activity_logs where load_id = current_setting('test.lifecycle_load_id')::uuid), 0::bigint, 'another organization cannot read lifecycle activity');

reset role;
select * from finish();
rollback;

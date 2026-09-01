begin;

select plan(14);

select has_column('public', 'loads', 'driver_pay_known', 'loads track whether driver pay is known');
select has_column('public', 'loads', 'dispatcher_fee_known', 'loads track whether dispatcher fee is known');
select has_column('public', 'loads', 'fuel_cost_known', 'loads track whether fuel cost is known');
select has_function('public', 'create_load_with_deductions', array['jsonb', 'jsonb', 'jsonb', 'jsonb'], 'atomic create accepts completeness flags');
select has_function('public', 'update_load_with_payment', array['uuid', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb'], 'atomic update accepts completeness flags');

select is((select count(*) from public.loads where driver_pay <> 0 and not driver_pay_known), 0::bigint, 'historical non-zero driver pay is marked known');
select is((select count(*) from public.loads where dispatcher_fee <> 0 and not dispatcher_fee_known), 0::bigint, 'historical non-zero dispatcher fees are marked known');
select is((select count(*) from public.loads where fuel_cost <> 0 and not fuel_cost_known), 0::bigint, 'historical non-zero fuel costs are marked known');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000', '82000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'financial-completeness@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"company_name":"Financial Test"}', now(), now(), '', '', '', ''
);

select set_config('request.jwt.claims', '{"sub":"82000000-0000-4000-8000-000000000001","role":"authenticated","email":"financial-completeness@example.com"}', true);
set local role authenticated;

select lives_ok(
  $$select public.create_load_with_deductions(
    '{"load_number":"FIN-82","pickup_location":"A","delivery_location":"B","status":"Booked","load_rate":1000,"driver_pay":0,"dispatcher_fee":0,"fuel_cost":125}'::jsonb,
    '[]'::jsonb,
    '[{"stop_type":"Pickup","location":"A"},{"stop_type":"Delivery","location":"B"}]'::jsonb,
    '{"driver_pay_known":true,"dispatcher_fee_known":false,"fuel_cost_known":true}'::jsonb
  )$$,
  'load and completeness flags are created atomically'
);

select ok((select driver_pay_known from public.loads where load_number = 'FIN-82'), 'an intentional zero driver cost is known');
select isnt((select dispatcher_fee_known from public.loads where load_number = 'FIN-82'), true, 'a blank dispatcher fee remains unknown');
select ok((select fuel_cost_known from public.loads where load_number = 'FIN-82'), 'a non-zero fuel estimate is known');

select lives_ok(
  $$select public.update_load_with_payment(
    (select id from public.loads where load_number = 'FIN-82'),
    '{"load_number":"FIN-82","pickup_location":"A","delivery_location":"B","status":"Booked","load_rate":1000,"driver_pay":0,"dispatcher_fee":0,"fuel_cost":125}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[{"stop_type":"Pickup","location":"A"},{"stop_type":"Delivery","location":"B"}]'::jsonb,
    '{"driver_pay_known":true,"dispatcher_fee_known":true,"fuel_cost_known":true}'::jsonb
  )$$,
  'an unknown cost can be confirmed as an intentional zero atomically'
);
select ok((select dispatcher_fee_known from public.loads where load_number = 'FIN-82'), 'confirmed zero dispatcher fee is distinguishable from unknown');

reset role;
select * from finish();
rollback;

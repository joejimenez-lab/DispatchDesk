begin;
select plan(14);
select is(public.normalize_accounting_company(' DC GEMS CORP '), 'DC', 'DC carrier alias is normalized');
select is(public.normalize_accounting_company('rd freigh'), 'RD', 'historical RD spelling is normalized');
select is(public.normalize_accounting_company('RD FREIGHT LOGISTICS'), 'RD', 'full RD name is normalized');
select is(public.normalize_accounting_company('J S'), 'JS', 'JS spelling is normalized');
select is(public.normalize_accounting_company(' '), null, 'blank carrier stays unassigned');

insert into auth.users (id, email, raw_user_meta_data) values
('40000000-0000-4000-8000-000000000001', 'accounting-one@example.test', '{}'),
('40000000-0000-4000-8000-000000000002', 'accounting-two@example.test', '{}');
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.fleet_units (id, unit_number, unit_type, company) values
('40000000-0000-4000-8000-000000000010', 'AC-DC', 'Truck', 'DC'),
('40000000-0000-4000-8000-000000000011', 'AC-RD', 'Truck', 'RD');
insert into public.loads (id, load_number, carrier_company, fleet_company, truck_unit_id, pickup_location, delivery_location, load_rate) values
('40000000-0000-4000-8000-000000000020', 'AC-DC-LOAD', 'DC GEMS CORP', 'RD', '40000000-0000-4000-8000-000000000011', 'A', 'B', 1000),
('40000000-0000-4000-8000-000000000021', 'AC-RD-LOAD', 'RD FREIGH', 'DC', '40000000-0000-4000-8000-000000000010', 'A', 'B', 2000),
('40000000-0000-4000-8000-000000000022', 'AC-UNKNOWN', null, 'DC', '40000000-0000-4000-8000-000000000010', 'A', 'B', 3000);
select is((select accounting_company from public.loads where load_number='AC-DC-LOAD'), 'DC', 'DC load hauled by RD belongs to DC');
select is((select accounting_company from public.loads where load_number='AC-RD-LOAD'), 'RD', 'RD load hauled by DC belongs to RD');
select is((select accounting_company from public.loads where load_number='AC-UNKNOWN'), null, 'missing carrier never falls back to fleet');
select is((select sum(load_rate) from public.loads where accounting_company='DC'), 1000::numeric, 'DC total excludes RD and unknown loads');
select is((select count(*) from public.load_list_index where accounting_company='RD'), 1::bigint, 'paged load index follows carrier');
update public.loads set fleet_company='DC', truck_unit_id='40000000-0000-4000-8000-000000000010' where load_number='AC-DC-LOAD';
select is((select accounting_company from public.loads where load_number='AC-DC-LOAD'), 'DC', 'equipment reassignment does not change accounting');
update public.loads set carrier_company='RD FREIGHT LOGISTICS' where load_number='AC-DC-LOAD';
select is((select accounting_company from public.loads where load_number='AC-DC-LOAD'), 'RD', 'carrier corrections automatically update accounting');
select is((select carrier_company from public.loads where load_number='AC-RD-LOAD'), 'RD FREIGH', 'original carrier spelling is preserved');
reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.load_list_index where accounting_company='RD'), 0::bigint, 'company filter does not bypass tenant isolation');
select * from finish();
rollback;

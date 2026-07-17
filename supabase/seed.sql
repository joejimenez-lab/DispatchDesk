-- DispatchDesk grand-demo dataset.
-- All people and companies are fictional. Business data is intentionally
-- replaced so every reset contains exactly two fleet scopes: RD and RC.

begin;

truncate table
  public.storage_cleanup_jobs,
  public.bookkeeping_receipts,
  public.bookkeeping_expenses,
  public.bookkeeping_expense_groups,
  public.ifta_trip_miles,
  public.ifta_trips,
  public.ifta_fuel_purchases,
  public.maintenance_reminders,
  public.service_records,
  public.inspection_records,
  public.repair_logs,
  public.documents,
  public.notes,
  public.activity_logs,
  public.payments,
  public.loads,
  public.brokers,
  public.drivers,
  public.fleet_units
restart identity cascade;

-- A non-login placeholder provides stable audit attribution without replacing
-- or deleting the real admin account used by the hosted demo.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001',
  'andres.castillo@dispatchdesk.demo',
  '{"full_name":"Andres Castillo"}'::jsonb
)
on conflict (id) do update
set email = excluded.email,
    raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.drivers (id, name, phone, email, truck_number, trailer_number, notes, created_at) values
  ('11000000-0000-4000-8000-000000000001', 'Carlos Ramirez', '(909) 555-0101', 'carlos.ramirez@example.test', 'RD-101', 'RD-501', 'RD lead driver. Hazmat endorsement and clean inspection history.', now() - interval '420 days'),
  ('11000000-0000-4000-8000-000000000002', 'Miguel Hernandez', '(951) 555-0102', 'miguel.hernandez@example.test', 'RD-102', 'RD-502', 'Regional dry-van specialist. Available for weekend dispatch.', now() - interval '360 days'),
  ('11000000-0000-4000-8000-000000000003', 'Luis Garcia', '(626) 555-0103', 'luis.garcia@example.test', 'RD-103', 'RD-503', 'Long-haul driver. Prefers Southwest lanes.', now() - interval '310 days'),
  ('11000000-0000-4000-8000-000000000004', 'Javier Morales', '(619) 555-0201', 'javier.morales@example.test', 'RC-201', 'RC-601', 'RC lead driver. TWIC card on file.', now() - interval '390 days'),
  ('11000000-0000-4000-8000-000000000005', 'Diego Salazar', '(760) 555-0202', 'diego.salazar@example.test', 'RC-202', 'RC-602', 'Cross-border and port appointment experience.', now() - interval '280 days'),
  ('11000000-0000-4000-8000-000000000006', 'Raul Mendoza', '(858) 555-0203', 'raul.mendoza@example.test', 'RC-203', 'RC-603', 'Team-capable driver. Available for expedited freight.', now() - interval '240 days');

insert into public.brokers (id, company_name, contact_name, phone, email, notes, created_at) values
  ('12000000-0000-4000-8000-000000000001', 'Camino Freight Partners', 'Hector Chavez', '(213) 555-1101', 'hector.chavez@example.test', 'Primary dry-van broker. Standard terms: Net 30.', now() - interval '500 days'),
  ('12000000-0000-4000-8000-000000000002', 'Sol Logistics Group', 'Eduardo Navarro', '(602) 555-1102', 'eduardo.navarro@example.test', 'Fast payment program available at 2 percent.', now() - interval '450 days'),
  ('12000000-0000-4000-8000-000000000003', 'Frontera Transport Solutions', 'Tomas Rios', '(915) 555-1103', 'tomas.rios@example.test', 'Southwest and Texas lanes. Detention after two hours.', now() - interval '390 days'),
  ('12000000-0000-4000-8000-000000000004', 'Valle Brokerage Services', 'Marco Delgado', '(503) 555-1104', 'marco.delgado@example.test', 'Pacific Northwest produce and retail freight.', now() - interval '330 days');

insert into public.fleet_units (id, unit_number, unit_type, company, odometer, notes, created_at) values
  ('13000000-0000-4000-8000-000000000001', 'RD-101', 'Truck', 'RD', 248640, '2021 Freightliner Cascadia - VIN ending 3101.', now() - interval '900 days'),
  ('13000000-0000-4000-8000-000000000002', 'RD-102', 'Truck', 'RD', 181420, '2022 Volvo VNL - VIN ending 3102.', now() - interval '790 days'),
  ('13000000-0000-4000-8000-000000000003', 'RD-103', 'Truck', 'RD', 96580, '2024 Kenworth T680 - VIN ending 3103.', now() - interval '410 days'),
  ('13000000-0000-4000-8000-000000000004', 'RD-501', 'Trailer', 'RD', null, '2021 Hyundai 53-foot dry van. Plate ending 501.', now() - interval '900 days'),
  ('13000000-0000-4000-8000-000000000005', 'RD-502', 'Trailer', 'RD', null, '2022 Utility 53-foot dry van. Plate ending 502.', now() - interval '790 days'),
  ('13000000-0000-4000-8000-000000000006', 'RD-503', 'Trailer', 'RD', null, '2024 Great Dane 53-foot dry van. Plate ending 503.', now() - interval '410 days'),
  ('13000000-0000-4000-8000-000000000007', 'RC-201', 'Truck', 'RC', 312090, '2020 Peterbilt 579 - VIN ending 4201.', now() - interval '1100 days'),
  ('13000000-0000-4000-8000-000000000008', 'RC-202', 'Truck', 'RC', 156775, '2023 Freightliner Cascadia - VIN ending 4202.', now() - interval '620 days'),
  ('13000000-0000-4000-8000-000000000009', 'RC-203', 'Truck', 'RC', 74210, '2025 Volvo VNL - VIN ending 4203.', now() - interval '250 days'),
  ('13000000-0000-4000-8000-000000000010', 'RC-601', 'Trailer', 'RC', null, '2020 Wabash 53-foot dry van. Plate ending 601.', now() - interval '1100 days'),
  ('13000000-0000-4000-8000-000000000011', 'RC-602', 'Trailer', 'RC', null, '2023 Utility 53-foot dry van. Plate ending 602.', now() - interval '620 days'),
  ('13000000-0000-4000-8000-000000000012', 'RC-603', 'Trailer', 'RC', null, '2025 Great Dane 53-foot dry van. Plate ending 603.', now() - interval '250 days');

-- Load creation automatically creates the related payment and activity rows.
insert into public.loads (
  id, load_number, broker_id, carrier_company, driver_id,
  pickup_location, pickup_date, delivery_location, delivery_date,
  is_round_trip, return_location, round_trip_details,
  load_rate, driver_pay, dispatcher_fee, fuel_cost, notes, status, created_at
) values
  ('14000000-0000-4000-8000-000000000001', 'RD-260717-01', '12000000-0000-4000-8000-000000000001', 'RD', '11000000-0000-4000-8000-000000000001', 'Ontario, CA', current_date, 'Phoenix, AZ', current_date + 1, false, null, null, 2850, 1625, 285, 510, 'Showcase load with all document categories. Check call every four hours.', 'In Transit', now() - interval '1 day'),
  ('14000000-0000-4000-8000-000000000002', 'RC-260718-01', '12000000-0000-4000-8000-000000000002', 'RC', '11000000-0000-4000-8000-000000000004', 'San Diego, CA', current_date + 1, 'Las Vegas, NV', current_date + 2, false, null, null, 2100, 1225, 210, 360, 'Pickup number SOL-88314. Driver must bring two load locks.', 'Dispatched', now() - interval '10 hours'),
  ('14000000-0000-4000-8000-000000000003', 'RD-260716-02', '12000000-0000-4000-8000-000000000003', 'RD', '11000000-0000-4000-8000-000000000002', 'Fontana, CA', current_date - 1, 'El Paso, TX', current_date + 1, false, null, null, 3950, 2180, 395, 760, 'Sealed trailer. Receiver appointment is firm.', 'Picked Up', now() - interval '2 days'),
  ('14000000-0000-4000-8000-000000000004', 'RC-260720-01', '12000000-0000-4000-8000-000000000004', 'RC', '11000000-0000-4000-8000-000000000005', 'Fresno, CA', current_date + 3, 'Portland, OR', current_date + 5, false, null, null, 3650, 2050, 365, 690, 'Produce load. Trailer must be clean, dry, and odor free.', 'Booked', now() - interval '5 hours'),
  ('14000000-0000-4000-8000-000000000005', 'RD-260711-01', '12000000-0000-4000-8000-000000000002', 'RD', '11000000-0000-4000-8000-000000000003', 'Riverside, CA', current_date - 6, 'Tucson, AZ', current_date - 5, false, null, null, 2450, 1420, 245, 430, 'Delivered clean. POD received; invoice is ready for follow-up.', 'Delivered', now() - interval '8 days'),
  ('14000000-0000-4000-8000-000000000006', 'RC-260708-02', '12000000-0000-4000-8000-000000000001', 'RC', '11000000-0000-4000-8000-000000000006', 'Carson, CA', current_date - 9, 'Sacramento, CA', current_date - 8, true, 'Carson, CA', 'Return empty packaging to the Carson shipper after delivery.', 3300, 1850, 330, 540, 'Round trip completed with signed return receipt.', 'Closed', now() - interval '11 days'),
  ('14000000-0000-4000-8000-000000000007', 'RD-260601-03', '12000000-0000-4000-8000-000000000003', 'RD', '11000000-0000-4000-8000-000000000001', 'Los Angeles, CA', current_date - 47, 'Albuquerque, NM', current_date - 45, false, null, null, 3100, 1760, 310, 610, 'Aged receivable with a partial client payment. Collections call logged.', 'Closed', now() - interval '49 days'),
  ('14000000-0000-4000-8000-000000000008', 'RC-260715-04', '12000000-0000-4000-8000-000000000004', 'RC', '11000000-0000-4000-8000-000000000005', 'Bakersfield, CA', current_date - 2, 'Reno, NV', current_date, false, null, null, 2250, 1280, 225, 390, 'Cancelled by broker before dispatch. Truck not ordered used.', 'Cancelled', now() - interval '3 days'),
  ('14000000-0000-4000-8000-000000000009', 'RD-260610-01', '12000000-0000-4000-8000-000000000001', 'RD', '11000000-0000-4000-8000-000000000002', 'Compton, CA', current_date - 39, 'Salt Lake City, UT', current_date - 36, false, null, null, 4200, 2320, 420, 810, 'Past-due invoice. Broker requested another invoice copy.', 'Delivered', now() - interval '41 days'),
  ('14000000-0000-4000-8000-000000000010', 'RC-260702-02', '12000000-0000-4000-8000-000000000002', 'RC', '11000000-0000-4000-8000-000000000004', 'Otay Mesa, CA', current_date - 16, 'Yuma, AZ', current_date - 15, false, null, null, 1850, 1075, 185, 310, 'Paid and fully reconciled.', 'Closed', now() - interval '18 days'),
  ('14000000-0000-4000-8000-000000000011', 'RD-260622-02', '12000000-0000-4000-8000-000000000003', 'RD', '11000000-0000-4000-8000-000000000003', 'San Bernardino, CA', current_date - 27, 'Dallas, TX', current_date - 24, false, null, null, 5100, 2810, 510, 1040, 'Client paid; driver settlement is intentionally still pending.', 'Closed', now() - interval '29 days'),
  ('14000000-0000-4000-8000-000000000012', 'RC-260716-03', '12000000-0000-4000-8000-000000000004', 'RC', '11000000-0000-4000-8000-000000000006', 'Stockton, CA', current_date - 1, 'Eugene, OR', current_date + 1, false, null, null, 3400, 1940, 340, 650, 'Expedited retail replenishment. Delivery before noon.', 'In Transit', now() - interval '2 days'),
  ('14000000-0000-4000-8000-000000000013', 'RD-260428-01', '12000000-0000-4000-8000-000000000001', 'RD', '11000000-0000-4000-8000-000000000001', 'Ontario, CA', current_date - 82, 'Denver, CO', current_date - 79, false, null, null, 4800, 2660, 480, 970, 'Prior-quarter paid load retained for trend reporting.', 'Closed', now() - interval '84 days'),
  ('14000000-0000-4000-8000-000000000014', 'RC-260509-01', '12000000-0000-4000-8000-000000000002', 'RC', '11000000-0000-4000-8000-000000000004', 'San Diego, CA', current_date - 70, 'Flagstaff, AZ', current_date - 68, true, 'San Diego, CA', 'Return two empty display racks to San Diego.', 2950, 1680, 295, 540, 'Prior-quarter round trip; all payments complete.', 'Closed', now() - interval '72 days');

update public.payments set invoice_sent = true, invoice_sent_date = current_date - 5 where load_id = '14000000-0000-4000-8000-000000000005';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 8, client_paid = true, client_amount_received = 3300, client_date_received = current_date - 2, driver_paid = true, driver_amount_paid = 1850, driver_date_paid = current_date - 3, dispatcher_paid = true, dispatcher_date_paid = current_date - 3 where load_id = '14000000-0000-4000-8000-000000000006';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 44, client_paid = false, client_amount_received = 1800, client_date_received = current_date - 20, driver_paid = true, driver_amount_paid = 1760, driver_date_paid = current_date - 40, dispatcher_paid = false where load_id = '14000000-0000-4000-8000-000000000007';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 35 where load_id = '14000000-0000-4000-8000-000000000009';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 15, client_paid = true, client_amount_received = 1850, client_date_received = current_date - 8, driver_paid = true, driver_amount_paid = 1075, driver_date_paid = current_date - 9, dispatcher_paid = true, dispatcher_date_paid = current_date - 9 where load_id = '14000000-0000-4000-8000-000000000010';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 23, client_paid = true, client_amount_received = 5100, client_date_received = current_date - 4, driver_paid = false, driver_amount_paid = 1000, dispatcher_paid = true, dispatcher_date_paid = current_date - 4 where load_id = '14000000-0000-4000-8000-000000000011';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 78, client_paid = true, client_amount_received = 4800, client_date_received = current_date - 55, driver_paid = true, driver_amount_paid = 2660, driver_date_paid = current_date - 73, dispatcher_paid = true, dispatcher_date_paid = current_date - 73 where load_id = '14000000-0000-4000-8000-000000000013';
update public.payments set invoice_sent = true, invoice_sent_date = current_date - 67, client_paid = true, client_amount_received = 2950, client_date_received = current_date - 41, driver_paid = true, driver_amount_paid = 1680, driver_date_paid = current_date - 62, dispatcher_paid = true, dispatcher_date_paid = current_date - 62 where load_id = '14000000-0000-4000-8000-000000000014';

insert into public.notes (id, load_id, note_text, created_at) values
  ('19100000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'Carlos checked in from Blythe. Traffic is light and ETA remains 07:30.', now() - interval '2 hours'),
  ('19100000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', 'Broker approved up to two hours of detention with signed in-and-out times.', now() - interval '6 hours'),
  ('19100000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000007', 'Hector confirmed the remaining balance is in the Friday payment batch.', now() - interval '1 day'),
  ('19100000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000009', 'Resent invoice and signed BOL to accounts payable.', now() - interval '3 days'),
  ('19100000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000011', 'Driver settlement held for final lumper reimbursement review.', now() - interval '12 hours');

insert into public.activity_logs (id, load_id, action, created_at) values
  ('19200000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'Status changed from Picked Up to In Transit', now() - interval '4 hours'),
  ('19200000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', 'Rate confirmation uploaded', now() - interval '23 hours'),
  ('19200000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000007', 'Partial client payment of $1,800 recorded', now() - interval '20 days'),
  ('19200000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000008', 'Load cancelled by broker before dispatch', now() - interval '2 days'),
  ('19200000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000011', 'Client Paid marked Yes', now() - interval '4 days');

-- Keep manual history from auto-creating random bookkeeping IDs; stable linked
-- transactions are inserted in the bookkeeping section below.
select set_config('dispatchdesk.skip_maintenance_expense_trigger', 'true', true);

insert into public.service_records (id, unit_id, service_date, odometer, description, cost, notes, created_at) values
  ('15000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', current_date - 31, 245180, 'Monthly preventive service', 0, 'Oil, filters, fluids, belts, and tire pressure checked.', now() - interval '31 days'),
  ('15000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002', current_date - 58, 176210, 'Oil change and chassis lubrication', 489.90, 'Next service due at 181,210 miles.', now() - interval '58 days'),
  ('15000000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000003', current_date - 14, 95320, 'Monthly preventive service', 0, 'No defects found.', now() - interval '14 days'),
  ('15000000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000007', current_date - 40, 308440, 'Oil change', 0, 'Sample zero-cost in-house service.', now() - interval '40 days'),
  ('15000000-0000-4000-8000-000000000005', '13000000-0000-4000-8000-000000000008', current_date - 20, 154920, 'Monthly preventive service', 0, 'Replaced one wiper blade from shop stock.', now() - interval '20 days'),
  ('15000000-0000-4000-8000-000000000006', '13000000-0000-4000-8000-000000000009', current_date - 27, 72100, 'Oil change', 0, 'All fluid samples normal.', now() - interval '27 days');

insert into public.inspection_records (id, unit_id, inspection_date, odometer, inspector, result, cost, notes, created_at) values
  ('15100000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', current_date - 62, 238910, 'Hector Mendoza', 'Passed', 0, '90-day inspection passed with no out-of-service defects.', now() - interval '62 days'),
  ('15100000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000004', current_date - 120, null, 'Miguel Torres', 'Passed with correction', 185, 'Adjusted left rear brake and replaced a marker lamp.', now() - interval '120 days'),
  ('15100000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000007', current_date - 88, 300410, 'Hector Mendoza', 'Passed', 0, 'Annual inspection sticker applied.', now() - interval '88 days'),
  ('15100000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000010', current_date - 92, null, 'Miguel Torres', 'Passed', 0, 'Trailer inspection complete.', now() - interval '92 days');

insert into public.repair_logs (id, unit_id, repair_date, odometer, description, log_type, cost, notes, created_at) values
  ('15200000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', current_date - 8, 180990, 'Air line leak at rear gladhand', 'Repair', 606.75, 'Replaced seals and damaged fittings; leak test passed.', now() - interval '8 days'),
  ('15200000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000006', current_date - 2, null, 'Passenger-side marker light intermittent', 'Daily repair log', 0, 'Driver reported defect. Repair appointment scheduled.', now() - interval '2 days'),
  ('15200000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000008', current_date - 17, 152880, 'Replaced cracked coolant reservoir cap', 'Repair', 0, 'Roadside inspection found no active leak.', now() - interval '17 days'),
  ('15200000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000010', current_date - 1, null, 'Curb-side tire at 82 PSI', 'Daily repair log', 0, 'Inflated to specification and checked for punctures.', now() - interval '1 day');

select set_config('dispatchdesk.skip_maintenance_expense_trigger', 'false', true);

insert into public.maintenance_reminders (
  id, unit_id, reminder_type, due_date, due_odometer, interval_days, interval_miles,
  warning_days, warning_miles, snoozed_until, notes, completed_at,
  completed_by, completed_by_email, completion_record_table, completion_record_id,
  created_by, created_by_email, created_at
) values
  ('16000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'Oil change', null, 248000, null, 5000, 30, 500, null, 'Mileage target already passed - priority service.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '60 days'),
  ('16000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002', 'Repair follow-up', current_date - 2, null, null, null, 7, 500, null, 'Verify air-line repair remains leak free.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '8 days'),
  ('16000000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000003', 'Monthly service', current_date + 6, null, 30, null, 14, 500, null, 'Due soon after current dispatch cycle.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '24 days'),
  ('16000000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000004', '90-day inspection', current_date + 12, null, 90, null, 20, 500, null, 'Inspect brakes, lights, tires, and landing gear.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '78 days'),
  ('16000000-0000-4000-8000-000000000005', '13000000-0000-4000-8000-000000000006', 'Repair follow-up', current_date + 2, null, null, null, 7, 500, current_date + 4, 'Marker-light repair is snoozed while trailer is at customer yard.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '2 days'),
  ('16000000-0000-4000-8000-000000000006', '13000000-0000-4000-8000-000000000007', 'Annual inspection', current_date + 120, null, 365, null, 30, 500, null, 'Upcoming annual inspection.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '200 days'),
  ('16000000-0000-4000-8000-000000000007', '13000000-0000-4000-8000-000000000008', 'Oil change', null, 157100, null, 5000, 30, 500, null, 'Mileage-based warning is within 500 miles.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '70 days'),
  ('16000000-0000-4000-8000-000000000008', '13000000-0000-4000-8000-000000000009', 'Monthly service', current_date + 3, null, 30, null, 10, 500, null, 'Due after expedited Oregon load.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '27 days'),
  ('16000000-0000-4000-8000-000000000009', '13000000-0000-4000-8000-000000000010', '90-day inspection', current_date - 1, null, 90, null, 14, 500, null, 'Trailer inspection overdue by one day.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '91 days'),
  ('16000000-0000-4000-8000-000000000010', '13000000-0000-4000-8000-000000000012', 'Annual inspection', current_date + 210, null, 365, null, 30, 500, null, 'Long-range upcoming schedule.', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '150 days'),
  ('16000000-0000-4000-8000-000000000011', '13000000-0000-4000-8000-000000000001', 'Monthly service', current_date - 31, null, 30, null, 14, 500, null, 'Completed recurring schedule sample.', now() - interval '31 days', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', 'service_records', '15000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '62 days');

insert into public.ifta_trips (id, truck_number, start_date, end_date, pickup_city, dropoff_city, notes, created_at) values
  ('17000000-0000-4000-8000-000000000001', 'RD-101', current_date - 1, current_date + 1, 'Ontario, CA', 'Phoenix, AZ', 'Current showcase trip.', now() - interval '1 day'),
  ('17000000-0000-4000-8000-000000000002', 'RC-201', current_date - 10, current_date - 8, 'San Diego, CA', 'Las Vegas, NV', 'Completed via I-15.', now() - interval '10 days'),
  ('17000000-0000-4000-8000-000000000003', 'RD-102', current_date - 18, current_date - 15, 'Fontana, CA', 'El Paso, TX', 'I-10 eastbound route.', now() - interval '18 days'),
  ('17000000-0000-4000-8000-000000000004', 'RC-202', current_date - 24, current_date - 21, 'Fresno, CA', 'Portland, OR', 'I-5 northbound route.', now() - interval '24 days'),
  ('17000000-0000-4000-8000-000000000005', 'RD-103', current_date - 32, current_date - 30, 'Riverside, CA', 'Tucson, AZ', 'Customer return trip was empty.', now() - interval '32 days'),
  ('17000000-0000-4000-8000-000000000006', 'RC-203', current_date - 40, current_date - 37, 'Stockton, CA', 'Eugene, OR', 'Retail replenishment lane.', now() - interval '40 days'),
  ('17000000-0000-4000-8000-000000000007', 'RD-101', current_date - 82, current_date - 79, 'Ontario, CA', 'Denver, CO', 'Prior-quarter mileage.', now() - interval '82 days'),
  ('17000000-0000-4000-8000-000000000008', 'RC-201', current_date - 70, current_date - 68, 'San Diego, CA', 'Flagstaff, AZ', 'Prior-quarter round trip outbound leg.', now() - interval '70 days');

insert into public.ifta_trip_miles (id, trip_id, state, miles) values
  ('17100000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000001', 'CA', 221.4),
  ('17100000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', 'AZ', 116.8),
  ('17100000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000002', 'CA', 178.2),
  ('17100000-0000-4000-8000-000000000004', '17000000-0000-4000-8000-000000000002', 'NV', 154.6),
  ('17100000-0000-4000-8000-000000000005', '17000000-0000-4000-8000-000000000003', 'CA', 238.9),
  ('17100000-0000-4000-8000-000000000006', '17000000-0000-4000-8000-000000000003', 'AZ', 392.5),
  ('17100000-0000-4000-8000-000000000007', '17000000-0000-4000-8000-000000000003', 'NM', 167.4),
  ('17100000-0000-4000-8000-000000000008', '17000000-0000-4000-8000-000000000003', 'TX', 36.2),
  ('17100000-0000-4000-8000-000000000009', '17000000-0000-4000-8000-000000000004', 'CA', 614.8),
  ('17100000-0000-4000-8000-000000000010', '17000000-0000-4000-8000-000000000004', 'OR', 160.7),
  ('17100000-0000-4000-8000-000000000011', '17000000-0000-4000-8000-000000000005', 'CA', 181.3),
  ('17100000-0000-4000-8000-000000000012', '17000000-0000-4000-8000-000000000005', 'AZ', 264.5),
  ('17100000-0000-4000-8000-000000000013', '17000000-0000-4000-8000-000000000006', 'CA', 383.4),
  ('17100000-0000-4000-8000-000000000014', '17000000-0000-4000-8000-000000000006', 'OR', 219.6),
  ('17100000-0000-4000-8000-000000000015', '17000000-0000-4000-8000-000000000007', 'CA', 242.1),
  ('17100000-0000-4000-8000-000000000016', '17000000-0000-4000-8000-000000000007', 'NV', 407.7),
  ('17100000-0000-4000-8000-000000000017', '17000000-0000-4000-8000-000000000007', 'UT', 124.9),
  ('17100000-0000-4000-8000-000000000018', '17000000-0000-4000-8000-000000000007', 'CO', 236.4),
  ('17100000-0000-4000-8000-000000000019', '17000000-0000-4000-8000-000000000008', 'CA', 178.2),
  ('17100000-0000-4000-8000-000000000020', '17000000-0000-4000-8000-000000000008', 'AZ', 296.1);

insert into public.ifta_fuel_purchases (id, unit_id, truck_number, purchase_date, city, state, gallons, amount_paid, vendor, notes, created_at) values
  ('17200000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'RD-101', current_date, 'Blythe', 'CA', 82.4, 355.88, 'Estrella Travel Center', 'Receipt attached in Bookkeeping.', now() - interval '5 hours'),
  ('17200000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000007', 'RC-201', current_date - 9, 'Barstow', 'CA', 96.7, 411.92, 'Camino Fuel Stop', 'Fleet card purchase.', now() - interval '9 days'),
  ('17200000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000002', 'RD-102', current_date - 17, 'Quartzsite', 'AZ', 101.2, 420.98, 'Sol Desert Travel Plaza', 'I-10 fuel stop.', now() - interval '17 days'),
  ('17200000-0000-4000-8000-000000000004', '13000000-0000-4000-8000-000000000008', 'RC-202', current_date - 23, 'Redding', 'CA', 88.6, 401.37, 'Valle Travel Center', 'Northbound fuel stop.', now() - interval '23 days'),
  ('17200000-0000-4000-8000-000000000005', '13000000-0000-4000-8000-000000000003', 'RD-103', current_date - 31, 'Ehrenberg', 'AZ', 74.3, 309.24, 'Frontera Fuel', 'Southwest lane purchase.', now() - interval '31 days'),
  ('17200000-0000-4000-8000-000000000006', '13000000-0000-4000-8000-000000000009', 'RC-203', current_date - 39, 'Medford', 'OR', 91.5, 423.65, 'Pacific Camino Fuel', 'Oregon fuel purchase.', now() - interval '39 days'),
  ('17200000-0000-4000-8000-000000000007', '13000000-0000-4000-8000-000000000001', 'RD-101', current_date - 81, 'Cedar City', 'UT', 105.0, 446.25, 'Sierra Travel Plaza', 'Prior-quarter purchase.', now() - interval '81 days'),
  ('17200000-0000-4000-8000-000000000008', '13000000-0000-4000-8000-000000000007', 'RC-201', current_date - 69, 'Yuma', 'AZ', 79.8, 332.77, 'Sol Desert Travel Plaza', 'Prior-quarter purchase.', now() - interval '69 days');

-- Unified ledger: source-linked examples plus every manual category.
insert into public.bookkeeping_expense_groups (
  id, expense_date, vendor, notes, unit_id, load_id, driver_id,
  source_type, source_id, service_record_id, inspection_record_id,
  repair_log_id, ifta_fuel_purchase_id, created_by, created_by_email, created_at
) values
  ('18000000-0000-4000-8000-000000000001', current_date, 'Estrella Travel Center', 'IFTA-linked fuel purchase with receipt.', '13000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'ifta', '17200000-0000-4000-8000-000000000001', null, null, null, '17200000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '5 hours'),
  ('18000000-0000-4000-8000-000000000002', current_date - 8, 'Taller Mendoza Diesel', 'Labor and parts breakdown; linked to the repair history.', '13000000-0000-4000-8000-000000000002', null, '11000000-0000-4000-8000-000000000002', 'maintenance', '15200000-0000-4000-8000-000000000001', null, null, '15200000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '8 days'),
  ('18000000-0000-4000-8000-000000000003', current_date - 3, 'South Bay Express Lanes', 'Two toll transactions consolidated on one statement.', '13000000-0000-4000-8000-000000000007', null, '11000000-0000-4000-8000-000000000004', 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '3 days'),
  ('18000000-0000-4000-8000-000000000004', current_date - 16, 'Sierra Commercial Insurance', 'RC monthly commercial auto premium.', '13000000-0000-4000-8000-000000000007', null, null, 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '16 days'),
  ('18000000-0000-4000-8000-000000000005', current_date - 6, 'Arizona Motor Carrier Services', 'Single-trip permit tied to Tucson load.', '13000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000005', '11000000-0000-4000-8000-000000000003', 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '6 days'),
  ('18000000-0000-4000-8000-000000000006', current_date - 4, 'Border City Secure Parking', 'Overnight secure parking before port appointment.', '13000000-0000-4000-8000-000000000008', null, '11000000-0000-4000-8000-000000000005', 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '4 days'),
  ('18000000-0000-4000-8000-000000000007', current_date - 9, 'Valle Truck Parts', 'Marker lamps and connectors for trailer stock.', '13000000-0000-4000-8000-000000000010', null, null, 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '9 days'),
  ('18000000-0000-4000-8000-000000000008', current_date - 11, 'Mercado Fleet Supply', 'Load locks, safety vests, and security seals.', null, null, null, 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '11 days'),
  ('18000000-0000-4000-8000-000000000009', current_date - 12, 'El Camino Truck Wash', 'Tractor and trailer wash before customer pickup.', '13000000-0000-4000-8000-000000000009', null, '11000000-0000-4000-8000-000000000006', 'manual', null, null, null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '12 days'),
  ('18000000-0000-4000-8000-000000000010', current_date - 58, 'Taller Mendoza Diesel', 'Oil change linked to service history; no receipt attached.', '13000000-0000-4000-8000-000000000002', null, '11000000-0000-4000-8000-000000000002', 'maintenance', '15000000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', null, null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '58 days'),
  ('18000000-0000-4000-8000-000000000011', current_date - 9, 'Camino Fuel Stop', 'IFTA source - receipt intentionally missing.', '13000000-0000-4000-8000-000000000007', null, '11000000-0000-4000-8000-000000000004', 'ifta', '17200000-0000-4000-8000-000000000002', null, null, null, '17200000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '9 days'),
  ('18000000-0000-4000-8000-000000000012', current_date - 17, 'Sol Desert Travel Plaza', 'IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000002', null, '11000000-0000-4000-8000-000000000002', 'ifta', '17200000-0000-4000-8000-000000000003', null, null, null, '17200000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '17 days'),
  ('18000000-0000-4000-8000-000000000013', current_date - 23, 'Valle Travel Center', 'IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000008', null, '11000000-0000-4000-8000-000000000005', 'ifta', '17200000-0000-4000-8000-000000000004', null, null, null, '17200000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '23 days'),
  ('18000000-0000-4000-8000-000000000014', current_date - 31, 'Frontera Fuel', 'IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000003', null, '11000000-0000-4000-8000-000000000003', 'ifta', '17200000-0000-4000-8000-000000000005', null, null, null, '17200000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '31 days'),
  ('18000000-0000-4000-8000-000000000015', current_date - 39, 'Pacific Camino Fuel', 'IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000009', null, '11000000-0000-4000-8000-000000000006', 'ifta', '17200000-0000-4000-8000-000000000006', null, null, null, '17200000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '39 days'),
  ('18000000-0000-4000-8000-000000000016', current_date - 81, 'Sierra Travel Plaza', 'Prior-quarter IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000001', null, '11000000-0000-4000-8000-000000000001', 'ifta', '17200000-0000-4000-8000-000000000007', null, null, null, '17200000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '81 days'),
  ('18000000-0000-4000-8000-000000000017', current_date - 69, 'Sol Desert Travel Plaza', 'Prior-quarter IFTA-linked fuel expense.', '13000000-0000-4000-8000-000000000007', null, '11000000-0000-4000-8000-000000000004', 'ifta', '17200000-0000-4000-8000-000000000008', null, null, null, '17200000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '69 days'),
  ('18000000-0000-4000-8000-000000000018', current_date - 120, 'Valle Trailer Service', 'Inspection correction linked to trailer history; no receipt.', '13000000-0000-4000-8000-000000000004', null, null, 'maintenance', '15100000-0000-4000-8000-000000000002', null, '15100000-0000-4000-8000-000000000002', null, null, '10000000-0000-4000-8000-000000000001', 'andres.castillo@dispatchdesk.demo', now() - interval '120 days');

insert into public.bookkeeping_expenses (id, group_id, category, amount, line_type, created_at) values
  ('18100000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000001', 'Fuel', 355.88, 'total', now() - interval '5 hours'),
  ('18100000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002', 'Maintenance', 420.00, 'labor', now() - interval '8 days'),
  ('18100000-0000-4000-8000-000000000003', '18000000-0000-4000-8000-000000000002', 'Parts', 186.75, 'parts', now() - interval '8 days'),
  ('18100000-0000-4000-8000-000000000004', '18000000-0000-4000-8000-000000000003', 'Tolls', 37.00, 'total', now() - interval '3 days'),
  ('18100000-0000-4000-8000-000000000005', '18000000-0000-4000-8000-000000000004', 'Insurance', 1480.00, 'total', now() - interval '16 days'),
  ('18100000-0000-4000-8000-000000000006', '18000000-0000-4000-8000-000000000005', 'Permits', 75.00, 'total', now() - interval '6 days'),
  ('18100000-0000-4000-8000-000000000007', '18000000-0000-4000-8000-000000000006', 'Parking', 32.00, 'total', now() - interval '4 days'),
  ('18100000-0000-4000-8000-000000000008', '18000000-0000-4000-8000-000000000007', 'Parts', 66.75, 'total', now() - interval '9 days'),
  ('18100000-0000-4000-8000-000000000009', '18000000-0000-4000-8000-000000000008', 'Supplies', 168.34, 'total', now() - interval '11 days'),
  ('18100000-0000-4000-8000-000000000010', '18000000-0000-4000-8000-000000000009', 'Other', 92.00, 'total', now() - interval '12 days'),
  ('18100000-0000-4000-8000-000000000011', '18000000-0000-4000-8000-000000000010', 'Maintenance', 489.90, 'total', now() - interval '58 days'),
  ('18100000-0000-4000-8000-000000000012', '18000000-0000-4000-8000-000000000011', 'Fuel', 411.92, 'total', now() - interval '9 days'),
  ('18100000-0000-4000-8000-000000000013', '18000000-0000-4000-8000-000000000012', 'Fuel', 420.98, 'total', now() - interval '17 days'),
  ('18100000-0000-4000-8000-000000000014', '18000000-0000-4000-8000-000000000013', 'Fuel', 401.37, 'total', now() - interval '23 days'),
  ('18100000-0000-4000-8000-000000000015', '18000000-0000-4000-8000-000000000014', 'Fuel', 309.24, 'total', now() - interval '31 days'),
  ('18100000-0000-4000-8000-000000000016', '18000000-0000-4000-8000-000000000015', 'Fuel', 423.65, 'total', now() - interval '39 days'),
  ('18100000-0000-4000-8000-000000000017', '18000000-0000-4000-8000-000000000016', 'Fuel', 446.25, 'total', now() - interval '81 days'),
  ('18100000-0000-4000-8000-000000000018', '18000000-0000-4000-8000-000000000017', 'Fuel', 332.77, 'total', now() - interval '69 days'),
  ('18100000-0000-4000-8000-000000000019', '18000000-0000-4000-8000-000000000018', 'Maintenance', 185.00, 'total', now() - interval '120 days');

insert into public.bookkeeping_receipts (id, group_id, file_name, storage_path, content_type, file_size, created_at) values
  ('18200000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000001', 'diesel-receipt.pdf', '18000000-0000-4000-8000-000000000001/18200000-0000-4000-8000-000000000001-diesel-receipt.pdf', 'application/pdf', 2356, now() - interval '5 hours'),
  ('18200000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002', 'maintenance-invoice.pdf', '18000000-0000-4000-8000-000000000002/18200000-0000-4000-8000-000000000002-maintenance-invoice.pdf', 'application/pdf', 2462, now() - interval '8 days'),
  ('18200000-0000-4000-8000-000000000003', '18000000-0000-4000-8000-000000000003', 'toll-statement.pdf', '18000000-0000-4000-8000-000000000003/18200000-0000-4000-8000-000000000003-toll-statement.pdf', 'application/pdf', 2405, now() - interval '3 days'),
  ('18200000-0000-4000-8000-000000000004', '18000000-0000-4000-8000-000000000004', 'insurance-premium.pdf', '18000000-0000-4000-8000-000000000004/18200000-0000-4000-8000-000000000004-insurance-premium.pdf', 'application/pdf', 2385, now() - interval '16 days'),
  ('18200000-0000-4000-8000-000000000005', '18000000-0000-4000-8000-000000000005', 'permit-receipt.pdf', '18000000-0000-4000-8000-000000000005/18200000-0000-4000-8000-000000000005-permit-receipt.pdf', 'application/pdf', 2382, now() - interval '6 days'),
  ('18200000-0000-4000-8000-000000000006', '18000000-0000-4000-8000-000000000006', 'parking-receipt.pdf', '18000000-0000-4000-8000-000000000006/18200000-0000-4000-8000-000000000006-parking-receipt.pdf', 'application/pdf', 2383, now() - interval '4 days'),
  ('18200000-0000-4000-8000-000000000007', '18000000-0000-4000-8000-000000000007', 'parts-receipt.pdf', '18000000-0000-4000-8000-000000000007/18200000-0000-4000-8000-000000000007-parts-receipt.pdf', 'application/pdf', 2424, now() - interval '9 days'),
  ('18200000-0000-4000-8000-000000000008', '18000000-0000-4000-8000-000000000008', 'supplies-receipt.pdf', '18000000-0000-4000-8000-000000000008/18200000-0000-4000-8000-000000000008-supplies-receipt.pdf', 'application/pdf', 2475, now() - interval '11 days'),
  ('18200000-0000-4000-8000-000000000009', '18000000-0000-4000-8000-000000000009', 'truck-wash-receipt.pdf', '18000000-0000-4000-8000-000000000009/18200000-0000-4000-8000-000000000009-truck-wash-receipt.pdf', 'application/pdf', 2320, now() - interval '12 days');

insert into public.documents (id, load_id, file_name, category, notes, storage_path, created_at) values
  ('19000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 'rate-confirmation.pdf', 'Rate Confirmation', 'Signed rate confirmation for the showcase load.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000001-rate-confirmation.pdf', now() - interval '23 hours'),
  ('19000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', 'invoice.pdf', 'Invoice', 'Sample carrier invoice.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000002-invoice.pdf', now() - interval '3 hours'),
  ('19000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000001', 'bill-of-lading.pdf', 'BOL', 'Pickup BOL with seal and commodity detail.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000003-bill-of-lading.pdf', now() - interval '20 hours'),
  ('19000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000001', 'fuel-receipt.pdf', 'Fuel Receipt', 'Road fuel receipt also represented in the unified ledger.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000004-fuel-receipt.pdf', now() - interval '5 hours'),
  ('19000000-0000-4000-8000-000000000005', '14000000-0000-4000-8000-000000000001', 'lumper-receipt.pdf', 'Lumper Receipt', 'Receiver unload fee example.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000005-lumper-receipt.pdf', now() - interval '2 hours'),
  ('19000000-0000-4000-8000-000000000006', '14000000-0000-4000-8000-000000000001', 'insurance-certificate.pdf', 'Insurance', 'Fictional certificate of insurance.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000006-insurance-certificate.pdf', now() - interval '22 hours'),
  ('19000000-0000-4000-8000-000000000007', '14000000-0000-4000-8000-000000000001', 'carrier-packet.pdf', 'Carrier Packet', 'Fictional RD onboarding packet.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000007-carrier-packet.pdf', now() - interval '22 hours'),
  ('19000000-0000-4000-8000-000000000008', '14000000-0000-4000-8000-000000000001', 'detention-approval.pdf', 'Other', 'Example accessorial approval.', '14000000-0000-4000-8000-000000000001/19000000-0000-4000-8000-000000000008-detention-approval.pdf', now() - interval '1 hour');

commit;

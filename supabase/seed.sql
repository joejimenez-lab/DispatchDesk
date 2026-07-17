-- Stable hosted demo data for DispatchDesk schema through migration 018.
-- Keeps auth users/profiles intact and replaces only operational records.

begin;

truncate table
  public.bookkeeping_receipts,
  public.bookkeeping_expenses,
  public.ifta_trip_miles,
  public.ifta_fuel_purchases,
  public.ifta_trips,
  public.maintenance_reminders,
  public.service_records,
  public.inspection_records,
  public.repair_logs,
  public.fleet_units,
  public.documents,
  public.notes,
  public.activity_logs,
  public.payments,
  public.loads,
  public.brokers,
  public.drivers
restart identity cascade;

insert into public.drivers (id, name, phone, email, truck_number, trailer_number, notes) values
  ('10000000-0000-4000-8000-000000000001', 'Marcus Reed', '(214) 555-0142', 'marcus@example.test', '102', 'T-48', 'Primary Texas and Southwest lanes.'),
  ('10000000-0000-4000-8000-000000000002', 'Elena Torres', '(602) 555-0188', 'elena@example.test', '207', 'T-63', 'Hazmat endorsement; prefers western routes.'),
  ('10000000-0000-4000-8000-000000000003', 'Darnell Brooks', '(404) 555-0109', 'darnell@example.test', '315', 'T-71', 'Southeast regional driver.'),
  ('10000000-0000-4000-8000-000000000004', 'Priya Shah', '(312) 555-0165', 'priya@example.test', '411', 'T-82', 'Relief driver available for priority loads.');

insert into public.brokers (id, company_name, contact_name, phone, email, notes) values
  ('20000000-0000-4000-8000-000000000001', 'BlueLine Logistics', 'Jordan Lee', '(972) 555-0110', 'jordan@blueline.example', 'Fast paperwork and reliable detention approvals.'),
  ('20000000-0000-4000-8000-000000000002', 'Summit Freight Partners', 'Casey Morgan', '(480) 555-0191', 'casey@summitfreight.example', 'Net 30; submit POD with invoice.'),
  ('20000000-0000-4000-8000-000000000003', 'Redwood Transport Group', 'Taylor Kim', '(510) 555-0137', 'taylor@redwood.example', 'West Coast produce and dry van lanes.'),
  ('20000000-0000-4000-8000-000000000004', 'Heartland Brokerage', 'Avery Johnson', '(816) 555-0174', 'avery@heartland.example', 'After-hours tracking required.');

-- Inserts create matching payment and activity rows through existing triggers.
insert into public.loads (
  id, load_number, broker_id, carrier_company, driver_id,
  pickup_location, pickup_date, delivery_location, delivery_date,
  is_round_trip, return_location, round_trip_details,
  load_rate, driver_pay, dispatcher_fee, fuel_cost, notes, status
) values
  ('30000000-0000-4000-8000-000000000001', 'DD-2601', '20000000-0000-4000-8000-000000000001', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000001', 'Dallas, TX', current_date - 1, 'Nashville, TN', current_date + 1, false, null, null, 3850, 2150, 385, 690, 'On schedule; receiver appointment confirmed.', 'In Transit'),
  ('30000000-0000-4000-8000-000000000002', 'DD-2602', '20000000-0000-4000-8000-000000000002', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000002', 'Phoenix, AZ', current_date, 'Denver, CO', current_date + 2, false, null, null, 3425, 1980, 342.50, 610, 'Driver dispatched; pickup number in notes.', 'Dispatched'),
  ('30000000-0000-4000-8000-000000000003', 'DD-2603', '20000000-0000-4000-8000-000000000003', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000004', 'Oakland, CA', current_date + 2, 'Portland, OR', current_date + 4, false, null, null, 2950, 1725, 295, 520, 'Priority customer; call before arrival.', 'Booked'),
  ('30000000-0000-4000-8000-000000000004', 'DD-2604', '20000000-0000-4000-8000-000000000004', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000003', 'Atlanta, GA', current_date, 'Charlotte, NC', current_date + 1, false, null, null, 2450, 1425, 245, 410, 'Loaded early; seal verified.', 'Picked Up'),
  ('30000000-0000-4000-8000-000000000005', 'DD-2598', '20000000-0000-4000-8000-000000000001', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000001', 'Fort Worth, TX', current_date - 6, 'Memphis, TN', current_date - 4, false, null, null, 3200, 1800, 320, 570, 'POD uploaded; awaiting broker payment.', 'Delivered'),
  ('30000000-0000-4000-8000-000000000006', 'DD-2569', '20000000-0000-4000-8000-000000000002', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000002', 'Las Vegas, NV', current_date - 45, 'Salt Lake City, UT', current_date - 42, false, null, null, 4100, 2300, 410, 735, 'Invoice aging beyond 30 days; follow-up scheduled.', 'Delivered'),
  ('30000000-0000-4000-8000-000000000007', 'DD-2587', '20000000-0000-4000-8000-000000000004', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000003', 'Savannah, GA', current_date - 15, 'Orlando, FL', current_date - 12, false, null, null, 3650, 2050, 365, 650, 'Settled and closed.', 'Closed'),
  ('30000000-0000-4000-8000-000000000008', 'DD-2558', '20000000-0000-4000-8000-000000000003', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000004', 'Sacramento, CA', current_date - 50, 'Seattle, WA', current_date - 47, false, null, null, 4550, 2525, 455, 810, 'Partial payment received; balance under review.', 'Closed'),
  ('30000000-0000-4000-8000-000000000009', 'DD-2600', '20000000-0000-4000-8000-000000000002', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000002', 'Tucson, AZ', current_date - 2, 'Albuquerque, NM', current_date, false, null, null, 2100, 1200, 210, 0, 'Cancelled by customer before dispatch; TONU requested.', 'Cancelled'),
  ('30000000-0000-4000-8000-000000000010', 'DD-2605', '20000000-0000-4000-8000-000000000001', 'Northstar Carrier Co.', '10000000-0000-4000-8000-000000000001', 'Dallas, TX', current_date - 1, 'Oklahoma City, OK', current_date + 2, true, 'Dallas, TX', 'Return with packaging materials after delivery.', 4725, 2650, 472.50, 845, 'Round trip; return appointment is open.', 'In Transit');

update public.payments p set
  invoice_sent = true, invoice_sent_date = current_date - 3
from public.loads l where p.load_id = l.id and l.load_number = 'DD-2598';

update public.payments p set
  invoice_sent = true, invoice_sent_date = current_date - 41
from public.loads l where p.load_id = l.id and l.load_number = 'DD-2569';

update public.payments p set
  invoice_sent = true, invoice_sent_date = current_date - 11,
  client_paid = true, client_amount_received = 3650, client_date_received = current_date - 6,
  driver_paid = true, driver_amount_paid = 2050, driver_date_paid = current_date - 7,
  dispatcher_paid = true, dispatcher_date_paid = current_date - 5
from public.loads l where p.load_id = l.id and l.load_number = 'DD-2587';

update public.payments p set
  invoice_sent = true, invoice_sent_date = current_date - 46,
  client_paid = false, client_amount_received = 3000, client_date_received = current_date - 20,
  driver_paid = true, driver_amount_paid = 2525, driver_date_paid = current_date - 18,
  dispatcher_paid = false
from public.loads l where p.load_id = l.id and l.load_number = 'DD-2558';

insert into public.notes (load_id, note_text) values
  ('30000000-0000-4000-8000-000000000001', 'Driver checked in from Little Rock; ETA remains 09:30.'),
  ('30000000-0000-4000-8000-000000000002', 'Pickup reference: SFP-77421. Ask for shipping desk 4.'),
  ('30000000-0000-4000-8000-000000000005', 'Broker confirmed invoice is in the next payment batch.'),
  ('30000000-0000-4000-8000-000000000006', 'Second aging follow-up sent to accounts payable.'),
  ('30000000-0000-4000-8000-000000000010', 'Return load is light packaging material; no washout required.');

insert into public.fleet_units (id, unit_number, unit_type, company, odometer, notes) values
  ('40000000-0000-4000-8000-000000000001', '102', 'Truck', 'RD', 126480, '2022 Freightliner Cascadia; assigned to Marcus Reed.'),
  ('40000000-0000-4000-8000-000000000002', '207', 'Truck', 'DC', 189250, '2020 Kenworth T680; assigned to Elena Torres.'),
  ('40000000-0000-4000-8000-000000000003', '315', 'Truck', 'RD', 74350, '2024 Peterbilt 579; assigned to Darnell Brooks.'),
  ('40000000-0000-4000-8000-000000000004', 'T-48', 'Trailer', 'RD', null, '53-foot dry van; paired with unit 102.'),
  ('40000000-0000-4000-8000-000000000005', 'T-63', 'Trailer', 'DC', null, '53-foot dry van; paired with unit 207.');

insert into public.service_records (id, unit_id, service_date, odometer, description, cost, notes) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', current_date - 34, 121120, 'Oil and filter service', 428.65, 'Replaced fuel filters and topped off DEF.'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', current_date - 63, 180740, 'Preventive maintenance service', 795.20, 'Full PM with chassis lubrication.'),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', current_date - 18, 71620, 'Monthly service', 312.40, 'Fluids, belts, and tire pressure checked.');

insert into public.inspection_records (id, unit_id, inspection_date, odometer, inspector, result, notes) values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', current_date - 78, 114200, 'Metro Fleet Safety', 'Passed', 'No out-of-service defects.'),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', current_date - 340, null, 'Lone Star Trailer Service', 'Passed', 'Annual DOT inspection completed.'),
  ('60000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000005', current_date - 52, null, 'Desert Fleet Services', 'Passed with note', 'Monitor curbside rear tire wear.');

insert into public.repair_logs (id, unit_id, repair_date, odometer, description, cost, notes, log_type) values
  ('70000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', current_date - 21, 186910, 'Replaced alternator and belt tensioner', 1385.75, 'Charging system tested after repair.', 'Repair'),
  ('70000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', current_date - 3, 74110, 'Driver post-trip: right marker light intermittent', 0, 'Part ordered; safe to operate in daylight.', 'Daily repair log'),
  ('70000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', current_date - 47, null, 'Repaired roof rail seal', 522.90, 'Water test passed after reseal.', 'Repair');

-- Alert set: 2 overdue, 2 due soon, 2 upcoming, and 1 snoozed.
insert into public.maintenance_reminders (
  id, unit_id, reminder_type, due_date, due_odometer,
  interval_days, interval_miles, warning_days, warning_miles,
  snoozed_until, notes
) values
  ('80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Monthly service', current_date - 7, null, 30, null, 14, 500, null, 'Schedule PM at Metro Diesel; filters are in stock.'),
  ('80000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Oil change', null, 188000, null, 10000, 30, 500, null, 'Use synthetic 15W-40; include oil analysis sample.'),
  ('80000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004', 'Annual inspection', current_date + 12, null, 365, null, 30, 500, null, 'DOT annual inspection; verify registration document tube.'),
  ('80000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000003', 'Repair follow-up', current_date + 8, 74600, null, null, 14, 500, null, 'Confirm marker-light repair and inspect wiring harness.'),
  ('80000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'Annual inspection', current_date + 90, null, 365, null, 30, 500, null, 'Annual DOT inspection reservation opens next month.'),
  ('80000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000005', '90-day inspection', current_date + 60, null, 90, null, 15, 500, null, 'Routine trailer safety inspection.'),
  ('80000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', 'Monthly service', current_date - 2, null, 30, null, 14, 500, current_date + 5, 'Snoozed until unit returns from the current lane.');

insert into public.ifta_trips (id, truck_number, start_date, end_date, pickup_city, dropoff_city, notes) values
  ('90000000-0000-4000-8000-000000000001', '102', current_date - 10, current_date - 8, 'Dallas, TX', 'Denver, CO', 'I-35 / I-70 route.'),
  ('90000000-0000-4000-8000-000000000002', '207', current_date - 7, current_date - 5, 'Phoenix, AZ', 'Las Vegas, NV', 'US-93 corridor.'),
  ('90000000-0000-4000-8000-000000000003', '315', current_date - 4, current_date - 2, 'Atlanta, GA', 'Nashville, TN', 'I-75 / I-24 route.'),
  ('90000000-0000-4000-8000-000000000004', '102', current_date - 48, current_date - 45, 'Dallas, TX', 'Albuquerque, NM', 'Previous-quarter comparison trip.'),
  ('90000000-0000-4000-8000-000000000005', '207', current_date - 76, current_date - 73, 'Los Angeles, CA', 'Salt Lake City, UT', 'Previous-quarter western route.');

insert into public.ifta_trip_miles (trip_id, state, miles) values
  ('90000000-0000-4000-8000-000000000001', 'TX', 355.4), ('90000000-0000-4000-8000-000000000001', 'OK', 214.8), ('90000000-0000-4000-8000-000000000001', 'KS', 176.2), ('90000000-0000-4000-8000-000000000001', 'CO', 182.6),
  ('90000000-0000-4000-8000-000000000002', 'AZ', 218.5), ('90000000-0000-4000-8000-000000000002', 'NV', 84.7),
  ('90000000-0000-4000-8000-000000000003', 'GA', 118.9), ('90000000-0000-4000-8000-000000000003', 'TN', 130.6),
  ('90000000-0000-4000-8000-000000000004', 'TX', 417.2), ('90000000-0000-4000-8000-000000000004', 'NM', 226.8),
  ('90000000-0000-4000-8000-000000000005', 'CA', 237.5), ('90000000-0000-4000-8000-000000000005', 'NV', 388.4), ('90000000-0000-4000-8000-000000000005', 'UT', 183.1);

insert into public.ifta_fuel_purchases (id, truck_number, purchase_date, city, state, gallons, amount_paid, notes) values
  ('a0000000-0000-4000-8000-000000000001', '102', current_date - 9, 'Oklahoma City', 'OK', 118.6, 421.03, 'Pilot #418; card ending 2041.'),
  ('a0000000-0000-4000-8000-000000000002', '102', current_date - 8, 'Colby', 'KS', 92.4, 337.26, 'Love''s Travel Stop.'),
  ('a0000000-0000-4000-8000-000000000003', '207', current_date - 6, 'Kingman', 'AZ', 106.8, 391.02, 'TA fuel receipt verified.'),
  ('a0000000-0000-4000-8000-000000000004', '315', current_date - 3, 'Chattanooga', 'TN', 84.7, 305.75, 'Fleet card purchase.'),
  ('a0000000-0000-4000-8000-000000000005', '102', current_date - 47, 'Amarillo', 'TX', 121.2, 432.68, 'Previous-quarter fuel purchase.'),
  ('a0000000-0000-4000-8000-000000000006', '207', current_date - 74, 'Mesquite', 'NV', 127.5, 468.56, 'Previous-quarter fuel purchase.');

insert into public.bookkeeping_expenses (
  id, expense_date, category, amount, vendor, notes,
  unit_id, load_id, driver_id, service_record_id, inspection_record_id, repair_log_id
) values
  ('b0000000-0000-4000-8000-000000000001', current_date - 9, 'Fuel', 421.03, 'Pilot Travel Centers', 'Fuel for Dallas to Denver lane.', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, null, null),
  ('b0000000-0000-4000-8000-000000000002', current_date - 21, 'Maintenance', 1385.75, 'Desert Fleet Services', 'Alternator and belt tensioner replacement.', '40000000-0000-4000-8000-000000000002', null, '10000000-0000-4000-8000-000000000002', null, null, '70000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', current_date - 11, 'Tolls', 186.40, 'E-ZPass', 'Tolls across current active lanes.', null, '30000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', null, null, null),
  ('b0000000-0000-4000-8000-000000000004', current_date - 29, 'Insurance', 2475.00, 'Great Plains Commercial', 'Monthly fleet insurance premium.', null, null, null, null, null, null),
  ('b0000000-0000-4000-8000-000000000005', current_date - 16, 'Permits', 185.00, 'Colorado DOT', 'Oversize permit and processing fee.', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', null, null, null, null),
  ('b0000000-0000-4000-8000-000000000006', current_date - 5, 'Parking', 42.00, 'Secure Truck Parking', 'Overnight parking near Phoenix.', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', null, null, null),
  ('b0000000-0000-4000-8000-000000000007', current_date - 3, 'Parts', 68.95, 'NAPA Fleet', 'Marker light and wiring pigtail.', '40000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000003', null, null, '70000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000008', current_date - 13, 'Supplies', 119.32, 'FleetPride', 'Straps, seals, gloves, and absorbent pads.', null, null, null, null, null, null),
  ('b0000000-0000-4000-8000-000000000009', current_date - 34, 'Maintenance', 428.65, 'Metro Diesel', 'Oil and filter service.', '40000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', null, null),
  ('b0000000-0000-4000-8000-000000000010', current_date - 2, 'Other', 275.00, 'Roadside Compliance LLC', 'Annual drug consortium and compliance fee.', null, null, null, null, null, null);

commit;

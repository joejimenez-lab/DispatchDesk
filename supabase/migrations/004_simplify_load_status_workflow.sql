alter table public.payments
  add column if not exists pod_received boolean not null default false,
  add column if not exists pod_received_date date,
  add column if not exists invoice_sent boolean not null default false,
  add column if not exists invoice_sent_date date;

update public.payments p
set
  pod_received = true,
  invoice_sent = case
    when l.status::text in ('Invoiced', 'Client Paid', 'Driver Paid', 'Dispatcher Paid') then true
    else p.invoice_sent
  end,
  client_paid = case when l.status::text = 'Client Paid' then true else p.client_paid end,
  driver_paid = case when l.status::text = 'Driver Paid' then true else p.driver_paid end,
  dispatcher_paid = case when l.status::text = 'Dispatcher Paid' then true else p.dispatcher_paid end,
  client_amount_received = case
    when l.status::text = 'Client Paid' and p.client_amount_received = 0 then l.load_rate
    else p.client_amount_received
  end,
  driver_amount_paid = case
    when l.status::text = 'Driver Paid' and p.driver_amount_paid = 0 then l.driver_pay
    else p.driver_amount_paid
  end,
  dispatcher_fee_amount = case
    when l.status::text = 'Dispatcher Paid' and p.dispatcher_fee_amount = 0 then l.dispatcher_fee
    else p.dispatcher_fee_amount
  end
from public.loads l
where p.load_id = l.id
  and l.status::text in ('POD Received', 'Invoiced', 'Client Paid', 'Driver Paid', 'Dispatcher Paid');

alter type public.load_status rename to load_status_old;

create type public.load_status as enum (
  'Booked',
  'Dispatched',
  'Picked Up',
  'In Transit',
  'Delivered',
  'Closed',
  'Cancelled'
);

alter table public.loads
  alter column status drop default,
  alter column status type public.load_status using (
    case
      when status::text in ('POD Received', 'Invoiced', 'Client Paid', 'Driver Paid', 'Dispatcher Paid') then 'Delivered'
      else status::text
    end
  )::public.load_status,
  alter column status set default 'Booked';

drop type public.load_status_old;

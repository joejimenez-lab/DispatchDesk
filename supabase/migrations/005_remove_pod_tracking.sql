update public.documents
set category = 'BOL'::public.document_category
where category::text = 'POD';

alter type public.document_category rename to document_category_old;

create type public.document_category as enum (
  'Rate Confirmation',
  'Invoice',
  'BOL',
  'Fuel Receipt',
  'Lumper Receipt',
  'Insurance',
  'Carrier Packet',
  'Other'
);

alter table public.documents
  alter column category drop default,
  alter column category type public.document_category using (
    case
      when category::text = 'POD' then 'BOL'
      else category::text
    end
  )::public.document_category,
  alter column category set default 'Other';

drop type public.document_category_old;

alter table public.payments
  drop column if exists pod_received,
  drop column if exists pod_received_date;

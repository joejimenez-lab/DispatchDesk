grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.drivers to authenticated;
grant select, insert, update, delete on table public.brokers to authenticated;
grant select, insert, update, delete on table public.loads to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.notes to authenticated;
grant select, insert on table public.activity_logs to authenticated;

grant usage on all sequences in schema public to authenticated;

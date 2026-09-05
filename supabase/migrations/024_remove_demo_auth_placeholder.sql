-- Remove the fictional audit-only row from Auth. It was inserted directly by
-- the demo seed and has no identity/provider, so it is not a login account.
-- Existing demo records remain intact; their Auth foreign keys use ON DELETE
-- SET NULL and retain the human-readable audit email.
delete from auth.users
where id = '10000000-0000-4000-8000-000000000001'
  and lower(email) = 'andres.castillo@dispatchdesk.demo'
  and not exists (
    select 1 from auth.identities
    where user_id = '10000000-0000-4000-8000-000000000001'
  );

-- Only the real hosted demo login is automatically attached to the fictional
-- demo organization. Every other real Auth user receives a clean workspace.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  target_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name);

  if exists (select 1 from public.organization_members where user_id = new.id) then
    return new;
  end if;

  if lower(new.email) = 'dispatchdesk123@maildrop.cc' then
    target_organization_id := '00000000-0000-4000-8000-000000000001';
  else
    target_organization_id := gen_random_uuid();
    target_name := coalesce(
      nullif(new.raw_user_meta_data ->> 'company_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      case
        when lower(new.email) = 'dcgemscorp@gmail.com' then 'DCG EMS Corp'
        else split_part(new.email, '@', 1)
      end,
      'Workspace'
    );

    insert into public.organizations (id, name)
    values (target_organization_id, target_name);
  end if;

  insert into public.organization_members (user_id, organization_id, role)
  values (new.id, target_organization_id, 'owner');

  return new;
end;
$$;

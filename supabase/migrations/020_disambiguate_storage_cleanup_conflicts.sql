-- PostgreSQL resolves output-column names as PL/pgSQL variables. Referencing the
-- named unique constraint avoids ambiguity with the table-returning functions'
-- bucket_id and storage_path output columns.

create or replace function public.delete_document_with_cleanup(p_document_id uuid)
returns table (
  job_id uuid,
  bucket_id text,
  storage_path text,
  load_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_row public.documents%rowtype;
  cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into document_row
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  insert into public.storage_cleanup_jobs (
    bucket_id, storage_path, source, load_id, document_id,
    last_error, last_attempted_at
  ) values (
    'load-documents', document_row.storage_path, 'delete_document',
    document_row.load_id, document_row.id, null, null
  )
  on conflict on constraint storage_cleanup_jobs_bucket_id_storage_path_key do update
  set source = excluded.source,
      load_id = excluded.load_id,
      document_id = excluded.document_id,
      last_error = null,
      last_attempted_at = null
  returning * into cleanup_job;

  delete from public.documents where id = document_row.id;
  insert into public.activity_logs (load_id, action)
  values (document_row.load_id, 'Document deleted');

  job_id := cleanup_job.id;
  bucket_id := cleanup_job.bucket_id;
  storage_path := cleanup_job.storage_path;
  load_id := document_row.load_id;
  return next;
end;
$$;

create or replace function public.delete_load_with_document_cleanup(p_load_id uuid)
returns table (
  job_id uuid,
  bucket_id text,
  storage_path text,
  load_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  document_row public.documents%rowtype;
  cleanup_job public.storage_cleanup_jobs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1 from public.loads where id = p_load_id for update;
  if not found then
    raise exception 'Load not found' using errcode = 'P0002';
  end if;

  for document_row in
    select d.* from public.documents d where d.load_id = p_load_id for update
  loop
    insert into public.storage_cleanup_jobs (
      bucket_id, storage_path, source, load_id, document_id,
      last_error, last_attempted_at
    ) values (
      'load-documents', document_row.storage_path, 'delete_load',
      document_row.load_id, document_row.id, null, null
    )
    on conflict on constraint storage_cleanup_jobs_bucket_id_storage_path_key do update
    set source = excluded.source,
        load_id = excluded.load_id,
        document_id = excluded.document_id,
        last_error = null,
        last_attempted_at = null
    returning * into cleanup_job;

    job_id := cleanup_job.id;
    bucket_id := cleanup_job.bucket_id;
    storage_path := cleanup_job.storage_path;
    load_id := document_row.load_id;
    return next;
  end loop;

  delete from public.loads where id = p_load_id;
end;
$$;

revoke all on function public.delete_document_with_cleanup(uuid) from public, anon;
revoke all on function public.delete_load_with_document_cleanup(uuid) from public, anon;
grant execute on function public.delete_document_with_cleanup(uuid) to authenticated;
grant execute on function public.delete_load_with_document_cleanup(uuid) to authenticated;

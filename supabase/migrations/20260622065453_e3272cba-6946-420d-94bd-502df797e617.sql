
create or replace function public.get_emails_for_ids(_ids uuid[])
returns table(id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any(_ids)
$$;

revoke all on function public.get_emails_for_ids(uuid[]) from public;
revoke all on function public.get_emails_for_ids(uuid[]) from anon;
revoke all on function public.get_emails_for_ids(uuid[]) from authenticated;
grant execute on function public.get_emails_for_ids(uuid[]) to service_role;

create or replace function public.get_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(_email)
  limit 1
$$;

revoke all on function public.get_user_id_by_email(text) from public;
revoke all on function public.get_user_id_by_email(text) from anon;
revoke all on function public.get_user_id_by_email(text) from authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

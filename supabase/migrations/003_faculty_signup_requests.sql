-- Record the account type requested during signup without granting faculty permissions.
alter table public.profiles
  add column if not exists requested_role text not null default 'student'
  check (requested_role in ('student', 'faculty'));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, requested_role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, new.phone, 'student'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), ''),
    case when new.raw_user_meta_data ->> 'requested_role' = 'faculty' then 'faculty' else 'student' end
  );
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

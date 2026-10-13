create or replace function public.is_quest_username_available(username_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    username_input is not null
    and lower(trim(username_input)) ~ '^[a-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.quest_profiles p
      where p.username = lower(trim(username_input))
    );
$$;

revoke all on function public.is_quest_username_available(text) from public;
grant execute on function public.is_quest_username_available(text) to anon, authenticated;

create or replace function public.create_quest_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  profile_username text;
  profile_display_name text;
begin
  requested_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));

  if requested_username ~ '^[a-z0-9_]{3,20}$' then
    profile_username := requested_username;
  else
    profile_username := left(
      'traveler_' || left(replace(new.id::text, '-', ''), 10),
      20
    );
  end if;

  profile_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if profile_display_name = '' then
    profile_display_name := profile_username;
  end if;
  profile_display_name := left(profile_display_name, 40);

  insert into public.quest_profiles (user_id, username, display_name)
  values (new.id, profile_username, profile_display_name);

  return new;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'QUEST_USERNAME_TAKEN';
end;
$$;

drop trigger if exists on_auth_user_created_create_quest_profile on auth.users;

create trigger on_auth_user_created_create_quest_profile
after insert on auth.users
for each row
execute function public.create_quest_profile_for_new_user();

insert into public.quest_profiles (user_id, username, display_name)
select
  u.id,
  left('traveler_' || left(replace(u.id::text, '-', ''), 10), 20),
  left(coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Traveler'), 40)
from auth.users u
where not exists (
  select 1 from public.quest_profiles p where p.user_id = u.id
)
on conflict (user_id) do nothing;

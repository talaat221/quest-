create table if not exists quest_private.api_rate_limits (
  actor_key text not null,
  action_key text not null,
  window_seconds integer not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (actor_key, action_key, window_seconds, window_start),
  constraint api_rate_limits_window_positive check (window_seconds > 0),
  constraint api_rate_limits_hits_nonnegative check (hit_count >= 0)
);

revoke all on table quest_private.api_rate_limits from public, anon, authenticated;

create or replace function quest_private.request_actor_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  headers_text text;
  headers jsonb;
  ip text;
begin
  if uid is not null then
    return 'user:' || uid::text;
  end if;
  headers_text := current_setting('request.headers', true);
  if headers_text is null or btrim(headers_text) = '' then return null; end if;
  begin
    headers := headers_text::jsonb;
  exception when others then
    return null;
  end;
  ip := split_part(coalesce(nullif(headers ->> 'cf-connecting-ip',''),nullif(headers ->> 'x-forwarded-for',''),nullif(headers ->> 'x-real-ip',''),''), ',', 1);
  ip := btrim(ip);
  if ip = '' then return null; end if;
  return 'ip:' || md5(ip);
end;
$$;

revoke all on function quest_private.request_actor_key() from public, anon, authenticated;

create or replace function quest_private.consume_api_rate_limit(
  p_actor_key text, p_action_key text, p_limit integer, p_window_seconds integer, p_cost integer default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  new_count integer;
begin
  if p_actor_key is null or btrim(p_actor_key) = '' then return; end if;
  if p_action_key is null or btrim(p_action_key) = '' then raise exception 'Invalid rate-limit action.'; end if;
  if p_limit < 1 or p_window_seconds < 1 or p_cost < 1 then raise exception 'Invalid rate-limit configuration.'; end if;

  bucket_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  insert into quest_private.api_rate_limits(actor_key, action_key, window_seconds, window_start, hit_count, updated_at)
  values (p_actor_key, p_action_key, p_window_seconds, bucket_start, p_cost, now())
  on conflict (actor_key, action_key, window_seconds, window_start)
  do update set hit_count = quest_private.api_rate_limits.hit_count + excluded.hit_count, updated_at = now()
  returning hit_count into new_count;

  if new_count > p_limit then
    raise exception 'QUEST_RATE_LIMIT:%', p_action_key using errcode = 'P0001';
  end if;

  delete from quest_private.api_rate_limits
  where actor_key = p_actor_key and action_key = p_action_key and window_start < now() - interval '2 days';
end;
$$;

revoke all on function quest_private.consume_api_rate_limit(text,text,integer,integer,integer) from public, anon, authenticated;

create or replace function public.rate_limit_quest_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if tg_op = 'INSERT' and new.status = 'pending' and me is not null then
    perform quest_private.consume_api_rate_limit('user:' || me::text, 'friend_request_hour', 20, 3600, 1);
    perform quest_private.consume_api_rate_limit('user:' || me::text, 'friend_request_day', 60, 86400, 1);
  end if;
  return new;
end;
$$;

revoke execute on function public.rate_limit_quest_friend_request() from public, anon, authenticated;

drop trigger if exists rate_limit_quest_friend_request on public.quest_friendships;
create trigger rate_limit_quest_friend_request
before insert on public.quest_friendships
for each row execute function public.rate_limit_quest_friend_request();

create or replace function public.rate_limit_quest_social_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare inviter uuid;
begin
  if new.status <> 'pending' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'pending' then return new; end if;
  inviter := new.invited_by;
  if inviter is null or inviter = new.user_id then return new; end if;

  perform quest_private.consume_api_rate_limit('user:' || inviter::text, 'social_invite_hour', 40, 3600, 1);
  perform quest_private.consume_api_rate_limit('user:' || inviter::text, 'social_invite_day', 100, 86400, 1);
  return new;
end;
$$;

revoke execute on function public.rate_limit_quest_social_invite() from public, anon, authenticated;

drop trigger if exists rate_limit_quest_contest_invite on public.quest_contest_members;
create trigger rate_limit_quest_contest_invite
before insert or update of status on public.quest_contest_members
for each row execute function public.rate_limit_quest_social_invite();

drop trigger if exists rate_limit_quest_challenge_invite on public.quest_challenge_members;
create trigger rate_limit_quest_challenge_invite
before insert or update of status on public.quest_challenge_members
for each row execute function public.rate_limit_quest_social_invite();

create or replace function public.search_quest_profiles(query_text text)
returns table(user_id uuid, username text, display_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); q text := btrim(coalesce(query_text, ''));
begin
  if me is null then raise exception 'Sign in to search Quest users.'; end if;
  if char_length(q) < 2 then return; end if;

  perform quest_private.consume_api_rate_limit('user:' || me::text, 'profile_search_minute', 60, 60, 1);
  perform quest_private.consume_api_rate_limit('user:' || me::text, 'profile_search_hour', 500, 3600, 1);

  return query
  select p.user_id, p.username, p.display_name
  from public.quest_profiles p
  where p.user_id <> me
    and not exists (
      select 1 from public.quest_user_blocks b
      where (b.blocker_id = me and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = me)
    )
    and (p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')
  order by case when p.username = lower(q) then 0 else 1 end, p.username
  limit 20;
end;
$$;

revoke execute on function public.search_quest_profiles(text) from public, anon;
grant execute on function public.search_quest_profiles(text) to authenticated;

create or replace function public.is_quest_username_available(username_input text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare clean_username text := lower(btrim(coalesce(username_input, ''))); actor text;
begin
  if clean_username !~ '^[a-z0-9_]{3,20}$' then return false; end if;

  actor := quest_private.request_actor_key();
  if actor is not null then
    perform quest_private.consume_api_rate_limit(actor, 'username_check_minute', 30, 60, 1);
    perform quest_private.consume_api_rate_limit(actor, 'username_check_hour', 300, 3600, 1);
  end if;

  return not exists (select 1 from public.quest_profiles p where p.username = clean_username);
end;
$$;

revoke execute on function public.is_quest_username_available(text) from public;
grant execute on function public.is_quest_username_available(text) to anon, authenticated;

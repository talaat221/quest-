create schema if not exists quest_private;
revoke all on schema quest_private from public, anon;
grant usage on schema quest_private to authenticated;

create table public.quest_farms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'My little farm' check (char_length(name) between 1 and 40),
  timezone text not null default 'UTC',
  started_day date not null,
  last_care_day date not null,
  baseline_xp bigint not null default 0,
  growth_xp bigint not null default 0,
  level integer not null default 1 check (level >= 1),
  opened_chests integer not null default 0 check (opened_chests >= 0),
  plants jsonb not null default '[]' check (jsonb_typeof(plants)='array'),
  discovered jsonb not null default '{}' check (jsonb_typeof(discovered)='object'),
  care_log jsonb not null default '[]',
  last_chest jsonb,
  updated_at timestamptz not null default now()
);
alter table public.quest_farms enable row level security;
create policy "Farm owner read" on public.quest_farms for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.quest_farms from anon, authenticated;
-- All writes and friend reads go through authenticated, narrowly shaped RPCs.

create function quest_private.farm_total_xp(p_user uuid) returns bigint
language sql stable set search_path='' as $$
  select greatest(0,coalesce((progression->>'legacyXP')::bigint,0))
    +coalesce((select sum(greatest(0,(value->>'creditedXp')::bigint)) from jsonb_each(coalesce(progression->'taskAwards','{}'))),0)
    +coalesce((select sum(greatest(0,(value->>'creditedXp')::bigint)) from jsonb_each(coalesce(progression->'anchorAwards','{}'))),0)
    +coalesce((select sum(greatest(0,value::text::bigint)) from jsonb_each(coalesce(progression->'weeklyBonuses','{}'))),0)
  from public.quest_settings where user_id=p_user
$$;

create function quest_private.farm_care(p_user uuid,p_day date) returns jsonb
language sql stable set search_path='' as $$
  with counts as (
    select (select count(*) from jsonb_each(coalesce(s.progression->'taskAwards','{}')) a where a.value->>'dayKey'=p_day::text) tasks,
      (select count(*) from public.anchor_history h where h.user_id=p_user and h.day=p_day) anchors,
      exists(select 1 from public.voyage_adjustments v where v.user_id=p_user and v.day=p_day and v.mode='harbor') protected
    from public.quest_settings s where s.user_id=p_user
  ) select jsonb_build_object('tasks',tasks,'anchors',anchors,'protected',protected,'cared',tasks>=1 or anchors>=3 or protected) from counts
$$;

create function quest_private.farm_allowed(p_target uuid) returns boolean
language sql stable set search_path='' as $$
 select auth.uid() is not null and (p_target=auth.uid()
   or exists(select 1 from public.quest_friendships f where f.status='accepted'
     and ((f.requester_id=auth.uid() and f.addressee_id=p_target) or (f.addressee_id=auth.uid() and f.requester_id=p_target)))
   or exists(select 1 from public.quest_contest_members me join public.quest_contest_members them on me.contest_id=them.contest_id
     where me.user_id=auth.uid() and them.user_id=p_target and me.status='accepted' and them.status='accepted'))
$$;

create function quest_private.farm_refresh(p_user uuid) returns void
language plpgsql set search_path='' as $$
declare f public.quest_farms; d date; today date; reset_hour integer; care jsonb; victim jsonb; idx integer; log jsonb;
begin
  select * into f from public.quest_farms where user_id=p_user for update;
  if not found then return; end if;
  select coalesce(day_reset_hour,0) into reset_hour from public.quest_settings where user_id=p_user;
  today:=((now() at time zone f.timezone)-make_interval(hours=>coalesce(reset_hour,0)))::date;
  -- Never charge the welcome day or the current, unfinished quest day.
  d:=f.last_care_day+1;
  while d<today loop
    care:=coalesce(quest_private.farm_care(p_user,d),'{}');
    if not coalesce((care->>'cared')::boolean,false) and jsonb_array_length(f.plants)>0 then
      idx:=floor(random()*jsonb_array_length(f.plants))::integer;
      victim:=f.plants->idx;
      f.plants:=f.plants-idx;
      f.care_log:=f.care_log||jsonb_build_array(jsonb_build_object('day',d,'kind','lost','species',victim->>'species','plantId',victim->>'id'));
    end if;
    d:=d+1;
  end loop;
  select coalesce(jsonb_agg(value order by ord),'[]') into log
    from jsonb_array_elements(f.care_log) with ordinality t(value,ord)
    where ord>jsonb_array_length(f.care_log)-30;
  update public.quest_farms set plants=f.plants,care_log=log,last_care_day=greatest(last_care_day,today-1),
    growth_xp=greatest(growth_xp,coalesce(quest_private.farm_total_xp(p_user),0)-baseline_xp),updated_at=now()
    where user_id=p_user;
end $$;

create function quest_private.farm_snapshot(p_user uuid,p_owner boolean) returns jsonb
language plpgsql stable set search_path='' as $$
declare f public.quest_farms; today date; reset_hour integer; earned bigint; owner_name text; result jsonb;
begin
  select * into f from public.quest_farms where user_id=p_user;
  if not found then return null; end if;
  select coalesce(day_reset_hour,0) into reset_hour from public.quest_settings where user_id=p_user;
  today:=((now() at time zone f.timezone)-make_interval(hours=>coalesce(reset_hour,0)))::date;
  earned:=greatest(0,coalesce(quest_private.farm_total_xp(p_user),0)-f.baseline_xp);
  select coalesce(nullif(display_name,''),username) into owner_name from public.quest_profiles where user_id=p_user;
  result:=jsonb_build_object('userId',p_user,'ownerName',coalesce(owner_name,'Traveler'),'name',f.name,'level',f.level,
    'plants',f.plants,'discovered',f.discovered,'growthXP',f.growth_xp,'updatedAt',f.updated_at);
  if p_owner then
    result:=result||jsonb_build_object('earnedXP',earned,'openedChests',f.opened_chests,
      'readyChests',greatest(0,earned/100-f.opened_chests),'nextChestXP',(f.opened_chests+1)*100,
      'today',today,'care',coalesce(quest_private.farm_care(p_user,today),'{}')||jsonb_build_object('welcome',today=f.started_day),
      'careLog',f.care_log,'lastChest',f.last_chest,'timezone',f.timezone);
  end if;
  return result;
end $$;

create function quest_private.farm_command(p_action text,p_target uuid default null,p_name text default null,p_chest integer default null,p_timezone text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; f public.quest_farms; today date; reset_hour integer; earned bigint; roll integer; species text; rarity text; plant jsonb; tz text;
begin
  if uid is null then raise exception 'Sign in to visit a farm' using errcode='42501'; end if;
  target:=coalesce(p_target,uid);
  if p_action not in ('read','rename','open') then raise exception 'Unknown farm action'; end if;
  if not quest_private.farm_allowed(target) then raise exception 'This farm is only visible to its owner, friends, and league members' using errcode='42501'; end if;
  if p_action<>'read' and target<>uid then raise exception 'Only the owner can change a farm' using errcode='42501'; end if;
  -- Match account sync lock order so reset, task saves and chest opens serialize.
  perform 1 from public.quest_sync_meta where user_id=target for update;
  if target=uid then
    select name into tz from pg_timezone_names where name=p_timezone;
    tz:=coalesce(tz,'UTC');
    select coalesce(day_reset_hour,0) into reset_hour from public.quest_settings where user_id=uid;
    today:=((now() at time zone tz)-make_interval(hours=>coalesce(reset_hour,0)))::date;
    insert into public.quest_farms(user_id,timezone,started_day,last_care_day,baseline_xp,plants,discovered)
    values(uid,tz,today,today,coalesce(quest_private.farm_total_xp(uid),0),
      jsonb_build_array(jsonb_build_object('id','starter','species','carrot','plantedXP',0,'day',today)),
      jsonb_build_object('carrot',1)) on conflict(user_id) do nothing;
  end if;
  perform quest_private.farm_refresh(target);
  select * into f from public.quest_farms where user_id=target for update;
  if not found then return null; end if;
  if p_action='rename' then
    if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'Choose a farm name from 1 to 40 characters'; end if;
    update public.quest_farms set name=btrim(p_name),updated_at=now() where user_id=uid;
  elsif p_action='open' then
    -- Explicit sequence number makes retrying a request idempotent.
    if p_chest=f.opened_chests and f.last_chest is not null then return quest_private.farm_snapshot(uid,true); end if;
    if p_chest is null or p_chest<>f.opened_chests+1 then raise exception 'The chest changed. Refresh your farm.'; end if;
    earned:=greatest(0,coalesce(quest_private.farm_total_xp(uid),0)-f.baseline_xp);
    if earned<p_chest*100 then raise exception 'Earn more XP to open this chest'; end if;
    roll:=floor(random()*100)::integer;
    if p_chest%10=0 or roll>=98 then
      rarity:='legendary';species:=(array['golden-apple','starflower'])[1+floor(random()*2)::integer];
    elsif p_chest%5=0 or roll>=88 then
      rarity:='rare';species:=(array['moon-lily','crystal-lotus'])[1+floor(random()*2)::integer];
    elsif roll>=60 then
      rarity:='uncommon';species:=(array['blueberry','sunflower','lavender','peach'])[1+floor(random()*4)::integer];
    else
      rarity:='common';species:=(array['carrot','strawberry','pumpkin','tomato'])[1+floor(random()*4)::integer];
    end if;
    plant:=jsonb_build_object('id','chest-'||p_chest,'species',species,'plantedXP',f.growth_xp,
      'day',((now() at time zone f.timezone)-make_interval(hours=>coalesce(reset_hour,0)))::date);
    f.plants:=f.plants||jsonb_build_array(plant);
    update public.quest_farms set plants=f.plants,opened_chests=p_chest,
      discovered=jsonb_set(f.discovered,array[species],to_jsonb(coalesce((f.discovered->>species)::integer,0)+1)),
      level=greatest(f.level,1+jsonb_array_length(f.plants)/10),
      last_chest=jsonb_build_object('number',p_chest,'species',species,'rarity',rarity,'openedAt',now()),updated_at=now()
      where user_id=uid;
  end if;
  return quest_private.farm_snapshot(target,target=uid);
end $$;

create function quest_private.farm_summaries(p_user_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]'; target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if coalesce(array_length(p_user_ids,1),0)>100 then raise exception 'Too many farms'; end if;
 for target in select distinct unnest(p_user_ids) loop
   if quest_private.farm_allowed(target) then
     -- Summaries expose only the saved display snapshot. A visit refreshes care.
     if exists(select 1 from public.quest_farms where user_id=target) then
       result:=result||jsonb_build_array(quest_private.farm_snapshot(target,false));
     end if;
   end if;
 end loop;
 return result;
end $$;

create function public.quest_farm(p_action text default 'read',p_target uuid default null,p_name text default null,p_chest integer default null,p_timezone text default null) returns jsonb
language sql security invoker set search_path='' as $$
 select quest_private.farm_command(p_action,p_target,p_name,p_chest,p_timezone)
$$;
create function public.get_quest_farms(p_user_ids uuid[]) returns jsonb
language sql security invoker set search_path='' as $$ select quest_private.farm_summaries(p_user_ids) $$;

create function quest_private.reset_farm_with_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.last_reset_revision is distinct from old.last_reset_revision then
   delete from public.quest_farms where user_id=new.user_id;
 end if;
 return new;
end $$;
create trigger quest_farm_account_reset after update of last_reset_revision on public.quest_sync_meta
for each row execute function quest_private.reset_farm_with_account();

revoke all on all functions in schema quest_private from public,anon,authenticated;
grant execute on function quest_private.farm_command(text,uuid,text,integer,text),quest_private.farm_summaries(uuid[]) to authenticated;
revoke all on function public.quest_farm(text,uuid,text,integer,text),public.get_quest_farms(uuid[]) from public,anon;
grant execute on function public.quest_farm(text,uuid,text,integer,text),public.get_quest_farms(uuid[]) to authenticated;

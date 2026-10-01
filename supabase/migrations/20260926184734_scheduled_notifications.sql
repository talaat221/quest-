-- Notification delivery is opt-in per browser/device. Existing accounts are not subscribed.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.quest_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  subscription jsonb not null,
  origin text not null,
  timezone text not null default 'UTC',
  preferences jsonb not null default '{"anchors":true,"tasks":true,"timers":true,"review":false,"reviewHour":21}',
  enabled_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index quest_push_subscriptions_user_idx on public.quest_push_subscriptions(user_id);
alter table public.quest_push_subscriptions enable row level security;
revoke all on public.quest_push_subscriptions from anon, authenticated;
grant select on public.quest_push_subscriptions to authenticated;
grant all on public.quest_push_subscriptions to service_role;
create policy "Read own notification devices" on public.quest_push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);

create table public.quest_push_deliveries (
  subscription_id uuid not null references public.quest_push_subscriptions(id) on delete cascade,
  event_key text not null,
  state text not null check (state in ('sending','sent','failed')),
  attempts integer not null default 1,
  touched_at timestamptz not null default now(),
  primary key (subscription_id, event_key)
);
alter table public.quest_push_deliveries enable row level security;
revoke all on public.quest_push_deliveries from anon, authenticated;
grant all on public.quest_push_deliveries to service_role;

create or replace function public.claim_quest_push(p_subscription uuid, p_key text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare acquired boolean;
begin
  insert into public.quest_push_deliveries(subscription_id,event_key,state)
  values(p_subscription,p_key,'sending')
  on conflict(subscription_id,event_key) do update set state='sending', attempts=quest_push_deliveries.attempts+1, touched_at=now()
  where quest_push_deliveries.state <> 'sent' and quest_push_deliveries.attempts < 3 and quest_push_deliveries.touched_at < now()-interval '45 seconds'
  returning true into acquired;
  return coalesce(acquired,false);
end $$;
revoke all on function public.claim_quest_push(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_quest_push(uuid,text) to service_role;

-- A private helper holds the only privileged Vault access. Its public API is
-- SECURITY INVOKER and executable only by the server's service role.
create or replace function private.quest_push_secrets(p_keys jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare vapid jsonb; scheduler text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Server only'; end if;
  perform pg_advisory_xact_lock(hashtext('quest-push-vapid'));
  select decrypted_secret::jsonb into vapid from vault.decrypted_secrets where name='quest_push_vapid';
  if vapid is null and p_keys is not null then
    if length(p_keys->>'publicKey') <> 87 or length(p_keys->>'privateKey') <> 43 then raise exception 'Invalid keys'; end if;
    perform vault.create_secret(p_keys::text,'quest_push_vapid','Quest Web Push signing keys');
    vapid := p_keys;
  end if;
  select decrypted_secret into scheduler from vault.decrypted_secrets where name='quest_push_scheduler';
  return jsonb_build_object('vapid',vapid,'scheduler',scheduler);
end $$;
revoke all on function private.quest_push_secrets(jsonb) from public, anon, authenticated;
grant execute on function private.quest_push_secrets(jsonb) to service_role;
create or replace function public.get_quest_push_secrets(p_keys jsonb default null)
returns jsonb language sql security invoker set search_path = '' as $$ select private.quest_push_secrets(p_keys); $$;
revoke all on function public.get_quest_push_secrets(jsonb) from public, anon, authenticated;
grant execute on function public.get_quest_push_secrets(jsonb) to service_role;

-- The existing snapshot builder is used only by the service role here.
create or replace function public.get_quest_push_state(p_user_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select public.build_quest_state_for_user(p_user_id); $$;
revoke all on function public.get_quest_push_state(uuid) from public, anon, authenticated;
grant execute on function public.get_quest_push_state(uuid) to service_role;
grant execute on function public.build_quest_state_for_user(uuid) to service_role;

do $$ begin
  if not exists(select 1 from vault.secrets where name='quest_push_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'quest_push_scheduler','Authenticates the Quest notification scheduler');
  end if;
end $$;
create or replace function private.run_quest_notifications()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare request_id bigint;
begin
  -- No Edge Function invocations until a person enables notifications.
  if not exists(select 1 from public.quest_push_subscriptions where last_seen_at > now()-interval '30 days') then return null; end if;
  select net.http_post(
    url := 'https://nagxpuqdurdcogzudblo.supabase.co/functions/v1/quest-notifications',
    headers := jsonb_build_object('Content-Type','application/json','x-quest-scheduler',(select decrypted_secret from vault.decrypted_secrets where name='quest_push_scheduler')),
    body := '{"action":"dispatch"}'::jsonb,
    timeout_milliseconds := 10000
  ) into request_id;
  return request_id;
end $$;
revoke all on function private.run_quest_notifications() from public, anon, authenticated, service_role;
select cron.schedule('quest-notifications','15 seconds','select private.run_quest_notifications()');
select cron.schedule('quest-notifications-cleanup','15 3 * * *',$$delete from public.quest_push_deliveries where touched_at < now()-interval '7 days'; delete from public.quest_push_subscriptions where last_seen_at < now()-interval '30 days';$$);

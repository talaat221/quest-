-- Only the authenticated Edge Function may manage this short display lease.
-- No change to subscription RLS/grants; clients cannot write this table directly.
alter table public.quest_push_subscriptions
  add column if not exists popup_active_until timestamptz,
  add column if not exists popup_owner uuid;

comment on column public.quest_push_subscriptions.popup_active_until is
  '30-second foreground popup lease. Expiry restores native push if the page/window closes or disconnects.';

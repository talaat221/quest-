-- Balanced XP / level progression state.
-- Production already has this migration version applied; keeping the source
-- migration in Git makes fresh environments match production.

alter table public.quest_settings
  add column if not exists progression jsonb not null default '{}'::jsonb;

comment on column public.quest_settings.progression is
  'Persistent Quest progression ledger/settings used by balanced XP, levels, and future social challenge stats.';

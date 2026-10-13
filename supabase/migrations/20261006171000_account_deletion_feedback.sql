create table if not exists public.quest_account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  reason_code text not null check (
    reason_code in (
      'no_longer_need',
      'not_useful',
      'hard_to_use',
      'missing_features',
      'bugs_performance',
      'privacy_concerns',
      'other',
      'prefer_not_to_say'
    )
  ),
  reason_text text null check (char_length(reason_text) <= 500),
  privacy_notice_version text not null default '2026-10-06',
  created_at timestamptz not null default now()
);

alter table public.quest_account_deletion_feedback enable row level security;

revoke all on table public.quest_account_deletion_feedback from public, anon, authenticated;

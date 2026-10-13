-- Competition totals are derived by trusted triggers/RPCs.
-- Signed-in clients may read permitted rows but cannot directly forge scores.
revoke insert, update, delete on table public.quest_competition_stats from authenticated;

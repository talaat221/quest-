# Living farm preview

This work builds on `feature/competition-garden` at `7320d88`. GitHub was checked again on October 12, 2026; no newer frontend was available there. Keep this branch as a preview and merge these changes into the user's latest local project before promoting production. The newer Supabase account-blocking rules are respected.

## Experience

- Home's miniature farm opens `#farm`; More also links to it.
- A farm begins with one carrot seedling. Every 100 new XP after initialization unlocks a seed chest. Opening it plants a collectible immediately. Existing level XP is neither spent nor retroactively converted into plants.
- There are 12 species. Normal chest odds are 60% common, 28% uncommon, 10% rare and 2% legendary. Every fifth chest guarantees rare or better; every tenth guarantees legendary. Duplicate plants count toward filling a field.
- Each plant grows at 30 XP and blooms at 70 XP earned after planting. Ten living plants unlock the next ten-plot field. Discoveries, titles and unlocked fields survive plant loss.
- Complete one quest task or three anchors per quest day to protect all plants. Each missed closed day removes one random living plant. Welcome day and Stop Day are protected. Care uses the saved farm timezone and the account's daily reset hour.
- Farm names are editable. Accepted friends and accepted members of a shared, non-cancelled competition can visit a display-only garden. Rare/legendary discoveries grant a title below the owner's name. Blocks in either direction deny both visits and summary cards.

The landscape and plant atlas are generated WebP artwork in `public/farm-v1`. Live plant positions, growth stages, collection information and controls are rendered on those assets. Existing image-based blue/bronze frames are reused. No canvas screenshot is used as a substitute for working controls.

## Data and sync

`quest_farms` has RLS and no direct client writes. Authenticated RPCs call narrowly scoped functions in `quest_private`. Only the owner can rename or open chests; visitors receive no care history, pending chest balance or task details.

Task saves finish before farm reads/actions. Request IDs and account guards prevent older reads from replacing newer state. Read-only sync events do not trigger a polling loop. Farm refresh also runs once a minute and when returning to the app.

Explicit chest sequence numbers and the sync/farm row locks make retries idempotent. Undo/redo at the same XP milestone cannot open another chest. Growth uses an XP high-water mark so an undo does not visually shrink plants. Account restart clears the farm; the next load starts fresh.

Care is evaluated when the farm is read or visited, rather than by a background cron. This means an unopened farm's display snapshot may remain stale until its next refresh. Summary cards use the saved snapshot; an actual visit refreshes care. Offline completions need to sync before the server can count them for care.

Applied database migrations, recorded with their actual remote versions:

- `20261006005103_living_farm_collection_and_care`
- `20261011155024_farm_visits_respect_account_blocks`

Do not reapply them to the existing project. The second migration also tolerates older installations without the social-blocking table. Database security tests for blocks require the later social-blocking migrations.

## Validation

- Production build passed; the pre-existing large-bundle warning remains.
- 42 focused Node checks passed for farm helpers, advice, XP, planning, progression and home tasks.
- `tests/farm-database.sql` passed against the connected database inside a rolled-back fixture transaction. Covered starter/baseline XP, ten chests, rarity guarantees, duplicate requests, undo/redo, field unlock, daily care, reset timezone, Stop Day, visitor write denial, friendship/league membership, bidirectional blocks, cancelled leagues and account restart.
- Browser checks rendered the actual React dashboard with isolated account/API fixtures: task creation, weekly preview/apply/reload, XP and level rollover, anchor duration/completion, farm care, chest opening, rename/reload, rare title and read-only friend visit. No page errors; layouts fit 320, 393 and 430px.
- Home advice → expanded review → weekly planner → close passed at 320 and 393px. The compact advice's bottom edge stays above the first home task row.
- The browser used mocked account/API responses; the real database was tested separately. An authenticated live-device check is still needed before promoting the preview.
- Supabase's security advisor reported no farm-specific findings. Existing unrelated RPC/Auth findings were not changed as part of this feature.

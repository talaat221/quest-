import { createClient } from "@supabase/supabase-js";
import { isEmptyQuestAccount } from "./account-reset.js";

const supabaseUrl = "https://nagxpuqdurdcogzudblo.supabase.co";
const supabaseAnonKey = "sb_publishable_fD34vhaeM1pyxWo8OcfZrA_ycEYnpT-";

const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);

const CACHE_PREFIX = "quest-offline-v3:";
const LEGACY_CACHE_PREFIXES = ["quest-offline-v2:", "quest-offline-v1:"];
const SYNC_EVENT = "quest-sync-status";
const ACCOUNT_RESET_EVENT = "quest-account-reset";

type QuestSyncState = "synced" | "syncing" | "offline" | "pending" | "conflict";

export type QuestSyncSnapshot = {
  state: QuestSyncState;
  pending: number;
  lastSyncedAt: string | null;
  message: string;
};

type ConflictRecord = {
  remoteData: any;
  remoteUpdatedAt: string | null;
  remoteRevision: number | null;
};

type QuestCacheRecord = {
  data: any;
  dirty: boolean;
  baseData: any | null;
  baseUpdatedAt: string | null;
  baseHash: string | null;
  baseRevision: number | null;
  serverKnownMissing: boolean;
  lastSyncedAt: string | null;
  cachedAt: string;
  localRevision: number;
  pendingEdits: number;
  conflict: ConflictRecord | null;
  resetRevision?: number;
};

type CloudState = {
  data: any | null;
  updatedAt: string | null;
  baseHash: string | null;
  revision: number | null;
  legacyExists: boolean;
  source: "normalized" | "legacy" | "none";
  error: any | null;
  resetRevision: number;
};

let syncSnapshot: QuestSyncSnapshot = {
  state:
    typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline"
      : "synced",
  pending: 0,
  lastSyncedAt: null,
  message: "Quest is synced.",
};

const syncLocks = new Map<string, Promise<void>>();
const resettingUsers = new Set<string>();
const observedResetRevisions = new Map<string, number>();
let activeQuestUserId: string | null = null;

const nowISO = () => new Date().toISOString();
const cacheKey = (userId: string) => `${CACHE_PREFIX}${userId}`;

const stateHash = (data: any) => {
  try {
    return JSON.stringify(data ?? null);
  } catch {
    return null;
  }
};

const same = (a: any, b: any) => stateHash(a) === stateHash(b);

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const normalizeCacheRecord = (record: any): QuestCacheRecord => ({
  data: record?.data ?? null,
  dirty: !!record?.dirty,
  baseData: record?.baseData ?? null,
  baseUpdatedAt: record?.baseUpdatedAt ?? null,
  baseHash: record?.baseHash ?? null,
  baseRevision:
    Number.isFinite(Number(record?.baseRevision)) ? Number(record.baseRevision) : null,
  serverKnownMissing: !!record?.serverKnownMissing,
  lastSyncedAt: record?.lastSyncedAt ?? null,
  cachedAt: record?.cachedAt || nowISO(),
  localRevision: Number(record?.localRevision) || 0,
  pendingEdits: Number(record?.pendingEdits) || 0,
  resetRevision: Number(record?.resetRevision) || 0,
  conflict: record?.conflict
    ? {
        remoteData: record.conflict.remoteData,
        remoteUpdatedAt: record.conflict.remoteUpdatedAt || null,
        remoteRevision:
          Number.isFinite(Number(record.conflict.remoteRevision))
            ? Number(record.conflict.remoteRevision)
            : null,
      }
    : null,
});

const readCache = (userId: string): QuestCacheRecord | null => {
  if (typeof localStorage === "undefined") return null;

  try {
    let raw = localStorage.getItem(cacheKey(userId));

    if (!raw) {
      for (const prefix of LEGACY_CACHE_PREFIXES) {
        const legacy = localStorage.getItem(`${prefix}${userId}`);
        if (legacy) {
          raw = legacy;
          localStorage.setItem(cacheKey(userId), legacy);
          break;
        }
      }
    }

    return raw ? normalizeCacheRecord(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn("Quest offline cache could not be read:", error);
    return null;
  }
};

const writeCache = (userId: string, record: QuestCacheRecord) => {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(record));
  } catch (error) {
    console.warn("Quest offline cache could not be written:", error);
  }
};

const pendingCount = () => {
  if (typeof localStorage === "undefined") return 0;

  let count = 0;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;

    try {
      const record = normalizeCacheRecord(
        JSON.parse(localStorage.getItem(key) || "null")
      );
      if (record?.dirty) {
        count += Math.max(1, Number(record.pendingEdits) || 1);
      }
    } catch {
      // Ignore malformed stale entries.
    }
  }
  return count;
};

const emitSync = (patch: Partial<QuestSyncSnapshot>) => {
  syncSnapshot = {
    ...syncSnapshot,
    ...patch,
    pending: patch.pending ?? pendingCount(),
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, {
        detail: syncSnapshot,
      })
    );
  }
};

export const getQuestSyncSnapshot = () => ({ ...syncSnapshot });

export const subscribeQuestSync = (
  callback: (snapshot: QuestSyncSnapshot) => void
) => {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    callback((event as CustomEvent<QuestSyncSnapshot>).detail);
  };

  window.addEventListener(SYNC_EVENT, handler);
  callback(getQuestSyncSnapshot());

  return () => window.removeEventListener(SYNC_EVENT, handler);
};

export const subscribeQuestAccountReset = (
  callback: (reset: { userId: string; data: any }) => void
) => {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => callback((event as CustomEvent).detail);
  window.addEventListener(ACCOUNT_RESET_EVENT, handler);
  return () => window.removeEventListener(ACCOUNT_RESET_EVENT, handler);
};

const notifyAccountReset = (userId: string, record: QuestCacheRecord) => {
  observedResetRevisions.set(userId, record.resetRevision || 0);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCOUNT_RESET_EVENT, {
      detail: { userId, data: record.data },
    }));
  }
};

const adoptResetSnapshot = (userId: string, cloud: CloudState) => {
  const previous = readCache(userId);
  if (previous?.baseRevision != null && cloud.revision != null &&
      previous.baseRevision > cloud.revision) return;
  const record: QuestCacheRecord = {
    data: cloud.data, dirty: false, baseData: cloud.data,
    baseUpdatedAt: cloud.updatedAt, baseHash: stateHash(cloud.data),
    baseRevision: cloud.revision, serverKnownMissing: false,
    lastSyncedAt: cloud.updatedAt || nowISO(), cachedAt: nowISO(),
    localRevision: (previous?.localRevision || 0) + 1,
    pendingEdits: 0, conflict: null, resetRevision: cloud.resetRevision,
  };
  // Publish the new generation together with its data before notifying any UI.
  writeCache(userId, record);
  if (typeof localStorage !== "undefined") {
    for (const prefix of LEGACY_CACHE_PREFIXES) {
      try { localStorage.removeItem(`${prefix}${userId}`); } catch { /* Storage may be unavailable. */ }
    }
  }
  notifyAccountReset(userId, record);
  emitSync({ state: "synced", pending: pendingCount(), lastSyncedAt: record.lastSyncedAt,
    message: "Account restarted. Your fresh start is saved." });
};

const sortedIds = (items: any[]) =>
  items
    .map((item) => String(item?.id || ""))
    .filter(Boolean)
    .sort();

const sameStringArray = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const taskIds = (state: any) =>
  sortedIds(
    (Array.isArray(state?.domains) ? state.domains : []).flatMap((domain: any) =>
      Array.isArray(domain?.tasks) ? domain.tasks : []
    )
  );

const normalizedLooksComplete = (normalized: any, legacy: any) => {
  if (!normalized || typeof normalized !== "object") return false;
  if (!Array.isArray(normalized.domains) || !Array.isArray(normalized.anchors)) {
    return false;
  }

  if (!legacy || typeof legacy !== "object") return true;

  const legacyDomains = Array.isArray(legacy.domains) ? legacy.domains : [];
  const normalizedDomains = Array.isArray(normalized.domains) ? normalized.domains : [];
  const legacyAnchors = Array.isArray(legacy.anchors) ? legacy.anchors : [];
  const normalizedAnchors = Array.isArray(normalized.anchors) ? normalized.anchors : [];

  if (!sameStringArray(sortedIds(legacyDomains), sortedIds(normalizedDomains))) return false;
  if (!sameStringArray(sortedIds(legacyAnchors), sortedIds(normalizedAnchors))) return false;
  if (!sameStringArray(taskIds(legacy), taskIds(normalized))) return false;

  const legacyDaily = Array.isArray(legacy?.rewards?.daily) ? legacy.rewards.daily.length : 0;
  const newDaily = Array.isArray(normalized?.rewards?.daily) ? normalized.rewards.daily.length : 0;
  const legacyWeekly = Array.isArray(legacy?.rewards?.weekly) ? legacy.rewards.weekly.length : 0;
  const newWeekly = Array.isArray(normalized?.rewards?.weekly) ? normalized.rewards.weekly.length : 0;

  return legacyDaily === newDaily && legacyWeekly === newWeekly;
};

const fetchLegacyRow = async (userId: string) =>
  rawSupabase
    .from("quest_data")
    .select("data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

const fetchNormalizedSnapshot = async () =>
  rawSupabase.rpc("get_my_quest_snapshot");

const fetchCloudState = async (userId: string): Promise<CloudState> => {
  const [legacyResult, normalizedResult] = await Promise.all([
    fetchLegacyRow(userId),
    fetchNormalizedSnapshot(),
  ]);

  const legacy = legacyResult.data;
  const snapshot: any = normalizedResult.data;
  const normalized = snapshot?.data ?? null;
  const resetRevision = Number(snapshot?.resetRevision) || 0;
  const snapshotRevision = Number(snapshot?.revision);
  const revision = Number.isFinite(snapshotRevision) ? snapshotRevision : null;
  const snapshotUpdatedAt = snapshot?.updatedAt
    ? String(snapshot.updatedAt)
    : null;

  if (
    !normalizedResult.error &&
    (normalizedLooksComplete(normalized, legacy?.data) ||
      (resetRevision > 0 && normalizedLooksComplete(normalized, null) &&
        !!snapshotUpdatedAt && (!legacy?.updated_at ||
          Date.parse(snapshotUpdatedAt) >= Date.parse(legacy.updated_at))))
  ) {
    return {
      data: normalized,
      updatedAt: snapshotUpdatedAt || legacy?.updated_at || null,
      baseHash: stateHash(normalized),
      revision,
      legacyExists: !!legacy,
      source: "normalized",
      error: null,
      resetRevision,
    };
  }

  if (legacy) {
    if (normalizedResult.error) {
      console.warn(
        "Quest normalized read unavailable; using legacy cloud row.",
        normalizedResult.error
      );
    } else {
      console.warn("Quest normalized read failed parity checks; using legacy cloud row.");
    }

    return {
      data: legacy.data,
      updatedAt: legacy.updated_at || null,
      baseHash: stateHash(legacy.data),
      revision,
      legacyExists: true,
      source: "legacy",
      error: null,
      resetRevision,
    };
  }

  if (!normalizedResult.error && normalized) {
    return {
      data: normalized,
      updatedAt: snapshotUpdatedAt,
      baseHash: stateHash(normalized),
      revision,
      legacyExists: false,
      source: "normalized",
      error: null,
      resetRevision,
    };
  }

  return {
    data: null,
    updatedAt: null,
    baseHash: null,
    revision,
    legacyExists: false,
    source: "none",
    error: legacyResult.error || normalizedResult.error || null,
    resetRevision,
  };
};

const mapById = (items: any[]) =>
  new Map(
    items
      .filter((item) => item?.id != null)
      .map((item) => [String(item.id), item] as const)
  );

const questShells = (state: any) =>
  (Array.isArray(state?.domains) ? state.domains : []).map(
    (domain: any, index: number) => ({
      id: String(domain?.id || ""),
      name: domain?.name ?? "Untitled Quest",
      emoji: domain?.emoji ?? null,
      color: domain?.color ?? null,
      monthlyTarget: Number(domain?.monthlyTarget) || 1,
      timingProfiles: domain?.timingProfiles || {},
      sortOrder: index,
    })
  );

const flatTasks = (state: any) =>
  (Array.isArray(state?.domains) ? state.domains : []).flatMap(
    (domain: any) =>
      (Array.isArray(domain?.tasks) ? domain.tasks : []).map(
        (task: any, index: number) => ({
          id: String(task?.id || ""),
          questId: String(domain?.id || ""),
          name: task?.name ?? "Untitled Task",
          xp: Number(task?.xp) || 10,
          day: task?.day || null,
          hour: task?.hour ?? null,
          estimatedMinutes: task?.estimatedMinutes ?? null,
          actualMinutes: task?.actualMinutes ?? null,
          timingProfileKey: task?.timingProfileKey || null,
          flexibility: task?.flexibility === "fixed" ? "fixed" : "flexible",
          done: !!task?.done,
          doneAt: task?.doneAt || null,
          sortOrder: index,
        })
      )
  );

const anchorShells = (state: any) =>
  (Array.isArray(state?.anchors) ? state.anchors : []).map(
    (anchor: any, index: number) => ({
      id: String(anchor?.id || ""),
      name: anchor?.name ?? "Untitled Anchor",
      emoji: anchor?.emoji ?? null,
      xpPerDay: Number(anchor?.xpPerDay) || 1,
      category: anchor?.category || "General",
      activeWeekdays:
        Array.isArray(anchor?.activeWeekdays) && anchor.activeWeekdays.length
          ? anchor.activeWeekdays
          : [1, 2, 3, 4, 5, 6, 7],
      hour: anchor?.hour ?? null,
      sortOrder: index,
    })
  );

const anchorHistoryMap = (state: any) => {
  const map = new Map<string, any>();
  for (const anchor of Array.isArray(state?.anchors) ? state.anchors : []) {
    const history = anchor?.history && typeof anchor.history === "object"
      ? anchor.history
      : {};
    for (const [day, completed] of Object.entries(history)) {
      if (completed) {
        map.set(`${anchor.id}::${day}`, {
          anchorId: String(anchor.id),
          day,
        });
      }
    }
  }
  return map;
};

const flattenClaims = (claimed: any) => {
  const result: any[] = [];
  for (const kind of ["daily", "weekly"]) {
    const obj = claimed?.[kind] && typeof claimed[kind] === "object"
      ? claimed[kind]
      : {};
    for (const [periodKey, rewardText] of Object.entries(obj)) {
      result.push({ kind, periodKey, rewardText: String(rewardText ?? "") });
    }
  }
  return result;
};

const voyageMap = (state: any) => {
  const source =
    state?.voyageAdjustments && typeof state.voyageAdjustments === "object"
      ? state.voyageAdjustments
      : {};
  return new Map(
    Object.entries(source).map(([day, value]: [string, any]) => [
      day,
      { day, ...(value || {}) },
    ])
  );
};

const changedUpserts = (oldItems: any[], newItems: any[]) => {
  const oldMap = mapById(oldItems);
  return newItems.filter((item) => !same(oldMap.get(String(item.id)), item));
};

const deletedIds = (oldItems: any[], newItems: any[]) => {
  const newMap = mapById(newItems);
  return oldItems
    .map((item) => String(item.id))
    .filter((id) => id && !newMap.has(id));
};

const buildNormalizedChanges = (baseState: any, nextState: any) => {
  const base = baseState || {};
  const next = nextState || {};
  const changes: any = {};

  if (!same(base.settings || {}, next.settings || {})) {
    changes.settings = next.settings || {};
  }

  const oldQuests = questShells(base);
  const newQuests = questShells(next);
  const questUpserts = changedUpserts(oldQuests, newQuests);
  const questDeletes = deletedIds(oldQuests, newQuests);
  if (questUpserts.length) changes.questUpserts = questUpserts;
  if (questDeletes.length) changes.questDeletes = questDeletes;

  const oldTasks = flatTasks(base);
  const newTasks = flatTasks(next);
  const taskUpserts = changedUpserts(oldTasks, newTasks);
  const taskDeletes = deletedIds(oldTasks, newTasks);
  if (taskUpserts.length) changes.taskUpserts = taskUpserts;
  if (taskDeletes.length) changes.taskDeletes = taskDeletes;

  const oldAnchors = anchorShells(base);
  const newAnchors = anchorShells(next);
  const anchorUpserts = changedUpserts(oldAnchors, newAnchors);
  const anchorDeletes = deletedIds(oldAnchors, newAnchors);
  if (anchorUpserts.length) changes.anchorUpserts = anchorUpserts;
  if (anchorDeletes.length) changes.anchorDeletes = anchorDeletes;

  const oldHistory = anchorHistoryMap(base);
  const newHistory = anchorHistoryMap(next);
  const historyUpserts = [...newHistory.entries()]
    .filter(([key]) => !oldHistory.has(key))
    .map(([, value]) => value);
  const historyDeletes = [...oldHistory.entries()]
    .filter(([key]) => !newHistory.has(key))
    .map(([, value]) => value);
  if (historyUpserts.length) changes.anchorHistoryUpserts = historyUpserts;
  if (historyDeletes.length) changes.anchorHistoryDeletes = historyDeletes;

  if (!same(base.rewards || {}, next.rewards || {})) {
    const daily = Array.isArray(next?.rewards?.daily) ? next.rewards.daily : [];
    const weekly = Array.isArray(next?.rewards?.weekly) ? next.rewards.weekly : [];
    changes.rewards = {
      daily: daily.map((text: any, position: number) => ({
        position,
        text: String(text ?? ""),
      })),
      weekly: weekly.map((text: any, position: number) => ({
        position,
        text: String(text ?? ""),
      })),
    };
  }

  if (!same(base.claimed || {}, next.claimed || {})) {
    changes.claims = flattenClaims(next.claimed);
  }

  const oldVoyage = voyageMap(base);
  const newVoyage = voyageMap(next);
  const voyageUpserts = [...newVoyage.entries()]
    .filter(([day, value]) => !same(oldVoyage.get(day), value))
    .map(([, value]) => value);
  const voyageDeletes = [...oldVoyage.keys()].filter((day) => !newVoyage.has(day));
  if (voyageUpserts.length) changes.voyageUpserts = voyageUpserts;
  if (voyageDeletes.length) changes.voyageDeletes = voyageDeletes;

  return changes;
};

const hasChanges = (changes: any) => Object.keys(changes || {}).length > 0;

const markConflict = (
  userId: string,
  cache: QuestCacheRecord,
  remoteData: any,
  remoteUpdatedAt: string | null,
  remoteRevision: number | null
) => {
  const next: QuestCacheRecord = {
    ...cache,
    dirty: true,
    conflict: {
      remoteData,
      remoteUpdatedAt,
      remoteRevision,
    },
    cachedAt: nowISO(),
  };

  writeCache(userId, next);
  emitSync({
    state: "conflict",
    pending: pendingCount(),
    lastSyncedAt: next.lastSyncedAt,
    message: "Offline changes and newer cloud changes both exist. Nothing was overwritten.",
  });
};

const commitNormalizedChanges = async (
  expectedRevision: number | null,
  changes: any,
  force: boolean
) =>
  rawSupabase.rpc("apply_my_quest_changes", {
    p_expected_revision: expectedRevision,
    p_changes: changes,
    p_force: force,
  });

const flushUser = async (userId: string, forceLocal = false): Promise<void> => {
  if (resettingUsers.has(userId)) return;
  const existingLock = syncLocks.get(userId);
  if (existingLock) return existingLock;

  const run = (async () => {
    const cache = readCache(userId);

    if (!cache?.dirty) {
      emitSync({
        state: isOnline() ? "synced" : "offline",
        pending: pendingCount(),
        lastSyncedAt: cache?.lastSyncedAt || null,
        message: isOnline()
          ? "Quest is synced."
          : "Offline. Quest is saving changes on this device.",
      });
      return;
    }

    if (!isOnline()) {
      emitSync({
        state: "offline",
        pending: pendingCount(),
        lastSyncedAt: cache.lastSyncedAt,
        message: "Offline. Changes are safe on this device and will sync later.",
      });
      return;
    }

    emitSync({
      state: "syncing",
      pending: pendingCount(),
      lastSyncedAt: cache.lastSyncedAt,
      message: "Syncing Quest…",
    });

    const cloud = await fetchCloudState(userId);
    if (cloud.error || !cloud.data) {
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: cache.lastSyncedAt,
        message: "Could not reach the cloud yet. Your changes remain safe on this device.",
      });
      return;
    }

    const remoteHash = stateHash(cloud.data);
    const localHash = stateHash(cache.data);
    if ((readCache(userId)?.resetRevision || 0) > cloud.resetRevision) return;

    // A restart supersedes edits made before that account generation, including
    // offline edits and an explicit conflict resolution from an old device.
    if (cloud.resetRevision > (cache.baseRevision ?? -1)) {
      adoptResetSnapshot(userId, cloud);
      return;
    }

    if (cache.conflict && !forceLocal) {
      emitSync({ state: "conflict", pending: pendingCount(), lastSyncedAt: cache.lastSyncedAt,
        message: "Sync needs attention before Quest can safely continue." });
      return;
    }

    if (!forceLocal) {
      const revisionChanged =
        cache.baseRevision != null &&
        cloud.revision != null &&
        cache.baseRevision !== cloud.revision;
      const contentChanged =
        !!cache.baseHash && remoteHash !== cache.baseHash;

      if ((revisionChanged || contentChanged) && remoteHash !== localHash) {
        markConflict(
          userId,
          cache,
          cloud.data,
          cloud.updatedAt,
          cloud.revision
        );
        return;
      }
    }

    if (remoteHash === localHash) {
      const syncedAt = cloud.updatedAt || nowISO();
      writeCache(userId, {
        ...cache,
        data: cloud.data,
        dirty: false,
        baseData: cloud.data,
        baseUpdatedAt: cloud.updatedAt,
        baseHash: remoteHash,
        baseRevision: cloud.revision,
        serverKnownMissing: false,
        lastSyncedAt: syncedAt,
        pendingEdits: 0,
        conflict: null,
        cachedAt: nowISO(),
      });
      emitSync({
        state: "synced",
        pending: pendingCount(),
        lastSyncedAt: syncedAt,
        message: "Quest is synced.",
      });
      return;
    }

    const baseline = cache.baseData || cloud.data || {};
    const changes = buildNormalizedChanges(baseline, cache.data);

    if (!hasChanges(changes)) {
      markConflict(
        userId,
        cache,
        cloud.data,
        cloud.updatedAt,
        cloud.revision
      );
      return;
    }

    const revisionBeingSynced = cache.localRevision;
    const { data: commitResult, error: saveError } = await commitNormalizedChanges(
      forceLocal ? cloud.revision : cache.baseRevision ?? cloud.revision,
      changes,
      forceLocal
    );

    if (saveError) {
      if (String(saveError.code || "") === "40001" || String(saveError.message || "").includes("QUEST_SYNC_CONFLICT")) {
        const latestCloud = await fetchCloudState(userId);
        if (latestCloud.data) {
          if (latestCloud.resetRevision > (cache.baseRevision ?? -1)) {
            adoptResetSnapshot(userId, latestCloud);
            return;
          }
          markConflict(
            userId,
            cache,
            latestCloud.data,
            latestCloud.updatedAt,
            latestCloud.revision
          );
          return;
        }
      }

      console.warn("Quest normalized write failed:", saveError);
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: cache.lastSyncedAt,
        message: "Cloud sync is waiting. Your latest changes are still saved locally.",
      });
      return;
    }

    const committedData = (commitResult as any)?.data || cache.data;
    const committedRevisionValue = Number((commitResult as any)?.revision);
    const committedRevision = Number.isFinite(committedRevisionValue)
      ? committedRevisionValue
      : cloud.revision;
    const committedAt = (commitResult as any)?.updatedAt
      ? String((commitResult as any).updatedAt)
      : nowISO();

    const latest = readCache(userId) || cache;
    if ((latest.resetRevision || 0) > (cache.resetRevision || 0) &&
        latest.baseRevision != null && committedRevision != null &&
        latest.baseRevision > committedRevision) return;
    const changedWhileSyncing = latest.localRevision !== revisionBeingSynced;

    writeCache(userId, {
      ...latest,
      data: changedWhileSyncing ? latest.data : committedData,
      dirty: changedWhileSyncing,
      baseData: committedData,
      baseUpdatedAt: committedAt,
      baseHash: stateHash(committedData),
      baseRevision: committedRevision,
      serverKnownMissing: false,
      lastSyncedAt: committedAt,
      pendingEdits: changedWhileSyncing ? Math.max(1, latest.pendingEdits) : 0,
      conflict: null,
      cachedAt: nowISO(),
    });

    if (changedWhileSyncing) {
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: committedAt,
        message: "A newer local change is waiting to sync.",
      });
      setTimeout(() => void flushUser(userId), 80);
    } else {
      emitSync({
        state: "synced",
        pending: pendingCount(),
        lastSyncedAt: committedAt,
        message: "Quest is synced.",
      });
    }
  })().finally(() => {
    syncLocks.delete(userId);
  });

  syncLocks.set(userId, run);
  return run;
};

const loadQuestRow = async (userId: string) => {
  activeQuestUserId = userId;
  const cached = readCache(userId);
  observedResetRevisions.set(userId, cached?.resetRevision || 0);

  if (!isOnline()) {
    emitSync({
      state: "offline",
      pending: pendingCount(),
      lastSyncedAt: cached?.lastSyncedAt || null,
      message: cached
        ? "Offline. Loaded your latest saved Quest from this device."
        : "Offline. No saved Quest exists on this device yet.",
    });

    return {
      data: cached ? { data: cached.data } : null,
      error: null,
    };
  }

  if (cached?.dirty) {
    await flushUser(userId);
    const afterFlush = readCache(userId) || cached;

    if (afterFlush.dirty || afterFlush.conflict) {
      return {
        data: { data: afterFlush.data },
        error: null,
      };
    }
  }

  const cloud = await fetchCloudState(userId);

  if (cloud.error) {
    if (cached) {
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: cached.lastSyncedAt,
        message: "Cloud unavailable. Using the saved copy on this device.",
      });
      return { data: { data: cached.data }, error: null };
    }
    return { data: null, error: cloud.error };
  }

  if (!cloud.data) {
    return cached
      ? { data: { data: cached.data }, error: null }
      : { data: null, error: null };
  }

  const syncedAt = cloud.updatedAt || cached?.lastSyncedAt || nowISO();
  const latest = readCache(userId);
  // An auth refresh that started before a reset must not restore its old read.
  if (resettingUsers.has(userId) || (latest?.resetRevision || 0) > cloud.resetRevision) {
    return { data: latest ? { data: latest.data } : null, error: null };
  }
  if (cached && cloud.resetRevision > (cached.baseRevision ?? -1)) {
    adoptResetSnapshot(userId, cloud);
    return { data: { data: cloud.data }, error: null };
  }
  observedResetRevisions.set(userId, cloud.resetRevision);
  writeCache(userId, {
    data: cloud.data,
    dirty: false,
    baseData: cloud.data,
    baseUpdatedAt: cloud.updatedAt,
    baseHash: stateHash(cloud.data),
    baseRevision: cloud.revision,
    serverKnownMissing: !cloud.legacyExists,
    lastSyncedAt: syncedAt,
    cachedAt: nowISO(),
    localRevision: cached?.localRevision || 0,
    pendingEdits: 0,
    conflict: null,
    resetRevision: cloud.resetRevision,
  });

  emitSync({
    state: "synced",
    pending: pendingCount(),
    lastSyncedAt: syncedAt,
    message: "Quest is synced.",
  });

  return { data: { data: cloud.data }, error: null };
};

const saveQuestRow = async (payload: any) => {
  const userId = String(payload?.user_id || "");
  if (!userId) {
    return {
      data: null,
      error: new Error("Quest sync could not determine the signed-in user."),
    };
  }

  const existing = readCache(userId);
  if (resettingUsers.has(userId)) {
    return { data: null, error: new Error("Account restart is in progress.") };
  }
  if ((existing?.resetRevision || 0) > (observedResetRevisions.get(userId) || 0)) {
    notifyAccountReset(userId, existing!);
    return { data: null, error: new Error("This account was restarted in another tab.") };
  }
  const next: QuestCacheRecord = {
    data: payload.data,
    dirty: true,
    baseData: existing?.baseData ?? null,
    baseUpdatedAt: existing?.baseUpdatedAt || null,
    baseHash: existing?.baseHash || null,
    baseRevision: existing?.baseRevision ?? null,
    serverKnownMissing: existing?.serverKnownMissing || false,
    lastSyncedAt: existing?.lastSyncedAt || null,
    cachedAt: nowISO(),
    localRevision: (existing?.localRevision || 0) + 1,
    pendingEdits: (existing?.pendingEdits || 0) + 1,
    conflict: existing?.conflict || null,
    resetRevision: existing?.resetRevision || 0,
  };

  writeCache(userId, next);

  emitSync({
    state: isOnline() ? (next.conflict ? "conflict" : "pending") : "offline",
    pending: pendingCount(),
    lastSyncedAt: next.lastSyncedAt,
    message: isOnline()
      ? next.conflict
        ? "Sync needs attention. Your local changes are safe."
        : "Saving changes…"
      : "Offline. Changes are safe on this device and will sync later.",
  });

  if (isOnline() && !next.conflict) {
    await flushUser(userId);
  }

  return { data: null, error: null };
};

const createQuestTable = () => ({
  select: (_columns?: string) => ({
    eq: (column: string, value: any) => ({
      maybeSingle: async () => {
        if (column !== "user_id") {
          return {
            data: null,
            error: new Error("Quest offline adapter only supports user_id lookup."),
          };
        }
        return loadQuestRow(String(value));
      },
    }),
  }),
  insert: async (payload: any) => saveQuestRow(payload),
  upsert: async (payload: any, _options?: any) => saveQuestRow(payload),
});

export const flushQuestSync = async () => {
  const {
    data: { session },
  } = await rawSupabase.auth.getSession();

  if (!session?.user?.id) return;
  const userId = session.user.id;
  await flushUser(userId);
  // A clean device also needs to notice a restart when it comes back online.
  if (!isOnline() || resettingUsers.has(userId)) return;
  const cached = readCache(userId);
  if (!cached) return;
  const cloud = await fetchCloudState(userId);
  if (!cloud.error && cloud.data && cloud.resetRevision > (cached.baseRevision ?? -1)) {
    adoptResetSnapshot(userId, cloud);
  }
};

export const resetQuestAccount = async (expectedUserId: string) => {
  if (!isOnline()) throw new Error("Connect to the internet before restarting your account.");
  if (!expectedUserId) throw new Error("Sign in before restarting your account.");
  if (resettingUsers.has(expectedUserId)) throw new Error("Your account is already restarting.");
  resettingUsers.add(expectedUserId);
  try {
    // Let an already-started save finish; block any new autosaves until reset ends.
    await syncLocks.get(expectedUserId);
    const { data: { session }, error: sessionError } = await rawSupabase.auth.getSession();
    if (sessionError || session?.user?.id !== expectedUserId) {
      throw new Error("Your sign-in changed. Reload Quest and try again.");
    }
    const { data: snapshot, error: readError } = await fetchNormalizedSnapshot();
    if (readError || !snapshot || !Number.isFinite(Number(snapshot.revision)) ||
        !Object.prototype.hasOwnProperty.call(snapshot, "resetRevision")) {
      throw new Error("Could not verify your saved account. Please try again when sync is available.");
    }
    const { data: result, error } = await commitNormalizedChanges(
      Number(snapshot.revision),
      { resetAccount: true, resetUserId: expectedUserId },
      false
    );
    if (error) {
      if (String(error.code) === "40001") {
        throw new Error("Your account changed on another device. Review it, then try restarting again.");
      }
      throw new Error("The restart could not be confirmed. Reconnect and check sync before trying again.");
    }
    if (!isEmptyQuestAccount(result?.data) ||
        !(Number(result?.resetRevision) > Number(snapshot.revision))) {
      throw new Error("The restart could not be confirmed. Reload Quest to check your saved progress.");
    }
    adoptResetSnapshot(expectedUserId, {
      data: result.data, updatedAt: result.updatedAt, baseHash: stateHash(result.data),
      revision: Number(result.revision), resetRevision: Number(result.resetRevision),
      legacyExists: true, source: "normalized", error: null,
    });
    return result.data;
  } finally {
    resettingUsers.delete(expectedUserId);
  }
};

export const resolveQuestConflict = async (strategy: "cloud" | "local") => {
  const {
    data: { session },
  } = await rawSupabase.auth.getSession();

  const userId = session?.user?.id;
  if (!userId) return;

  const cache = readCache(userId);
  if (!cache?.conflict) return;

  if (strategy === "cloud") {
    const remoteData = cache.conflict.remoteData;
    const remoteUpdatedAt = cache.conflict.remoteUpdatedAt;
    const remoteRevision = cache.conflict.remoteRevision;

    if (remoteData == null) {
      await flushUser(userId, true);
      return;
    }

    const syncedAt = remoteUpdatedAt || nowISO();
    writeCache(userId, {
      ...cache,
      data: remoteData,
      dirty: false,
      baseData: remoteData,
      baseUpdatedAt: remoteUpdatedAt,
      baseHash: stateHash(remoteData),
      baseRevision: remoteRevision,
      serverKnownMissing: false,
      lastSyncedAt: syncedAt,
      pendingEdits: 0,
      conflict: null,
      cachedAt: nowISO(),
    });

    emitSync({
      state: "synced",
      pending: pendingCount(),
      lastSyncedAt: syncedAt,
      message: "Cloud copy restored. Reloading Quest…",
    });

    if (typeof window !== "undefined") window.location.reload();
    return;
  }

  writeCache(userId, {
    ...cache,
    conflict: null,
    dirty: true,
    cachedAt: nowISO(),
  });
  await flushUser(userId, true);
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    const userId = activeQuestUserId;
    if (!userId || event.key !== cacheKey(userId)) return;
    const record = readCache(userId);
    if (record && (record.resetRevision || 0) > (observedResetRevisions.get(userId) || 0)) {
      notifyAccountReset(userId, record);
    }
  });
  window.addEventListener("focus", () => { void flushQuestSync().catch(() => {}); });
  window.addEventListener("offline", () => {
    emitSync({
      state: "offline",
      pending: pendingCount(),
      message: "Offline. Quest will keep working and sync later.",
    });
  });

  window.addEventListener("online", () => {
    emitSync({
      state: "pending",
      pending: pendingCount(),
      message: "Connection restored. Checking for changes…",
    });
    void flushQuestSync();
  });
}

export const supabase = new Proxy(rawSupabase, {
  get(target, property, receiver) {
    if (property === "from") {
      return (table: string) =>
        table === "quest_data" ? createQuestTable() : target.from(table);
    }

    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as typeof rawSupabase;

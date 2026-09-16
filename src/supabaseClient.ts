import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nagxpuqdurdcogzudblo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5hZ3hwdXFkdXJkY29nenVkYmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTgxNTQsImV4cCI6MjEwNDQ3NDE1NH0.tKlbuXHSYNUd8VymgFbESpGJZYjCCUrRckI05TH-j08";

const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);

const CACHE_PREFIX = "quest-offline-v1:";
const SYNC_EVENT = "quest-sync-status";

export type QuestSyncState =
  | "synced"
  | "syncing"
  | "offline"
  | "pending"
  | "conflict";

export type QuestSyncSnapshot = {
  state: QuestSyncState;
  pending: number;
  lastSyncedAt: string | null;
  message: string;
};

type ConflictRecord = {
  remoteData: any;
  remoteUpdatedAt: string | null;
};

type QuestCacheRecord = {
  data: any;
  dirty: boolean;
  baseUpdatedAt: string | null;
  baseHash: string | null;
  serverKnownMissing: boolean;
  lastSyncedAt: string | null;
  cachedAt: string;
  localRevision: number;
  pendingEdits: number;
  conflict: ConflictRecord | null;
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

const nowISO = () => new Date().toISOString();

const cacheKey = (userId: string) => `${CACHE_PREFIX}${userId}`;

const stateHash = (data: any) => {
  try {
    return JSON.stringify(data ?? null);
  } catch {
    return null;
  }
};

const readCache = (userId: string): QuestCacheRecord | null => {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as QuestCacheRecord;
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
      const value = JSON.parse(localStorage.getItem(key) || "null") as QuestCacheRecord | null;
      if (value?.dirty) count += Math.max(1, Number(value.pendingEdits) || 1);
    } catch {
      // Ignore malformed stale cache entries.
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

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const markConflict = (
  userId: string,
  cache: QuestCacheRecord,
  remoteData: any,
  remoteUpdatedAt: string | null
) => {
  const next: QuestCacheRecord = {
    ...cache,
    dirty: true,
    conflict: {
      remoteData,
      remoteUpdatedAt,
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

const flushUser = async (userId: string, forceLocal = false): Promise<void> => {
  const existingLock = syncLocks.get(userId);
  if (existingLock) return existingLock;

  const run = (async () => {
    const cache = readCache(userId);
    if (!cache?.dirty) {
      emitSync({
        state: isOnline() ? "synced" : "offline",
        pending: pendingCount(),
        lastSyncedAt: cache?.lastSyncedAt || syncSnapshot.lastSyncedAt,
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

    if (cache.conflict && !forceLocal) {
      emitSync({
        state: "conflict",
        pending: pendingCount(),
        lastSyncedAt: cache.lastSyncedAt,
        message: "Sync needs attention before Quest can safely continue.",
      });
      return;
    }

    emitSync({
      state: "syncing",
      pending: pendingCount(),
      lastSyncedAt: cache.lastSyncedAt,
      message: "Syncing Quest…",
    });

    let remoteRow: { data: any; updated_at: string | null } | null = null;

    if (!forceLocal) {
      const { data: remote, error: remoteError } = await rawSupabase
        .from("quest_data")
        .select("data,updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (remoteError) {
        emitSync({
          state: isOnline() ? "pending" : "offline",
          pending: pendingCount(),
          lastSyncedAt: cache.lastSyncedAt,
          message: "Could not reach the cloud yet. Changes remain safe on this device.",
        });
        return;
      }

      remoteRow = remote;

      const remoteHash = remoteRow ? stateHash(remoteRow.data) : null;
      const remoteChangedFromBase =
        !!remoteRow &&
        !!cache.baseHash &&
        remoteHash !== cache.baseHash;

      const timestampChangedFromBase =
        !!remoteRow &&
        !!cache.baseUpdatedAt &&
        !!remoteRow.updated_at &&
        remoteRow.updated_at !== cache.baseUpdatedAt;

      const remoteMatchesBase =
        !!remoteRow &&
        !!cache.baseHash &&
        remoteHash === cache.baseHash;

      if (remoteRow) {
        if (!cache.baseHash && !cache.serverKnownMissing) {
          if (remoteHash === stateHash(cache.data)) {
            const syncedAt = remoteRow.updated_at || nowISO();
            writeCache(userId, {
              ...cache,
              dirty: false,
              baseHash: remoteHash,
              baseUpdatedAt: remoteRow.updated_at || null,
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

          markConflict(userId, cache, remoteRow.data, remoteRow.updated_at || null);
          return;
        }

        if (
          (remoteChangedFromBase || timestampChangedFromBase) &&
          !remoteMatchesBase
        ) {
          markConflict(userId, cache, remoteRow.data, remoteRow.updated_at || null);
          return;
        }
      } else if (cache.baseHash && !cache.serverKnownMissing) {
        markConflict(userId, cache, null, null);
        return;
      }
    }

    const revisionBeingSynced = cache.localRevision;
    const dataBeingSynced = cache.data;
    const dataBeingSyncedHash = stateHash(dataBeingSynced);
    const serverTimestamp = nowISO();

    const { error: saveError } = await rawSupabase
      .from("quest_data")
      .upsert(
        {
          user_id: userId,
          data: dataBeingSynced,
          updated_at: serverTimestamp,
        },
        { onConflict: "user_id" }
      );

    if (saveError) {
      emitSync({
        state: isOnline() ? "pending" : "offline",
        pending: pendingCount(),
        lastSyncedAt: cache.lastSyncedAt,
        message: "Cloud sync is waiting. Your latest changes are still saved locally.",
      });
      return;
    }

    const latest = readCache(userId) || cache;
    const changedWhileSyncing = latest.localRevision !== revisionBeingSynced;

    writeCache(userId, {
      ...latest,
      dirty: changedWhileSyncing,
      baseUpdatedAt: serverTimestamp,
      baseHash: dataBeingSyncedHash,
      serverKnownMissing: false,
      lastSyncedAt: serverTimestamp,
      pendingEdits: changedWhileSyncing ? Math.max(1, latest.pendingEdits) : 0,
      conflict: null,
      cachedAt: nowISO(),
    });

    if (changedWhileSyncing) {
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: serverTimestamp,
        message: "A newer local change is waiting to sync.",
      });
      setTimeout(() => {
        void flushUser(userId);
      }, 60);
    } else {
      emitSync({
        state: "synced",
        pending: pendingCount(),
        lastSyncedAt: serverTimestamp,
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
  const cached = readCache(userId);

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

  const { data, error } = await rawSupabase
    .from("quest_data")
    .select("data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (cached) {
      emitSync({
        state: "pending",
        pending: pendingCount(),
        lastSyncedAt: cached.lastSyncedAt,
        message: "Cloud unavailable. Using the saved copy on this device.",
      });
      return { data: { data: cached.data }, error: null };
    }

    return { data: null, error };
  }

  if (!data) {
    if (cached) {
      return { data: { data: cached.data }, error: null };
    }

    return { data: null, error: null };
  }

  const syncedAt = data.updated_at || nowISO();
  writeCache(userId, {
    data: data.data,
    dirty: false,
    baseUpdatedAt: data.updated_at || null,
    baseHash: stateHash(data.data),
    serverKnownMissing: false,
    lastSyncedAt: syncedAt,
    cachedAt: nowISO(),
    localRevision: cached?.localRevision || 0,
    pendingEdits: 0,
    conflict: null,
  });

  emitSync({
    state: "synced",
    pending: pendingCount(),
    lastSyncedAt: syncedAt,
    message: "Quest is synced.",
  });

  return { data: { data: data.data }, error: null };
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
  const next: QuestCacheRecord = {
    data: payload.data,
    dirty: true,
    baseUpdatedAt: existing?.baseUpdatedAt || null,
    baseHash: existing?.baseHash || null,
    serverKnownMissing: existing?.serverKnownMissing || false,
    lastSyncedAt: existing?.lastSyncedAt || null,
    cachedAt: nowISO(),
    localRevision: (existing?.localRevision || 0) + 1,
    pendingEdits: (existing?.pendingEdits || 0) + 1,
    conflict: existing?.conflict || null,
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

  insert: async (payload: any) => {
    const userId = String(payload?.user_id || "");
    const existing = readCache(userId);

    if (!existing && userId) {
      writeCache(userId, {
        data: payload.data,
        dirty: true,
        baseUpdatedAt: null,
        baseHash: null,
        serverKnownMissing: isOnline(),
        lastSyncedAt: null,
        cachedAt: nowISO(),
        localRevision: 1,
        pendingEdits: 1,
        conflict: null,
      });
    }

    return saveQuestRow(payload);
  },

  upsert: async (payload: any, _options?: any) => saveQuestRow(payload),
});

export const flushQuestSync = async () => {
  const {
    data: { session },
  } = await rawSupabase.auth.getSession();

  if (!session?.user?.id) return;
  await flushUser(session.user.id);
};

export const resolveQuestConflict = async (
  strategy: "cloud" | "local"
) => {
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

    if (remoteData == null) {
      // The server row disappeared. Keep the local copy rather than erasing the app.
      await flushUser(userId, true);
      return;
    }

    const syncedAt = remoteUpdatedAt || nowISO();
    writeCache(userId, {
      ...cache,
      data: remoteData,
      dirty: false,
      baseUpdatedAt: remoteUpdatedAt || null,
      baseHash: stateHash(remoteData),
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

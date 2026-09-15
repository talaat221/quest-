import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nagxpuqdurdcogzudblo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5hZ3hwdXFkdXJkY29nenVkYmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTgxNTQsImV4cCI6MjEwNDQ3NDE1NH0.tKlbuXHSYNUd8VymgFbESpGJZYjCCUrRckI05TH-j08";

const rawSupabase = createClient(supabaseUrl, supabaseAnonKey);

// ======================================================
// QUEST OFFLINE-FIRST DATA LAYER — PHASE 1
// ======================================================
// Quest currently stores the user's full dashboard state in one quest_data row.
// This wrapper keeps that exact database shape, but mirrors the row locally so:
//   1) Quest can load the last known state with no internet.
//   2) Every state change is written locally before any network request.
//   3) Failed/offline saves remain marked pending.
//   4) Pending saves are pushed to Supabase automatically when connectivity returns.
//
// This first phase intentionally uses a local-wins strategy for a pending offline
// state. A field-level multi-device conflict resolver comes later, when Quest moves
// from the single JSON row to the structured production data model in the roadmap.

const QUEST_CACHE_PREFIX = "quest-offline-state-v1:";
const SYNC_PILL_ID = "quest-sync-pill";

const canUseBrowserStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isOnline = () =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

const cacheKey = (userId: string) => `${QUEST_CACHE_PREFIX}${userId}`;

const readCachedRow = (userId: string) => {
  if (!canUseBrowserStorage() || !userId) return null;

  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch (error) {
    console.warn("Quest could not read its offline cache:", error);
    return null;
  }
};

const writeCachedRow = (
  userId: string,
  data: any,
  options: { updatedAt?: string; pending?: boolean } = {}
) => {
  if (!canUseBrowserStorage() || !userId || !data) return;

  const row = {
    data,
    updatedAt: options.updatedAt || new Date().toISOString(),
    pending: !!options.pending,
  };

  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(row));
  } catch (error) {
    console.error("Quest could not save its offline cache:", error);
  }
};

const pendingUserIds = () => {
  if (!canUseBrowserStorage()) return [] as string[];

  const ids: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(QUEST_CACHE_PREFIX)) continue;

    const userId = key.slice(QUEST_CACHE_PREFIX.length);
    const cached = readCachedRow(userId);
    if (cached?.pending) ids.push(userId);
  }
  return ids;
};

let syncHideTimer: number | null = null;

const showSyncStatus = (
  state: "offline" | "pending" | "syncing" | "synced",
  detail = ""
) => {
  if (typeof document === "undefined") return;

  if (syncHideTimer) {
    window.clearTimeout(syncHideTimer);
    syncHideTimer = null;
  }

  let pill = document.getElementById(SYNC_PILL_ID) as HTMLDivElement | null;
  if (!pill) {
    pill = document.createElement("div");
    pill.id = SYNC_PILL_ID;
    pill.style.position = "fixed";
    pill.style.right = "12px";
    pill.style.bottom = "calc(92px + env(safe-area-inset-bottom))";
    pill.style.zIndex = "5000";
    pill.style.padding = "8px 11px";
    pill.style.borderRadius = "999px";
    pill.style.fontFamily = "system-ui, -apple-system, sans-serif";
    pill.style.fontSize = "11px";
    pill.style.fontWeight = "700";
    pill.style.letterSpacing = ".02em";
    pill.style.backdropFilter = "blur(14px)";
    pill.style.webkitBackdropFilter = "blur(14px)";
    pill.style.boxShadow = "0 8px 24px rgba(0,0,0,.28)";
    pill.style.transition = "opacity .2s ease, transform .2s ease";
    pill.style.pointerEvents = "none";
    document.body.appendChild(pill);
  }

  const labels = {
    offline: "Offline · saved on this iPhone",
    pending: "Waiting to sync",
    syncing: "Syncing voyage…",
    synced: "Synced ✓",
  };

  const styles = {
    offline: ["#2a2112", "#e3b565", "rgba(227,181,101,.35)"],
    pending: ["#1c1831", "#b89cff", "rgba(184,156,255,.35)"],
    syncing: ["#121d32", "#8eb9ff", "rgba(142,185,255,.35)"],
    synced: ["#10251f", "#7ec5a0", "rgba(126,197,160,.35)"],
  } as const;

  const [background, color, border] = styles[state];
  pill.textContent = detail || labels[state];
  pill.style.background = background;
  pill.style.color = color;
  pill.style.border = `1px solid ${border}`;
  pill.style.opacity = "1";
  pill.style.transform = "translateY(0)";

  if (state === "synced") {
    syncHideTimer = window.setTimeout(() => {
      if (!pill) return;
      pill.style.opacity = "0";
      pill.style.transform = "translateY(5px)";
    }, 1400);
  }
};

const savePayloadLocally = (payload: any, pending = true) => {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row?.user_id || !row?.data) return;

  writeCachedRow(row.user_id, row.data, {
    updatedAt: row.updated_at || new Date().toISOString(),
    pending,
  });

  if (pending) {
    showSyncStatus(isOnline() ? "pending" : "offline");
  }
};

const syncPendingUser = async (userId: string) => {
  const cached = readCachedRow(userId);
  if (!cached?.pending || !cached.data || !isOnline()) return false;

  showSyncStatus("syncing");

  try {
    const { error } = await rawSupabase
      .from("quest_data")
      .upsert(
        {
          user_id: userId,
          data: cached.data,
          updated_at: cached.updatedAt || new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw error;

    writeCachedRow(userId, cached.data, {
      updatedAt: cached.updatedAt,
      pending: false,
    });
    showSyncStatus("synced");
    return true;
  } catch (error) {
    console.warn("Quest is still waiting to sync:", error);
    showSyncStatus(isOnline() ? "pending" : "offline");
    return false;
  }
};

const syncAllPending = async () => {
  if (!isOnline()) return;
  const ids = pendingUserIds();
  for (const userId of ids) {
    await syncPendingUser(userId);
  }
};

const waitForConnectionAndLoad = (userId: string) =>
  new Promise((resolve) => {
    showSyncStatus(
      "offline",
      "Offline · connect once to download your Quest data"
    );

    const handleOnline = async () => {
      window.removeEventListener("online", handleOnline);

      try {
        const { data, error } = await rawSupabase
          .from("quest_data")
          .select("data,updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          resolve({ data: null, error });
          return;
        }

        if (data?.data) {
          writeCachedRow(userId, data.data, {
            updatedAt: data.updated_at || new Date().toISOString(),
            pending: false,
          });
        }

        showSyncStatus("synced");
        resolve({
          data: data ? { data: data.data } : null,
          error: null,
        });
      } catch (error) {
        resolve({ data: null, error });
      }
    };

    window.addEventListener("online", handleOnline, { once: true });
  });

const createQuestDataBuilder = () => {
  let userId = "";

  const builder: any = {
    select() {
      return builder;
    },

    eq(column: string, value: any) {
      if (column === "user_id") userId = String(value || "");
      return builder;
    },

    async maybeSingle() {
      const cached = userId ? readCachedRow(userId) : null;

      // A pending offline edit is the newest state on this device. Keep showing it
      // while we attempt to sync it, rather than replacing it with older cloud data.
      if (cached?.pending) {
        if (isOnline()) await syncPendingUser(userId);
        else showSyncStatus("offline");

        return {
          data: { data: cached.data },
          error: null,
        };
      }

      if (!isOnline()) {
        if (cached?.data) {
          showSyncStatus("offline");
          return {
            data: { data: cached.data },
            error: null,
          };
        }

        // Never invent a blank dashboard just because this device has not cached
        // the user's real cloud state yet. Wait safely for the first connection.
        return waitForConnectionAndLoad(userId);
      }

      try {
        const { data, error } = await rawSupabase
          .from("quest_data")
          .select("data,updated_at")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          if (cached?.data) {
            showSyncStatus("pending");
            return { data: { data: cached.data }, error: null };
          }
          return { data: null, error };
        }

        if (data?.data) {
          writeCachedRow(userId, data.data, {
            updatedAt: data.updated_at || new Date().toISOString(),
            pending: false,
          });
        }

        return {
          data: data ? { data: data.data } : null,
          error: null,
        };
      } catch (error) {
        if (cached?.data) {
          showSyncStatus(isOnline() ? "pending" : "offline");
          return { data: { data: cached.data }, error: null };
        }
        return { data: null, error };
      }
    },

    async insert(payload: any) {
      const row = Array.isArray(payload) ? payload[0] : payload;
      const localPayload = {
        ...row,
        updated_at: row?.updated_at || new Date().toISOString(),
      };

      savePayloadLocally(localPayload, true);

      if (!isOnline()) {
        return { data: null, error: null };
      }

      try {
        const result = await rawSupabase.from("quest_data").insert(localPayload);
        if (result.error) return { data: result.data, error: result.error };

        savePayloadLocally(localPayload, false);
        showSyncStatus("synced");
        return result;
      } catch (error) {
        showSyncStatus("pending");
        return { data: null, error: null };
      }
    },

    async upsert(payload: any, options?: any) {
      const row = Array.isArray(payload) ? payload[0] : payload;
      const localPayload = {
        ...row,
        updated_at: row?.updated_at || new Date().toISOString(),
      };

      // Local first: by the time the UI changes, a durable device copy already exists.
      savePayloadLocally(localPayload, true);

      if (!isOnline()) {
        return { data: null, error: null };
      }

      showSyncStatus("syncing");

      try {
        const result = await rawSupabase
          .from("quest_data")
          .upsert(localPayload, options || { onConflict: "user_id" });

        if (result.error) {
          showSyncStatus("pending");
          // Keep the pending local copy and let the reconnect worker retry it.
          return { data: result.data, error: null };
        }

        savePayloadLocally(localPayload, false);
        showSyncStatus("synced");
        return result;
      } catch (error) {
        console.warn("Quest save queued for later sync:", error);
        showSyncStatus(isOnline() ? "pending" : "offline");
        return { data: null, error: null };
      }
    },
  };

  return builder;
};

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    if (pendingUserIds().length) showSyncStatus("offline");
  });

  window.addEventListener("online", () => {
    syncAllPending();
  });

  // A PWA can be killed while offline. Retry any unfinished save next launch.
  window.setTimeout(() => {
    if (isOnline()) syncAllPending();
  }, 900);
}

// Keep the rest of the application on the normal Supabase client. Only the
// quest_data table gets the offline wrapper, so authentication and future
// structured tables continue to use the official client unchanged.
export const supabase = new Proxy(rawSupabase as any, {
  get(target, property, receiver) {
    if (property === "from") {
      return (table: string) =>
        table === "quest_data"
          ? createQuestDataBuilder()
          : rawSupabase.from(table);
    }

    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

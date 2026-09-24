import { supabase } from "../core/supabase/client";

const STORAGE_KEY = "surprizyy_admin_session";
const AUTH_SESSION_CACHE_MS = 5000;
let cachedAuthSession = null;
let cachedAuthSessionAt = 0;
let authSessionRequest = null;

export function getStoredAdminSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed?.temporary_token ||
      !parsed?.session_code ||
      !parsed?.expires_at
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const expiresAt = new Date(parsed.expires_at).getTime();

    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  cachedAuthSession = null;
  cachedAuthSessionAt = 0;
  authSessionRequest = null;
}

export async function getAdminSessionHeaders() {
  const stored = getStoredAdminSession();

  if (!stored) {
    throw new Error("Admin session is missing or expired");
  }

  let session;
  let error;

  if (
    cachedAuthSession &&
    Date.now() - cachedAuthSessionAt < AUTH_SESSION_CACHE_MS
  ) {
    session = cachedAuthSession;
  } else {
    if (!authSessionRequest) {
      authSessionRequest = supabase.auth.getSession().finally(() => {
        authSessionRequest = null;
      });
    }

    const result = await authSessionRequest;
    session = result.data?.session;
    error = result.error;

    if (session && !error) {
      cachedAuthSession = session;
      cachedAuthSessionAt = Date.now();
    }
  }

  if (error || !session?.access_token) {
    throw new Error("Supabase authentication session is missing");
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    "X-Admin-Session-Token": stored.temporary_token,
    "X-Admin-Session-Code": stored.session_code,
  };
}
/* =========================================================
   IDLE SESSION / ACTIVITY MANAGEMENT
========================================================= */

const IDLE_TIMEOUT = 30 * 60 * 1000;// 30 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // refresh at most once / 5 min

const LAST_ACTIVITY_KEY = "surprizyy_admin_last_activity";
const LAST_REFRESH_KEY = "surprizyy_admin_last_refresh";

let activityTimer = null;
let activityRefreshInProgress = false;

function markAdminActivity() {
  const now = Date.now();

  sessionStorage.setItem(
    LAST_ACTIVITY_KEY,
    String(now)
  );

  maybeRefreshAdminSession(now);
}

async function maybeRefreshAdminSession(now = Date.now()) {
  if (activityRefreshInProgress) {
    return;
  }

  const stored = getStoredAdminSession();

  if (!stored) {
    return;
  }

  const lastRefresh = Number(
    sessionStorage.getItem(LAST_REFRESH_KEY) || 0
  );

  if (
    Number.isFinite(lastRefresh) &&
    now - lastRefresh < REFRESH_INTERVAL
  ) {
    return;
  }

  activityRefreshInProgress = true;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return;
    }

    const { data, error } =
      await supabase.functions.invoke(
        "admin-auth",
        {
          body: {
            action: "refresh_session",
          },
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,

            "X-Admin-Session-Token":
              stored.temporary_token,

            "X-Admin-Session-Code":
              stored.session_code,
          },
        }
      );

    if (error || !data?.success) {
      return;
    }

    if (data.admin_session?.expires_at) {
      const updatedSession = {
        ...stored,
        expires_at:
          data.admin_session.expires_at,
      };

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedSession)
      );

      sessionStorage.setItem(
        LAST_REFRESH_KEY,
        String(now)
      );
    }
  } finally {
    activityRefreshInProgress = false;
  }
}

async function handleAdminIdleTimeout() {
  try {
    await revokeAdminSession();

    await supabase.auth.signOut();
  } catch {
    clearAdminSession();
  } finally {
    window.location.reload();
  }
}

export function startAdminSessionMonitor() {
  if (activityTimer) {
    return;
  }

  const now = Date.now();

  sessionStorage.setItem(
    LAST_ACTIVITY_KEY,
    String(now)
  );

  sessionStorage.setItem(
    LAST_REFRESH_KEY,
    String(now)
  );

  const activityEvents = [
    "click",
    "keydown",
    "pointerdown",
    "touchstart",
    "scroll",
  ];

  activityEvents.forEach((eventName) => {
    window.addEventListener(
      eventName,
      markAdminActivity,
      { passive: true }
    );
  });

  activityTimer = window.setInterval(() => {
    const lastActivity = Number(
      sessionStorage.getItem(
        LAST_ACTIVITY_KEY
      ) || 0
    );

    if (
      !Number.isFinite(lastActivity) ||
      Date.now() - lastActivity >= IDLE_TIMEOUT
    ) {
      handleAdminIdleTimeout();
    }
  }, 30 * 1000);
}

export function stopAdminSessionMonitor() {
  if (!activityTimer) {
    return;
  }

  const activityEvents = [
    "click",
    "keydown",
    "pointerdown",
    "touchstart",
    "scroll",
  ];

  activityEvents.forEach((eventName) => {
    window.removeEventListener(
      eventName,
      markAdminActivity
    );
  });

  window.clearInterval(activityTimer);

  activityTimer = null;
  activityRefreshInProgress = false;

  sessionStorage.removeItem(
    LAST_ACTIVITY_KEY
  );

  sessionStorage.removeItem(
    LAST_REFRESH_KEY
  );
}

export async function verifyAdminSession() {
  const stored = getStoredAdminSession();

  if (!stored) {
    return false;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    clearAdminSession();
    return false;
  }

  return true;
}

export async function revokeAdminSession() {
  try {
    const stored = getStoredAdminSession();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (
      stored &&
      session?.access_token
    ) {
      await supabase.functions.invoke(
        "admin-auth",
        {
          body: {
            action: "logout",
          },
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
            "X-Admin-Session-Token":
              stored.temporary_token,
            "X-Admin-Session-Code":
              stored.session_code,
          },
        }
      );
    }
  } finally {
    clearAdminSession();
  }
}
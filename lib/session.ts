import { AuthUser } from "./auth";

const SESSION_COOKIE_NAME = "auth_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Polyfill for crypto.randomUUID() for older mobile browsers
 */
function getRandomUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.warn("crypto.randomUUID() failed, using fallback:", e);
    }
  }
  
  // Fallback for browsers that don't support crypto.randomUUID()
  // Generate a UUID v4 compliant string
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  try {
    return getRandomUUID() + "-" + Date.now();
  } catch (e) {
    console.error("Error generating session token:", e);
    // Ultimate fallback
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Store user session (localStorage + httpOnly cookie)
 */
export function setUserSession(user: AuthUser, token: string) {
  // Store in localStorage for quick access
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("session_token", token);
    } catch (e) {
      // Handle localStorage errors (e.g., quota exceeded, private browsing)
      console.warn("Error storing session in localStorage:", e);
    }
  }
}

/**
 * Get user from localStorage (client-side)
 */
export function getUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  
  try {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Clear user session
 */
export function clearUserSession() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("session_token");
    } catch (e) {
      // Handle localStorage errors (e.g., private browsing)
      console.warn("Error clearing session from localStorage:", e);
    }
  }
}

/**
 * Check if user is logged in (client-side)
 */
export function isUserLoggedIn(): boolean {
  return getUserFromStorage() !== null;
}

/** Dispatched on same window after `mergeUserIntoStorage` updates localStorage (Sidebar, dashboard refresh). */
export const USER_STORAGE_UPDATED_EVENT = "sendxino:user-storage-updated";

/**
 * Merge fields into the stored `user` object and notify listeners.
 * Pass `null` for a field to remove it (e.g. clear `photoUrl` after removing a photo).
 */
export function mergeUserIntoStorage(
  updates: Partial<Record<keyof AuthUser | "display_name", string | boolean | number | null | undefined>>
) {
  if (typeof window === "undefined") return;
  const current = getUserFromStorage();
  if (!current) return;

  const next = { ...current } as Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  try {
    localStorage.setItem("user", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(USER_STORAGE_UPDATED_EVENT));
  } catch (e) {
    console.warn("Error merging user into storage:", e);
  }
}


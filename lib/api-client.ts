/**
 * Authenticated API client for the frontend.
 *
 * Wraps `fetch()` and automatically injects the `X-Session-Token` header
 * from localStorage on every request. This token is validated server-side
 * to resolve the real userId — preventing IDOR attacks where a client
 * could pass an arbitrary userId in query params / request body.
 *
 * Usage (drop-in replacement for fetch):
 *   import { apiFetch } from "@/lib/api-client";
 *   const res = await apiFetch(getApiUrl("/api/user/profile"), { ... });
 *
 * For backwards compatibility, the existing `fetch(getApiUrl(...))` calls
 * continue to work — the backend falls back to the client-supplied userId
 * when no token is present.
 *
 * Migration path: replace `fetch(getApiUrl(path), opts)` with
 * `apiFetch(getApiUrl(path), opts)` gradually across the app.
 */

const SESSION_STORAGE_KEY = "session_token";

/**
 * Get the current session token from localStorage (client-side only).
 */
function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch: identical to `fetch()` but injects X-Session-Token.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getSessionToken();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("X-Session-Token", token);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Convenience: authenticated GET
 */
export async function apiGet(url: string, init?: Omit<RequestInit, "method">): Promise<Response> {
  return apiFetch(url, { ...init, method: "GET" });
}

/**
 * Convenience: authenticated POST with JSON body
 */
export async function apiPost<T = unknown>(
  url: string,
  body: T,
  init?: Omit<RequestInit, "method" | "body">
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return apiFetch(url, {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Convenience: authenticated PATCH with JSON body
 */
export async function apiPatch<T = unknown>(
  url: string,
  body: T,
  init?: Omit<RequestInit, "method" | "body">
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return apiFetch(url, {
    ...init,
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

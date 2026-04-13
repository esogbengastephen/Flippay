/**
 * Base URL for the backend API (FlipPayBackend).
 * - Production: uses NEXT_PUBLIC_API_URL when set.
 * - Local dev (browser on localhost:3000 + API on localhost:3001): returns "" so requests use
 *   same-origin `/api/...` and Next.js rewrites forward to the backend — avoids CORS stripping
 *   `X-Session-Token` on cross-origin calls.
 */
export function getApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  const isBrowserLocalFront =
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "3000";

  if (isBrowserLocalFront && (!env || /^https?:\/\/localhost:3001\b/.test(env))) {
    return "";
  }
  if (env) return env;
  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3000") {
    return "http://localhost:3001";
  }
  return "";
}

/** Full API URL for fetch: getApiBase() + path (path should start with /api/...) */
export function getApiUrl(path: string): string {
  return getApiBase() + path;
}

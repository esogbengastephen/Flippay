/**
 * Base URL for backend API calls from the browser.
 *
 * Always prefer same-origin `/api/...` when `NEXT_PUBLIC_API_URL` is set: `next.config.mjs`
 * rewrites those requests to the real backend (dev + production). That avoids cross-origin
 * `fetch` failures (CORS, mixed content) and keeps `X-Session-Token` on same-origin requests.
 *
 * When `NEXT_PUBLIC_API_URL` is unset, fall back to calling the backend directly on
 * `http://localhost:3001` only for local tooling edge cases; the main app should set the env.
 */
export function getApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
  if (env) {
    return "";
  }

  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost" &&
    window.location.port === "3000"
  ) {
    return "";
  }

  return "";
}

/** Full API URL for fetch: getApiBase() + path (path should start with /api/...) */
export function getApiUrl(path: string): string {
  return getApiBase() + path;
}

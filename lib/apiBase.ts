/**
 * Base URL for the backend API (FlipPayBackend).
 * - Uses NEXT_PUBLIC_API_URL when set.
 * - Localhost: when frontend runs on port 3000 and env is empty, defaults to http://localhost:3001.
 * - Empty string = same origin (when frontend and backend are deployed together).
 */
export function getApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location.port === "3000" && window.location.hostname === "localhost") {
    return "http://localhost:3001";
  }
  return "";
}

/** Full API URL for fetch: getApiBase() + path (path should start with /api/...) */
export function getApiUrl(path: string): string {
  return getApiBase() + path;
}

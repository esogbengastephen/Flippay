/**
 * Base URL for the backend API (FlipPayBackend).
 * - In browser: use NEXT_PUBLIC_API_URL (e.g. https://flippayback.vercel.app or http://localhost:3001).
 * - No trailing slash; path will be appended directly to avoid double slashes.
 * - Empty string = same origin (when frontend and backend are deployed together).
 */
export function getApiBase(): string {
  const url = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  return url.replace(/\/+$/, ""); // strip trailing slash(es) to avoid "base//api/rate"
}

/** Full API URL for fetch: getApiBase() + path (path should start with /api/...) */
export function getApiUrl(path: string): string {
  const base = getApiBase();
  const segment = path.startsWith("/") ? path : `/${path}`;
  return base + segment;
}

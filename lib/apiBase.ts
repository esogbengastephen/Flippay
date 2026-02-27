/**
 * Base URL for the backend API (FlipPayBackend).
 * - In browser: use NEXT_PUBLIC_API_URL (e.g. https://flippay-api.vercel.app or http://localhost:3001).
 * - Empty string = same origin (when frontend and backend are deployed together).
 */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

/** Full API URL for fetch: getApiBase() + path (path should start with /api/...) */
export function getApiUrl(path: string): string {
  return getApiBase() + path;
}

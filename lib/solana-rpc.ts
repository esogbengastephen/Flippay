import type { Connection } from "@solana/web3.js";

/**
 * Public Solana mainnet endpoints used when the primary RPC fails (rate limits, 403, timeouts).
 * Order: more permissive / higher quota first; official cluster last.
 */
const PUBLIC_SOLANA_RPC_FALLBACKS = [
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
] as const;

/**
 * Build a `Connection` to the first RPC that answers `getLatestBlockhash`.
 * Use this from the browser in production so a bad or region-blocked primary does not brick sends.
 */
export async function createSolanaConnectionWithFallbacks(
  primaryRpcUrl?: string | null
): Promise<Connection> {
  const { Connection } = await import("@solana/web3.js");
  const primary = primaryRpcUrl?.trim() || "";
  const urls = [primary, ...PUBLIC_SOLANA_RPC_FALLBACKS].filter(
    (u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i
  );

  let lastError: unknown;
  for (const url of urls) {
    const connection = new Connection(url, "confirmed");
    try {
      await Promise.race([
        connection.getLatestBlockhash("confirmed"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Solana RPC timeout")), 12_000)
        ),
      ]);
      if (url !== primary) {
        console.warn("[Solana] Primary RPC unavailable; using fallback:", url);
      }
      return connection;
    } catch (e) {
      lastError = e;
      console.warn("[Solana] RPC probe failed:", url, e);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach any Solana RPC endpoint");
}

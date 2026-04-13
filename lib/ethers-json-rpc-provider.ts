import {
  FetchRequest,
  JsonRpcProvider,
  type JsonRpcApiProviderOptions,
  type Networkish,
} from "ethers";

/**
 * JsonRpcProvider whose underlying FetchRequest retries when the RPC returns
 * rate limits as JSON-RPC errors (HTTP 200 + `{ error: { code: 429 } }`),
 * which ethers does not treat like HTTP 429.
 */
export function createJsonRpcProviderWith429Retry(
  rpcUrl: string,
  network?: Networkish,
  options?: JsonRpcApiProviderOptions
): JsonRpcProvider {
  const fr = new FetchRequest(rpcUrl);
  fr.setThrottleParams({ maxAttempts: 10, slotInterval: 600 });

  fr.processFunc = async (_req, resp) => {
    try {
      if (!resp.hasBody()) return resp;
      const j = resp.bodyJson as { error?: { code?: number; message?: string } } | null;
      const code = j?.error?.code;
      const msg = String(j?.error?.message || "").toLowerCase();
      if (
        code === 429 ||
        code === -32005 ||
        code === -32016 ||
        msg.includes("rate limit") ||
        msg.includes("rate-limited") ||
        msg.includes("too many requests")
      ) {
        resp.throwThrottleError("RPC rate limited", 3000);
      }
    } catch (e: unknown) {
      const err = e as { throttle?: boolean };
      if (err?.throttle === true) throw e;
    }
    return resp;
  };

  return new JsonRpcProvider(fr, network, options);
}

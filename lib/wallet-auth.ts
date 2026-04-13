"use client";

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createPublicClient, type EIP1193Provider } from "viem";

function readWindowEthereum(win: unknown): unknown {
  if (!win || typeof win !== "object" || !("ethereum" in win)) return undefined;
  return (win as { ethereum?: unknown }).ethereum;
}

/** Prefer MetaMask’s own provider when multiple wallets stack `window.ethereum`. */
function metaMaskEip1193Provider(win?: unknown): EIP1193Provider | undefined {
  const ethereum = readWindowEthereum(win);
  if (!ethereum || typeof ethereum !== "object") return undefined;
  const multi = ethereum as { isMetaMask?: boolean; providers?: unknown[] };
  if (Array.isArray(multi.providers) && multi.providers.length > 0) {
    const mm = multi.providers.find(
      (p) => p && typeof p === "object" && (p as { isMetaMask?: boolean }).isMetaMask === true,
    );
    return mm as EIP1193Provider | undefined;
  }
  return multi.isMetaMask === true ? (ethereum as EIP1193Provider) : undefined;
}

function browserStackEthereumProvider(win?: unknown): EIP1193Provider | undefined {
  const ethereum = readWindowEthereum(win);
  return ethereum && typeof ethereum === "object" ? (ethereum as EIP1193Provider) : undefined;
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({
      target: {
        id: "metaMask",
        name: "MetaMask",
        provider: metaMaskEip1193Provider,
      },
      shimDisconnect: true,
    }),
    injected({
      target: {
        id: "browserWallet",
        name: "Browser wallet",
        provider: browserStackEthereumProvider,
      },
      shimDisconnect: true,
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});

export const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

/**
 * Request wallet connection
 */
export async function connectWallet() {
  try {
    // This will be handled by wagmi hooks in components
    return true;
  } catch (error) {
    console.error("Error connecting wallet:", error);
    throw error;
  }
}

/**
 * Sign message for authentication
 */
export async function signMessage(message: string, address: string) {
  try {
    // This will be handled by wagmi hooks in components
    return "";
  } catch (error) {
    console.error("Error signing message:", error);
    throw error;
  }
}


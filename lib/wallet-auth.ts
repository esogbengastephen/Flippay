"use client";

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createPublicClient, type EIP1193Provider } from "viem";

function multiplexedEthereumProvider(win?: unknown): EIP1193Provider | undefined {
  if (!win || typeof win !== "object" || !("ethereum" in win)) return undefined;
  const eth = (win as { ethereum?: unknown }).ethereum;
  return eth && typeof eth === "object" ? (eth as EIP1193Provider) : undefined;
}

export const wagmiConfig = createConfig({
  // Avoid duplicate MetaMask entries (explicit `injected` + EIP-6963 `io.metamask`). Two connectors
  // sharing one extension can race and trigger "Failed to connect" / already-processing errors.
  multiInjectedProviderDiscovery: false,
  chains: [base],
  connectors: [
    // Single connector: multiplexed `window.ethereum` (MetaMask, Coinbase, Brave, etc.). Targeting
    // MetaMask alone via findProvider() can bind a sub-provider that triggers flaky inpage `connect`
    // errors; the top-level injected proxy is what most wallets expect for eth_requestAccounts.
    injected({
      target: {
        id: "evmBrowser",
        name: "Browser wallet",
        provider: multiplexedEthereumProvider,
      },
      shimDisconnect: false,
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


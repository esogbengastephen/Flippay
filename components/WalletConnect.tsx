"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useConnections } from "wagmi";
import FSpinner from "@/components/FSpinner";
import type { Connector } from "wagmi";

function formatWalletConnectError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = raw.toLowerCase();
  if (
    m.includes("user rejected") ||
    m.includes("user denied") ||
    m.includes("rejected the request") ||
    m.includes("4001")
  ) {
    return "You cancelled the connection in your wallet.";
  }
  if (
    m.includes("already processing eth_requestaccounts") ||
    m.includes("-32002") ||
    (m.includes("resource") && m.includes("unavailable"))
  ) {
    return "A connection is already in progress. Close any MetaMask popups, wait a few seconds, then try once.";
  }
  if (m.includes("failed to connect to metamask") || (m.includes("metamask") && m.includes("connect"))) {
    return "MetaMask did not connect. Unlock the extension, allow this site, then try again. If it still fails, restart the browser or update MetaMask.";
  }
  if (m.includes("wallet") && (m.includes("not found") || m.includes("not installed"))) {
    return "No browser wallet was found. Install MetaMask (or another EVM wallet) on a desktop browser and try again.";
  }
  if (m.includes("provider not found")) {
    return "No EVM wallet was detected. Install MetaMask or another browser wallet, unlock it, allow this site, then refresh.";
  }
  return raw.trim() || "Could not connect wallet. Try again or use another browser.";
}

interface WalletConnectProps {
  onAuthSuccess: (address: string) => void;
}

export default function WalletConnect({ onAuthSuccess }: WalletConnectProps) {
  const { address, isConnected, status } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const connections = useConnections();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifiedRef = useRef(false);
  const connectInFlightRef = useRef(false);

  useEffect(() => {
    if (!isConnected || !address) {
      verifiedRef.current = false;
      return;
    }
  }, [isConnected, address]);

  useEffect(() => {
    // Only verify when fully connected (not reconnecting) and connector is valid.
    // getChainId error occurs when connection is stale (e.g. tab inactive, useConnections empty).
    if (!isConnected || !address || status !== "connected") return;
    if (connections && connections.length === 0) {
      disconnect();
      return;
    }
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    verifyAdmin(address);
  }, [isConnected, address, status, connections, disconnect]);

  const verifyAdmin = async (walletAddress: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      // Brief delay so connector is fully initialized (avoids getChainId timing errors)
      await new Promise((r) => setTimeout(r, 300));
      const message = `Sign in to Send Admin Panel\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      // Verify if wallet is admin
      const response = await fetch(getApiUrl("/api/admin/verify"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          signature,
          message,
        }),
      });

      const data = await response.json();
      
      console.log("Verification response:", data);

      if (data.success && data.isAdmin) {
        // Store session with role and permissions
        const sessionData = { 
          address: walletAddress.toLowerCase(), 
          timestamp: Date.now(),
          role: data.role || "admin",
          permissions: data.permissions || []
        };
        localStorage.setItem("admin_wallet", walletAddress.toLowerCase());
        localStorage.setItem("admin_session", JSON.stringify(sessionData));
        
        // Call success callback - this will trigger AdminAuthGuard to re-check
        onAuthSuccess(walletAddress);
      } else {
        const errorMsg = data.error || "This wallet is not authorized as an admin";
        console.error("Admin verification failed:", data);
        setError(errorMsg + (data.debug ? ` (Debug: ${JSON.stringify(data.debug)})` : ""));
        // Don't disconnect immediately - let user see the error
      }
    } catch (err: any) {
      console.error("Admin verification error:", err);
      const isConnectorError = err?.message?.includes("getChainId is not a function");
      setError(
        isConnectorError
          ? "Connection unstable. Please disconnect and reconnect your wallet."
          : err.message || "Failed to verify admin access"
      );
      disconnect();
    } finally {
      setIsVerifying(false);
    }
  };

  if (isConnected && address) {
    return (
      <div className="space-y-4">
        {isVerifying ? (
          <div className="text-center">
            <FSpinner size="md" className="mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Verifying admin access...
            </p>
          </div>
        ) : (
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Connected Wallet
            </p>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <button
              onClick={() => disconnect()}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Disconnect
            </button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  const handleConnectorClick = async (connector: Connector) => {
    if (connectInFlightRef.current || isPending) return;
    connectInFlightRef.current = true;
    setError(null);
    try {
      await connectAsync({ connector });
    } catch (err) {
      console.warn("[WalletConnect] connect failed:", err);
      setError(formatWalletConnectError(err));
    } finally {
      connectInFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">
        Connect Wallet to Access Admin Panel
      </h3>
      <p className="text-sm text-white/70">
        Please connect your wallet to verify admin access
      </p>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <div className="space-y-3">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            type="button"
            onClick={() => void handleConnectorClick(connector)}
            disabled={isPending}
            className="w-full bg-secondary text-background-dark font-bold py-3 px-4 rounded-lg border border-secondary/50 hover:bg-secondary/90 hover:border-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(19,236,90,0.2)]"
          >
            {isPending ? (
              <>
                <FSpinner size="xs" />
                Connecting...
              </>
            ) : (
              <>
                <span className="material-icons-outlined text-background-dark">account_balance_wallet</span>
                Connect {connector.name}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


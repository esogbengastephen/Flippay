"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useConnections } from "wagmi";
import FSpinner from "@/components/FSpinner";

interface WalletConnectProps {
  onAuthSuccess: (address: string) => void;
}

export default function WalletConnect({ onAuthSuccess }: WalletConnectProps) {
  const { address, isConnected, status } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const connections = useConnections();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifiedRef = useRef(false);

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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Connect Wallet to Access Admin Panel
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Please connect your wallet to verify admin access
      </p>
      <div className="space-y-2">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="w-full bg-primary text-slate-900 font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <FSpinner size="xs" />
                Connecting...
              </>
            ) : (
              <>
                <span className="material-icons-outlined">account_balance_wallet</span>
                Connect {connector.name}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}


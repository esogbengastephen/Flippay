"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState } from "react";
import { useAccount } from "wagmi";
import FSpinner from "@/components/FSpinner";

export default function TestTransferPage() {
  const { address } = useAccount();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [poolBalance, setPoolBalance] = useState<string | null>(null);

  const checkPoolBalance = async () => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    setCheckingBalance(true);
    setError(null);
    setResult(null);

    try {
      // First verify pool configuration
      const verifyResponse = await fetch(getApiUrl(`/api/admin/verify-pool?adminWallet=${address}`));
      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        console.log("Pool verification:", verifyData.data);
        
        // Then get balance
        const response = await fetch(getApiUrl(`/api/admin/test-transfer?adminWallet=${address}`));
        const data = await response.json();

        if (data.success) {
          setPoolBalance(data.data.balance);
          setResult({
            type: "balance",
            message: `Pool Balance: ${data.data.balance} SEND`,
            data: {
              ...data.data,
              verification: verifyData.data,
            },
          });
          
          // Show warning if balance is 0
          if (parseFloat(data.data.balance) === 0) {
            setError(
              `Balance is 0. Pool Address: ${data.data.poolAddress}. ` +
              `Please verify this is the correct wallet address and that it has SEND tokens. ` +
              `Token Contract: ${data.data.tokenContract}`
            );
          }
        } else {
          setError(data.error || "Failed to check balance");
        }
      } else {
        setError(verifyData.error || "Failed to verify pool configuration");
      }
    } catch (err: any) {
      console.error("Error checking balance:", err);
      setError(err.message || "Failed to check balance");
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/i.test(recipientAddress)) {
      setError("Please enter a valid wallet address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(getApiUrl("/api/admin/test-transfer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: recipientAddress,
          amount: amount,
          adminWallet: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: "success",
          message: "Tokens transferred successfully!",
          data: data.data,
        });
        // Clear form
        setRecipientAddress("");
        setAmount("");
        // Refresh balance
        checkPoolBalance();
      } else {
        setError(data.error || "Transfer failed");
      }
    } catch (err: any) {
      console.error("Transfer error:", err);
      setError(err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 space-y-6 lg:space-y-8">
      {/* Pool Balance Card */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">account_balance_wallet</span>
          Liquidity Pool Balance
        </h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {poolBalance !== null ? (
              <p className="text-2xl font-bold text-secondary">{poolBalance} SEND</p>
            ) : (
              <p className="text-accent/60">Not checked</p>
            )}
            <button
              onClick={checkPoolBalance}
              disabled={checkingBalance || !address}
              className="flex items-center gap-2 bg-secondary text-primary font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-icons-outlined text-sm font-bold text-primary">
                {checkingBalance ? "hourglass_empty" : "refresh"}
              </span>
              {checkingBalance ? "Checking..." : "Check Balance"}
            </button>
          </div>

          {result?.data?.verification && (
            <div className="mt-4 p-4 bg-primary/40 rounded-xl border border-accent/10 space-y-2 text-sm">
              <p className="font-semibold text-white">Pool Information:</p>
              <p className="text-accent/80">
                <span className="font-medium text-accent/70">Pool Address:</span>{" "}
                <span className="font-mono text-white">{result.data.poolAddress}</span>
              </p>
              <p className="text-accent/80">
                <span className="font-medium text-accent/70">Token Contract:</span>{" "}
                <span className="font-mono text-white">{result.data.tokenContract}</span>
              </p>
              <p className="text-accent/80">
                <span className="font-medium text-accent/70">Network:</span>{" "}
                <span className="text-white">{result.data.network}</span>
              </p>
              {result.data.verification.balanceError && (
                <p className="text-red-400">
                  <span className="font-medium">Error:</span> {result.data.verification.balanceError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Form */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">send</span>
          Transfer Tokens
        </h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl mb-4">
            <p className="text-sm text-red-400 flex items-center gap-2">
              <span className="material-icons-outlined text-lg">error</span>
              {error}
            </p>
          </div>
        )}

        {result && (
          <div
            className={`mb-4 p-4 rounded-xl ${
              result.type === "success"
                ? "bg-secondary/10 border border-secondary/20"
                : "bg-primary/40 border border-accent/10"
            }`}
          >
            <p
              className={`text-sm font-medium mb-2 flex items-center gap-2 ${
                result.type === "success" ? "text-secondary" : "text-white"
              }`}
            >
              {result.type === "success" && (
                <span className="material-icons-outlined text-lg">check_circle</span>
              )}
              {result.message}
            </p>
            {result.data && (
              <div className="text-xs text-accent/80 space-y-1">
                {result.data.txHash && (
                  <p>
                    TX Hash:{" "}
                    <a
                      href={result.data.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-secondary hover:text-white transition-colors font-mono"
                    >
                      {result.data.txHash.slice(0, 10)}...
                    </a>
                  </p>
                )}
                {result.data.recipientBalanceAfter && (
                  <p>Recipient Balance: {result.data.recipientBalanceAfter} SEND</p>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">
              Recipient Wallet Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-3 font-mono text-sm placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">
              Amount ($SEND)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-3 placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !address}
            className="w-full bg-secondary text-primary font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <FSpinner size="xs" />
                Transferring...
              </>
            ) : (
              <>
                <span className="material-icons-outlined text-sm font-bold text-primary">send</span>
                Transfer Tokens
              </>
            )}
          </button>
        </form>
      </div>

      {/* Warning */}
      <div className="bg-secondary/10 border border-secondary/20 p-4 rounded-xl">
        <p className="text-sm text-white flex items-start gap-2">
          <span className="material-icons-outlined text-secondary text-lg flex-shrink-0">info</span>
          <span>
            <strong>Note:</strong> This is a test endpoint. Tokens will be sent from the liquidity pool.
            Make sure you have sufficient balance and double-check the recipient address.
          </span>
        </p>
      </div>
    </div>
  );
}


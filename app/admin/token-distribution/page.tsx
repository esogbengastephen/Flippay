"use client";

import { getApiUrl } from "@/lib/apiBase";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Distribution {
  transactionId: string;
  walletAddress: string;
  sendAmount: string;
  ngnAmount: number;
  txHash?: string;
  completedAt?: string;
}

export default function TokenDistributionPage() {
  const [poolBalance, setPoolBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loadingDistributions, setLoadingDistributions] = useState(true);

  useEffect(() => {
    fetchPoolBalance();
    fetchDistributions();
  }, []);

  const fetchPoolBalance = async () => {
    setLoading(true);
    try {
      const adminWallet = localStorage.getItem("admin_wallet");
      if (!adminWallet) {
        setLoading(false);
        return;
      }
      const response = await fetch(getApiUrl(`/api/admin/pool-balance?adminWallet=${adminWallet}`));
      const data = await response.json();
      if (data.success) setPoolBalance(data.balance);
    } catch (error) {
      console.error("Error fetching pool balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBalance = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/blockchain/balance?address=${walletAddress}`));
      const data = await response.json();
      if (data.success) setWalletBalance(data.balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistributions = async () => {
    setLoadingDistributions(true);
    try {
      const response = await fetch(getApiUrl("/api/admin/transactions?status=completed"));
      const data = await response.json();
      if (data.success) {
        const completedDistributions = data.transactions
          .filter((tx: any) => tx.status === "completed" && tx.txHash)
          .map((tx: any) => ({
            transactionId: tx.transactionId,
            walletAddress: tx.walletAddress,
            sendAmount: tx.sendAmount,
            ngnAmount: tx.ngnAmount,
            txHash: tx.txHash,
            completedAt: tx.completedAt,
          }))
          .sort((a: Distribution, b: Distribution) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 50);
        setDistributions(completedDistributions);
      }
    } catch (error) {
      console.error("Error fetching distributions:", error);
    } finally {
      setLoadingDistributions(false);
    }
  };

  const handleSync = () => {
    fetchPoolBalance();
    fetchDistributions();
  };

  return (
    <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-surface/60 backdrop-blur-[16px] px-4 py-2 rounded-full border border-accent/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Pool Status</span>
          </div>
          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-secondary text-primary rounded-full font-bold text-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary">refresh</span>
            Sync Pools
          </button>
        </div>
      </header>

      {/* Liquidity Pool Balance - Base card */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div className="bg-secondary/20 p-2 rounded-lg">
            <span className="material-icons-outlined text-white text-2xl">account_balance_wallet</span>
          </div>
          <span className="text-[10px] font-bold text-accent/60 uppercase">Base</span>
        </div>
        <p className="text-accent/70 text-xs mb-1">SEND Liquidity</p>
        <h2 className="text-2xl font-bold text-secondary">
          {loading ? "..." : `${parseFloat(poolBalance).toLocaleString()}`}
        </h2>
        <div className="mt-4 flex justify-between items-center text-[10px]">
          <span className="text-accent/60">Pool Balance</span>
          <span className="text-secondary font-bold">Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Check Balance + Test Transfer */}
        <div className="lg:col-span-1 space-y-6">
          {/** Check Wallet Balance */}
          <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-icons-outlined text-secondary text-xl">account_balance_wallet</span>
              <h3 className="text-lg font-bold text-white">Check Wallet Balance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="w-full bg-primary border border-accent/10 rounded-xl text-sm p-3 text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                />
              </div>
              <button
                onClick={handleCheckBalance}
                disabled={loading || !walletAddress}
                className="w-full py-3 bg-secondary text-primary rounded-xl font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50"
              >
                <span className="material-icons-outlined text-sm font-bold text-primary">search</span>
                Check Balance
              </button>
              {walletAddress && (
                <div className="p-4 bg-primary/40 rounded-xl border border-accent/10">
                  <p className="text-[10px] text-accent/60 uppercase mb-1">Balance</p>
                  <p className="text-xl font-bold text-secondary">
                    {loading ? "..." : `${parseFloat(walletBalance).toLocaleString()} $SEND`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/** Test Transfer link */}
          <Link
            href="/admin/test-transfer"
            className="block bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-dashed border-secondary/20 hover:border-secondary/40 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons-outlined text-secondary text-xl">send</span>
              <h4 className="text-sm font-bold text-white">Execute Test Transfer</h4>
            </div>
            <p className="text-[10px] text-accent/60">
              Send test SEND from the liquidity pool to any address.
            </p>
            <span className="inline-flex items-center gap-1 text-secondary text-xs font-bold mt-2">
              Go to Test Transfer →
            </span>
          </Link>
        </div>

        {/* Right: Distribution History */}
        <div className="lg:col-span-2">
          <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-accent/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Distribution History</h3>
              <span className="text-[10px] text-accent/50 uppercase tracking-wider font-semibold">
                {distributions.length} completed
              </span>
            </div>
            <div className="overflow-x-auto">
              {loadingDistributions ? (
                <div className="p-12 text-center text-accent/60">Loading distribution history...</div>
              ) : distributions.length === 0 ? (
                <div className="p-12 text-center text-accent/60">No distributions found</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Wallet Address</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-right">Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-accent/10">
                    {distributions.map((dist) => (
                      <tr key={dist.transactionId} className="hover:bg-accent/5 transition-colors">
                        <td className="px-6 py-4 text-accent/80 text-xs">
                          {dist.completedAt ? new Date(dist.completedAt).toLocaleString() : "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-white text-xs max-w-[140px] truncate">
                            {dist.walletAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-secondary">{dist.sendAmount} $SEND</div>
                          <div className="text-[10px] text-accent/60">₦{dist.ngnAmount.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {dist.txHash ? (
                            <a
                              href={`https://basescan.org/tx/${dist.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-secondary hover:text-white text-xs font-mono transition-colors"
                            >
                              {dist.txHash.slice(0, 10)}...
                              <span className="material-icons-outlined text-xs">open_in_new</span>
                            </a>
                          ) : (
                            <span className="text-accent/50 text-xs">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

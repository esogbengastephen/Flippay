"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

interface OnrampTransaction {
  id: string;
  transaction_id: string;
  paystack_reference?: string;
  wallet_address: string;
  ngn_amount: number;
  send_amount: string;
  status: string;
  exchange_rate?: number;
  sendtag?: string;
  created_at: string;
  completed_at?: string;
  tx_hash?: string;
  error_message?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10B981",
  pending: "#F59E0B",
  failed: "#EF4444",
};

interface SendRoutesResult {
  success: boolean;
  message?: string;
  routes?: {
    chain: string;
    hasUsdcSendPool: boolean;
    hasUsdcWethPool: boolean;
    hasWethSendPool: boolean;
    canSwapUsdcWethSend: boolean;
    canSwapUsdcToSend: boolean;
    pools: Record<string, string | undefined>;
  };
  links?: Record<string, string>;
}

function SendRoutesCheckCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SendRoutesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkRoutes = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(getApiUrl("/api/admin/check-send-routes"));
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Request failed");
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const routeStatus = result?.routes?.canSwapUsdcToSend ? "Stable" : result ? "Degraded" : null;

  return (
    <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">hub</span>
          SEND Routing Status (Base)
        </h2>
        <div className="flex items-center gap-4">
          {routeStatus && (
            <div className="flex items-center gap-2 bg-primary/40 px-4 py-2 rounded-full border border-accent/10">
              <span className={`w-2 h-2 rounded-full ${routeStatus === "Stable" ? "bg-secondary animate-pulse" : "bg-amber-500"}`} />
              <span className="text-xs text-accent/80">
                Route Status: <span className="text-secondary font-bold">{routeStatus}</span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={checkRoutes}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-secondary text-primary rounded-full font-bold text-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] uppercase tracking-wider disabled:opacity-50"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary" aria-hidden>query_stats</span>
            {loading ? "Checking…" : "Route Check"}
          </button>
        </div>
      </div>
      <p className="text-sm text-accent/70 mb-4">
        USDC → SEND swap routes (Aerodrome, Base). Distribution uses Aerodrome first (direct or USDC→WETH→SEND).
      </p>
      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}
      {result && result.routes && (
        <div className="space-y-2 text-sm">
          <p className={result.routes.canSwapUsdcToSend ? "text-secondary font-medium" : "text-amber-500 font-medium"}>
            {result.message}
          </p>
          <ul className="list-disc list-inside text-accent/70">
            <li>Direct USDC–SEND pool: {result.routes.hasUsdcSendPool ? "Yes" : "No"}</li>
            <li>USDC–WETH pool: {result.routes.hasUsdcWethPool ? "Yes" : "No"}</li>
            <li>WETH–SEND pool: {result.routes.hasWethSendPool ? "Yes" : "No"}</li>
            <li>USDC→WETH→SEND possible: {result.routes.canSwapUsdcWethSend ? "Yes" : "No"}</li>
          </ul>
          {result.links && (
            <div className="pt-2 flex flex-wrap gap-2">
              <a href={result.links.dexscreener} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs">
                DexScreener
              </a>
              <a href={result.links.aerodromeSwap} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs">
                Aerodrome Swap
              </a>
              <a href={result.links.aerodromeLiquidityUsdcSend} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs">
                Aerodrome USDC–SEND
              </a>
              <a href={result.links.aerodromeLiquidityWethSend} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline text-xs">
                Aerodrome WETH–SEND
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnrampTransactionsPage() {
  const { address } = useAccount();
  const [transactions, setTransactions] = useState<OnrampTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "" });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters, pagination.page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (filters.status) params.append("status", filters.status);

      const response = await fetch(getApiUrl(`/api/admin/onramp?${params.toString()}`));
      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualResolve = async (tx: OnrampTransaction) => {
    if (!address) {
      setResolveError("Connect wallet to resolve");
      return;
    }
    setResolveError(null);
    setResolvingId(tx.transaction_id);
    try {
      const res = await fetch(getApiUrl("/api/admin/onramp/resolve"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${address}`,
        },
        body: JSON.stringify({ transactionId: tx.transaction_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || data.message || "Failed to resolve");
        return;
      }
      await fetchTransactions();
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Network error");
    } finally {
      setResolvingId(null);
    }
  };

  const formatStatus = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  const stats = {
    total: pagination.total,
    completed: transactions.filter((t) => t.status === "completed").length,
    pending: transactions.filter((t) => t.status === "pending").length,
    failed: transactions.filter((t) => t.status === "failed").length,
    totalRevenue: transactions
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + parseFloat(t.ngn_amount?.toString() || "0"), 0),
    totalTokensDistributed: transactions
      .filter((t) => t.status === "completed" && t.tx_hash)
      .reduce((sum, t) => sum + parseFloat(t.send_amount || "0"), 0),
  };

  const successRate = stats.total > 0
    ? ((stats.completed / stats.total) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Stats Cards - Glass style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
          <p className="text-[10px] uppercase tracking-widest text-accent/60 font-bold mb-2">
            Total Onramp Volume (NGN)
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-white">
              {loading ? "..." : `₦${stats.totalRevenue.toLocaleString()}`}
            </h3>
          </div>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
          <p className="text-[10px] uppercase tracking-widest text-accent/60 font-bold mb-2">
            Route Success Rate
          </p>
          <div className="flex items-end justify-between gap-4">
            <h3 className="text-2xl font-bold text-white">{successRate}%</h3>
            <div className="w-24 h-2 bg-accent/10 rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full bg-secondary rounded-full"
                style={{ width: `${Math.min(parseFloat(successRate), 100)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
          <p className="text-[10px] uppercase tracking-widest text-accent/60 font-bold mb-2">
            Tokens Distributed
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-white">
              {loading ? "..." : `${stats.totalTokensDistributed.toLocaleString()} $SEND`}
            </h3>
          </div>
        </div>
      </div>

      {/* Additional stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Total</p>
          <p className="text-xl font-bold text-white">{loading ? "..." : stats.total}</p>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Completed</p>
          <p className="text-xl font-bold text-secondary">{loading ? "..." : stats.completed}</p>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Pending</p>
          <p className="text-xl font-bold text-amber-500">{loading ? "..." : stats.pending}</p>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Failed</p>
          <p className="text-xl font-bold text-red-400">{loading ? "..." : stats.failed}</p>
        </div>
      </div>

      {/* SEND Routes Check */}
      <SendRoutesCheckCard />

      {/* Filters */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => fetchTransactions()}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-highlight text-white rounded-lg hover:bg-surface-highlight/80 transition-all border border-accent/10 text-sm font-medium"
            >
              <span className="material-icons-outlined text-sm text-white">filter_alt</span>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {resolveError && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {resolveError}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-secondary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold">
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Wallet Address</th>
                <th className="px-6 py-4">NGN Amount</th>
                <th className="px-6 py-4">$SEND Amount</th>
                <th className="px-6 py-4">Exchange Rate</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-accent/60">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-accent/60">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-accent/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-white">
                        {tx.transaction_id.slice(0, 12)}...
                      </p>
                      {tx.paystack_reference && (
                        <p className="text-[10px] text-accent/60 mt-1">
                          Paystack: {tx.paystack_reference.slice(0, 12)}...
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-white">
                        {tx.wallet_address.slice(0, 10)}...{tx.wallet_address.slice(-8)}
                      </p>
                      {tx.sendtag && (
                        <p className="text-[10px] text-accent/60 mt-1">SendTag: {tx.sendtag}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">
                        ₦{parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-white">
                        {parseFloat(tx.send_amount || "0").toLocaleString()} $SEND
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-accent/70">
                        {tx.exchange_rate ? `₦${parseFloat(tx.exchange_rate.toString()).toLocaleString()}` : "N/A"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold text-white capitalize"
                        style={{ backgroundColor: STATUS_COLORS[tx.status] || "#3B82F6" }}
                      >
                        {formatStatus(tx.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-accent/60">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col gap-1 items-end">
                        {(tx.status === "pending" || tx.status === "failed") && (
                          <button
                            type="button"
                            onClick={() => handleManualResolve(tx)}
                            disabled={!address || resolvingId === tx.transaction_id}
                            className="px-4 py-1.5 rounded-lg border border-secondary/30 text-secondary text-xs font-bold hover:bg-secondary hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {resolvingId === tx.transaction_id ? "Resolving…" : "Manual Resolve"}
                          </button>
                        )}
                        {tx.tx_hash && (
                          <a
                            href={`https://basescan.org/tx/${tx.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-secondary hover:underline"
                          >
                            View on Basescan →
                          </a>
                        )}
                        {tx.error_message && (
                          <p className="text-[10px] text-red-400" title={tx.error_message}>
                            {tx.error_message.slice(0, 30)}...
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div className="p-6 border-t border-accent/10 flex items-center justify-between">
            <p className="text-xs text-accent/70">
              Showing{" "}
              <span className="text-white font-bold">
                {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of {pagination.total} transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/40 border border-accent/10 hover:bg-surface-highlight text-accent/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-icons-outlined text-sm text-white">chevron_left</span>
              </button>
              <span className="px-3 py-1 text-xs text-accent/70">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/40 border border-accent/10 hover:bg-surface-highlight text-accent/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-icons-outlined text-sm text-white">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

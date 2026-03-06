"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";

interface OfframpTransaction {
  id: string;
  transaction_id: string;
  user_id: string;
  user_email?: string;
  wallet_address: string;
  smart_wallet_address?: string;
  solana_wallet_address?: string;
  network: string;
  token_symbol?: string;
  token_amount?: string;
  usdc_amount?: string;
  ngn_amount?: number;
  status: string;
  swap_tx_hash?: string;
  paystack_reference?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
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
  token_received: "#3B82F6",
  swapping: "#3B82F6",
  usdc_received: "#3B82F6",
  paying: "#3B82F6",
  failed: "#EF4444",
  refunded: "#F59E0B",
};

export default function OfframpTransactionsPage() {
  const [transactions, setTransactions] = useState<OfframpTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    network: "",
    token: "",
  });
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
      if (filters.network) params.append("network", filters.network);
      if (filters.token) params.append("token", filters.token);

      const response = await fetch(getApiUrl(`/api/admin/offramp?${params.toString()}`));
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

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const getExplorerUrl = (network: string, txHash?: string) => {
    if (!txHash) return null;
    if (network === "base") return `https://basescan.org/tx/${txHash}`;
    if (network === "solana") return `https://solscan.io/tx/${txHash}`;
    return null;
  };

  const stats = {
    total: pagination.total,
    completed: transactions.filter((t) => t.status === "completed").length,
    pending: transactions.filter((t) =>
      ["pending", "token_received", "swapping", "usdc_received", "paying"].includes(t.status)
    ).length,
    failed: transactions.filter((t) => t.status === "failed").length,
    base: transactions.filter((t) => t.network === "base").length,
    solana: transactions.filter((t) => t.network === "solana").length,
    totalVolume: transactions
      .filter((t) => t.status === "completed" && t.ngn_amount)
      .reduce((sum, t) => sum + (t.ngn_amount || 0), 0),
  };

  const successRate =
    stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Stats Cards - Glass style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
          <p className="text-[10px] uppercase tracking-widest text-accent/60 font-bold mb-2">
            Total Offramp Volume (NGN)
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-white">
              {loading ? "..." : `₦${stats.totalVolume.toLocaleString()}`}
            </h3>
          </div>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
          <p className="text-[10px] uppercase tracking-widest text-accent/60 font-bold mb-2">
            Success Rate
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
            Total Transactions
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-bold text-white">
              {loading ? "..." : stats.total.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Additional stats + Network breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Base</p>
          <p className="text-xl font-bold text-white">{loading ? "..." : stats.base}</p>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] rounded-xl p-4 border border-accent/10">
          <p className="text-[10px] uppercase tracking-wider text-accent/60 font-bold mb-1">Solana</p>
          <p className="text-xl font-bold text-white">{loading ? "..." : stats.solana}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-secondary/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <option value="token_received">Token Received</option>
              <option value="swapping">Swapping</option>
              <option value="usdc_received">USDC Received</option>
              <option value="paying">Paying</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Network
            </label>
            <select
              value={filters.network}
              onChange={(e) => {
                setFilters({ ...filters, network: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              aria-label="Filter by network"
            >
              <option value="">All Networks</option>
              <option value="base">Base</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Token Symbol
            </label>
            <input
              type="text"
              value={filters.token}
              onChange={(e) => {
                setFilters({ ...filters, token: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              placeholder="e.g., USDC, ETH"
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            />
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

      {/* Transactions Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-secondary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold">
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Network</th>
                <th className="px-6 py-4">Token</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">NGN Amount</th>
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
                transactions.map((tx) => {
                  const explorerUrl = getExplorerUrl(tx.network, tx.swap_tx_hash);
                  return (
                    <tr key={tx.id} className="hover:bg-accent/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-mono text-white">
                          {tx.transaction_id.slice(0, 12)}...
                        </p>
                        {tx.user_email && (
                          <p className="text-[10px] text-accent/60 mt-1">{tx.user_email}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold text-white capitalize ${
                            tx.network === "base" ? "bg-secondary/80" : "bg-surface-highlight/80"
                          }`}
                        >
                          {tx.network}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{tx.token_symbol || "N/A"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{tx.token_amount || "N/A"}</p>
                        {tx.usdc_amount && (
                          <p className="text-[10px] text-accent/60">USDC: {tx.usdc_amount}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-white">
                          ₦{tx.ngn_amount?.toLocaleString() || "0"}
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
                          {explorerUrl && (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-secondary hover:underline"
                            >
                              View on Explorer →
                            </a>
                          )}
                          {tx.paystack_reference && (
                            <p className="text-[10px] text-accent/60">
                              Ref: {tx.paystack_reference.slice(0, 8)}...
                            </p>
                          )}
                          {tx.error_message && (
                            <p className="text-[10px] text-red-400" title={tx.error_message}>
                              {tx.error_message.slice(0, 30)}...
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                {((pagination.page - 1) * pagination.limit) + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)}
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

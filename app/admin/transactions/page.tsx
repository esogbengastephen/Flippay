"use client";

import { useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/apiBase";

type TxType = "all" | "onramp" | "offramp";
type ChainFilter = "all" | "base" | "solana";
type StatusFilter = "all" | "completed" | "pending" | "failed";

interface UnifiedTransaction {
  id: string;
  transactionId: string;
  type: "onramp" | "offramp";
  userDisplay: string;
  userIdShort?: string;
  network: string;
  asset: string;
  amountPrimary: string;
  amountSecondary?: string;
  status: string;
  date: string;
  txHash?: string;
  paystackReference?: string;
  walletAddress?: string;
}

interface OnrampTx {
  id: string;
  transaction_id: string;
  wallet_address: string;
  ngn_amount: number;
  send_amount: string;
  status: string;
  exchange_rate?: number;
  created_at: string;
  tx_hash?: string;
  paystack_reference?: string;
}

interface OfframpTx {
  id: string;
  transaction_id: string;
  user_id?: string;
  user_email?: string;
  wallet_address?: string;
  network: string;
  token_symbol?: string;
  token_amount?: string;
  usdc_amount?: string;
  ngn_amount?: number;
  status: string;
  swap_tx_hash?: string;
  created_at: string;
}

const PAGE_SIZE = 20;

function normalizeStatus(s: string): "completed" | "pending" | "failed" {
  if (s === "completed") return "completed";
  if (["pending", "token_received", "swapping", "usdc_received", "paying"].includes(s)) return "pending";
  return "failed";
}

function toUnified(t: OnrampTx | OfframpTx, type: "onramp" | "offramp"): UnifiedTransaction {
  if (type === "onramp") {
    const tx = t as OnrampTx;
    return {
      id: tx.id,
      transactionId: tx.transaction_id,
      type: "onramp",
      userDisplay: tx.wallet_address ? `${tx.wallet_address.slice(0, 6)}...${tx.wallet_address.slice(-4)}` : "—",
      userIdShort: tx.wallet_address,
      network: "base",
      asset: "$SEND",
      amountPrimary: `₦${tx.ngn_amount?.toLocaleString() || "0"}`,
      amountSecondary: tx.exchange_rate ? `Rate: ₦${tx.exchange_rate}/$` : `${tx.send_amount} $SEND`,
      status: tx.status,
      date: tx.created_at,
      txHash: tx.tx_hash,
      paystackReference: tx.paystack_reference,
      walletAddress: tx.wallet_address,
    };
  }
  const tx = t as OfframpTx;
  return {
    id: tx.id,
    transactionId: tx.transaction_id,
    type: "offramp",
    userDisplay: tx.user_email || (tx.wallet_address ? `${tx.wallet_address.slice(0, 6)}...${tx.wallet_address.slice(-4)}` : "—"),
    userIdShort: tx.user_id ? `${tx.user_id.slice(0, 4)}...${tx.user_id.slice(-4)}` : undefined,
    network: tx.network,
    asset: tx.token_symbol || "$SEND",
    amountPrimary: tx.ngn_amount ? `₦${tx.ngn_amount.toLocaleString()}` : (tx.token_amount || "—"),
    amountSecondary: tx.token_amount && tx.ngn_amount ? `${tx.token_amount} $SEND` : undefined,
    status: tx.status,
    date: tx.created_at,
    txHash: tx.swap_tx_hash,
    paystackReference: tx.paystack_reference,
    walletAddress: tx.wallet_address,
  };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: "all" as TxType,
    chain: "all" as ChainFilter,
    status: "all" as StatusFilter,
    search: "",
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const all: UnifiedTransaction[] = [];

    if (filters.type === "all" || filters.type === "onramp") {
      try {
        const params = new URLSearchParams({ page: "1", limit: "500" });
        if (filters.status !== "all") params.append("status", filters.status);
        const res = await fetch(getApiUrl(`/api/admin/onramp?${params}`));
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          data.transactions.forEach((t: OnrampTx) => all.push(toUnified(t, "onramp")));
        }
      } catch (e) {
        console.error("Error fetching onramp:", e);
      }
    }

    if (filters.type === "all" || filters.type === "offramp") {
      try {
        const params = new URLSearchParams({ page: "1", limit: "500" });
        if (filters.status !== "all") params.append("status", filters.status);
        if (filters.chain !== "all") params.append("network", filters.chain);
        const res = await fetch(getApiUrl(`/api/admin/offramp?${params}`));
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          data.transactions.forEach((t: OfframpTx) => all.push(toUnified(t, "offramp")));
        }
      } catch (e) {
        console.error("Error fetching offramp:", e);
      }
    }

    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let filtered = all;

    if (filters.chain !== "all") {
      filtered = filtered.filter((t) => t.network === filters.chain);
    }
    if (filters.status !== "all") {
      filtered = filtered.filter((t) => normalizeStatus(t.status) === filters.status);
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.userDisplay.toLowerCase().includes(q) ||
          (t.userIdShort && t.userIdShort.toLowerCase().includes(q)) ||
          (t.walletAddress && t.walletAddress.toLowerCase().includes(q))
      );
    }

    setTransactions(filtered);
    setTotalCount(filtered.length);
    setLoading(false);
  }, [filters.type, filters.chain, filters.status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetFilters = () => {
    setFilters({ type: "all", chain: "all", status: "all", search: "" });
    setPage(1);
  };

  const paginated = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getExplorerUrl = (network: string, hash?: string) => {
    if (!hash) return null;
    if (network === "base") return `https://basescan.org/tx/${hash}`;
    if (network === "solana") return `https://solscan.io/tx/${hash}`;
    return null;
  };

  const getStatusDisplay = (status: string) => {
    const n = normalizeStatus(status);
    if (n === "completed") return { text: "Completed", cls: "text-secondary", dot: "bg-secondary shadow-[0_0_8px_rgba(19,236,90,0.5)]" };
    if (n === "pending") return { text: "Pending", cls: "text-amber-500", dot: "bg-amber-500" };
    return { text: "Failed", cls: "text-red-500", dot: "bg-red-500" };
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4 p-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface/60 backdrop-blur-[16px] px-4 py-2 rounded-full border border-accent/10">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs text-accent/70">
              System: <span className="text-secondary font-bold">Operational</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="p-2 rounded-full bg-surface/60 backdrop-blur-[16px] border border-accent/10 hover:bg-primary/40 transition-all"
            aria-label="Refresh"
          >
            <span className="material-icons-outlined text-white text-lg">refresh</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-full font-bold text-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)]"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary">file_download</span>
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl p-6 border border-accent/10">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Transaction Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value as TxType });
                setPage(1);
              }}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="onramp">Onramp</option>
              <option value="offramp">Offramp</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Chain
            </label>
            <select
              value={filters.chain}
              onChange={(e) => {
                setFilters({ ...filters, chain: e.target.value as ChainFilter });
                setPage(1);
              }}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            >
              <option value="all">All Chains</option>
              <option value="base">Base</option>
              <option value="solana">Solana</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value as StatusFilter });
                setPage(1);
              }}
              className="w-full bg-primary border border-accent/10 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-accent/60 mb-2 font-bold">
              Search
            </label>
            <div className="relative">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-accent/60">
                search
              </span>
              <input
                type="text"
                placeholder="Transaction ID, wallet..."
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPage(1);
                }}
                className="w-full bg-primary border border-accent/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full h-[42px] flex items-center justify-center gap-2 bg-primary/60 text-white rounded-lg hover:bg-primary/80 transition-all border border-accent/10 text-sm font-medium"
            >
              <span className="material-icons-outlined text-sm text-white">filter_alt</span>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold">
                <th className="px-6 py-4">Transaction ID / Date</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Chain / Asset</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">
                    Loading...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginated.map((tx) => {
                  const statusDisplay = getStatusDisplay(tx.status);
                  const explorerUrl = getExplorerUrl(tx.network, tx.txHash);
                  return (
                    <tr key={`${tx.type}-${tx.id}`} className="hover:bg-accent/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-white">
                          #{tx.transactionId.slice(0, 12)}...
                        </div>
                        <div className="text-[10px] text-accent/60">
                          {new Date(tx.date).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            tx.type === "onramp"
                              ? "bg-surface-highlight/50 text-white"
                              : "bg-primary/60 text-secondary"
                          }`}
                        >
                          {tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white">{tx.userDisplay}</div>
                        {tx.userIdShort && (
                          <div className="text-[10px] text-accent/60 italic truncate max-w-[100px]">
                            ID: {tx.userIdShort}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              tx.network === "base" ? "bg-secondary/20" : "bg-surface-highlight/50"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-bold ${
                                tx.network === "base" ? "text-secondary" : "text-accent/90"
                              }`}
                            >
                              {tx.network === "base" ? "B" : "S"}
                            </span>
                          </div>
                          <span className="text-sm text-white">
                            {tx.network.charAt(0).toUpperCase() + tx.network.slice(1)} ({tx.asset})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-white">{tx.amountPrimary}</div>
                        {tx.amountSecondary && (
                          <div className="text-[10px] text-accent/60">{tx.amountSecondary}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 ${statusDisplay.cls}`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusDisplay.dot}`}
                          />
                          <span className="text-xs font-bold uppercase tracking-tight">
                            {statusDisplay.text}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {explorerUrl ? (
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-4 py-1.5 rounded-lg border border-secondary/20 text-secondary text-xs font-bold hover:bg-secondary hover:text-primary transition-all"
                          >
                            View
                          </a>
                        ) : (
                          <a
                            href={tx.type === "onramp" ? "/admin/onramp" : "/admin/offramp"}
                            className="inline-block px-4 py-1.5 rounded-lg border border-secondary/20 text-secondary text-xs font-bold hover:bg-secondary hover:text-primary transition-all"
                          >
                            Manage
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-accent/10 flex items-center justify-between">
          <p className="text-xs text-accent/70">
            Showing{" "}
            <span className="text-white font-bold">
              {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, totalCount)}
            </span>{" "}
            of {totalCount} transactions
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/40 border border-accent/10 hover:bg-surface-highlight text-accent/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="material-icons-outlined text-sm text-white">chevron_left</span>
            </button>
            {Array.from(
              new Set([
                1,
                totalPages,
                Math.max(1, page - 1),
                page,
                Math.min(totalPages, page + 1),
              ])
            )
              .filter((p) => p >= 1 && p <= totalPages)
              .sort((a, b) => a - b)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    page === p
                      ? "bg-secondary text-primary"
                      : "bg-primary/40 border border-accent/10 hover:bg-surface-highlight text-accent/70"
                  }`}
                >
                  {p}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/40 border border-accent/10 hover:bg-surface-highlight text-accent/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="material-icons-outlined text-sm text-white">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

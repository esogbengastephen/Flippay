"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/apiBase";

interface CryptoTx {
  id: string;
  userId: string | null;
  userEmail: string | null;
  direction: "receive" | "send";
  tokenSymbol: string;
  tokenAddress: string | null;
  chainId: string;
  amount: string;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  status: string;
  source: string;
  referenceId: string | null;
  ngnEquivalent: number | null;
  exchangeRate: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS    = ["all", "completed", "pending", "failed"] as const;
const DIRECTION_OPTIONS = ["all", "receive", "send"] as const;
const PAGE_SIZE         = 50;

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === "completed"
      ? "bg-secondary/10 text-secondary border-secondary/20"
      : s === "failed"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border uppercase ${cls}`}>
      {status}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isReceive = direction === "receive";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
        isReceive
          ? "bg-secondary/10 text-secondary border-secondary/20"
          : "bg-orange-500/10 text-orange-400 border-orange-500/20"
      }`}
    >
      <span className="material-icons-outlined text-[12px]">
        {isReceive ? "south_east" : "north_west"}
      </span>
      {isReceive ? "Received" : "Sent"}
    </span>
  );
}

function shortAddr(addr: string | null | undefined) {
  if (!addr) return "—";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function explorerUrl(txHash: string, chainId: string): string {
  const explorers: Record<string, string> = {
    base:     "https://basescan.org/tx/",
    ethereum: "https://etherscan.io/tx/",
    polygon:  "https://polygonscan.com/tx/",
    solana:   "https://solscan.io/tx/",
  };
  return (explorers[chainId] ?? "https://basescan.org/tx/") + txHash;
}

export default function AdminCryptoTransactionsPage() {
  const [txs, setTxs]               = useState<CryptoTx[]>([]);
  const [pagination, setPagination]  = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading]        = useState(true);
  const [error, setError]            = useState<string | null>(null);

  const [directionFilter, setDirectionFilter] = useState<typeof DIRECTION_OPTIONS[number]>("all");
  const [statusFilter,    setStatusFilter]    = useState<typeof STATUS_OPTIONS[number]>("all");
  const [search,          setSearch]          = useState("");
  const [searchInput,     setSearchInput]     = useState("");
  const [page,            setPage]            = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        direction: directionFilter,
        status:    statusFilter,
        page:      String(page),
        limit:     String(PAGE_SIZE),
      });
      if (search) params.set("search", search);

      const res  = await fetch(getApiUrl(`/api/admin/crypto-transactions?${params}`));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setTxs(data.transactions ?? []);
      setPagination(data.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [directionFilter, statusFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const receives  = txs.filter((t) => t.direction === "receive").length;
  const sends     = txs.filter((t) => t.direction === "send").length;
  const completed = txs.filter((t) => t.status === "completed").length;
  const totalNGN  = txs
    .filter((t) => t.direction === "receive" && t.ngnEquivalent)
    .reduce((s, t) => s + (t.ngnEquivalent ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total (page)",     value: txs.length.toLocaleString() },
          { label: "Receives",         value: receives.toLocaleString() },
          { label: "Sends",            value: sends.toLocaleString() },
          { label: "NGN Onramp (page)",value: `₦${totalNGN.toLocaleString("en-NG")}` },
        ].map((s) => (
          <div key={s.label} className="bg-primary rounded-xl p-4 border border-accent/10">
            <p className="text-xs text-accent/60 mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-primary rounded-xl border border-accent/10 p-4 flex flex-wrap gap-3 items-end">
        {/* Direction */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs text-accent/60 uppercase tracking-wider">Direction</label>
          <select
            value={directionFilter}
            title="Filter by direction"
            onChange={(e) => { setDirectionFilter(e.target.value as typeof DIRECTION_OPTIONS[number]); setPage(1); }}
            className="bg-surface border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o} value={o} className="bg-surface">
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs text-accent/60 uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            title="Filter by status"
            onChange={(e) => { setStatusFilter(e.target.value as typeof STATUS_OPTIONS[number]); setPage(1); }}
            className="bg-surface border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o} className="bg-surface">
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-accent/60 uppercase tracking-wider">Search (address / tx hash / token)</label>
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="0x… or tx hash or SEND"
              className="flex-1 bg-surface border border-accent/20 rounded-lg px-3 py-2 text-sm text-white placeholder-accent/40 focus:outline-none focus:border-secondary"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-secondary text-primary font-semibold text-sm rounded-lg hover:brightness-110 transition-all"
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
                className="px-3 py-2 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-all"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-primary rounded-xl border border-accent/10 overflow-hidden">
        <div className="p-4 border-b border-accent/10 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            Crypto Wallet Transactions
            {pagination.total > 0 && (
              <span className="ml-2 text-xs font-normal text-accent/60">
                ({pagination.total.toLocaleString()} total)
              </span>
            )}
          </h3>
          <button
            onClick={fetchData}
            className="flex items-center gap-1 text-xs text-secondary hover:underline"
          >
            <span className="material-icons-outlined text-sm">refresh</span> Refresh
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-400">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-accent/60">Loading…</div>
        ) : txs.length === 0 ? (
          <div className="p-8 text-center text-accent/60">No crypto transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent/5 text-xs uppercase font-semibold text-accent/60">
                <tr>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Chain</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">NGN Equiv.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-accent/5 transition-colors">
                    <td className="px-4 py-3">
                      <DirectionBadge direction={tx.direction} />
                    </td>
                    <td className="px-4 py-3 text-white max-w-[160px]">
                      <p className="truncate text-xs">{tx.userEmail ?? tx.userId ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">
                      {tx.tokenSymbol}
                    </td>
                    <td className="px-4 py-3 text-accent/70 text-xs uppercase">
                      {tx.chainId}
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">
                      {parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-accent/70">
                      <span title={tx.fromAddress ?? ""}>{shortAddr(tx.fromAddress)}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-accent/70">
                      <span title={tx.toAddress ?? ""}>{shortAddr(tx.toAddress)}</span>
                    </td>
                    <td className="px-4 py-3 text-accent/70 text-xs">
                      {tx.ngnEquivalent ? `₦${tx.ngnEquivalent.toLocaleString("en-NG")}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3 text-accent/60 whitespace-nowrap text-xs">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {tx.txHash ? (
                        <a
                          href={explorerUrl(tx.txHash, tx.chainId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary hover:underline text-xs font-mono"
                          title={tx.txHash}
                        >
                          {shortAddr(tx.txHash)}
                        </a>
                      ) : (
                        <span className="text-accent/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-accent/10 flex items-center justify-between text-sm">
            <p className="text-accent/60">
              Page {pagination.page} of {pagination.totalPages} — {pagination.total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-accent/20 text-white disabled:opacity-40 hover:border-secondary/40 transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-accent/20 text-white disabled:opacity-40 hover:border-secondary/40 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

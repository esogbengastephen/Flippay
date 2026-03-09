"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/apiBase";

interface NGNTx {
  id: string;
  userId: string;
  userEmail: string | null;
  direction: "credit" | "debit";
  amountNGN: number;
  reference: string;
  sourceAccount: string | null;
  destinationAccount: string | null;
  destinationBankCode: string | null;
  narration: string | null;
  senderName: string | null;
  status: string;
  txnType: "sva_deposit" | "wallet_send";
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DIRECTION_OPTIONS = ["all", "credit", "debit"]                    as const;
const STATUS_OPTIONS    = ["all", "completed", "pending", "failed"]     as const;
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

export default function AdminNGNTransactionsPage() {
  const [txs, setTxs]               = useState<NGNTx[]>([]);
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [dirFilter,    setDirFilter]    = useState<typeof DIRECTION_OPTIONS[number]>("all");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>("all");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [page,         setPage]         = useState(1);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        direction: dirFilter,
        status:    statusFilter,
        page:      String(page),
        limit:     String(PAGE_SIZE),
      });
      if (search) params.set("search", search);

      const res  = await fetch(getApiUrl(`/api/admin/ngn-transactions?${params}`));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      setTxs(data.transactions ?? []);
      setPagination(data.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [dirFilter, statusFilter, search, page]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const totalDeposits = txs.filter((t) => t.direction === "credit").length;
  const totalSends    = txs.filter((t) => t.direction === "debit").length;
  const totalVolume   = txs.reduce((s, t) => s + (t.amountNGN || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total (page)",   value: txs.length.toLocaleString() },
          { label: "Deposits (page)", value: totalDeposits.toLocaleString() },
          { label: "Sends (page)",    value: totalSends.toLocaleString() },
          { label: "Volume (page)",   value: `₦${totalVolume.toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="bg-primary rounded-xl p-4 border border-accent/10">
            <p className="text-xs text-accent/60 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-primary rounded-xl border border-accent/10 p-4 flex flex-wrap gap-3 items-end">
        {/* Direction */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs text-accent/60 uppercase tracking-wider">Direction</label>
          <select
            value={dirFilter}
            title="Filter by direction"
            onChange={(e) => { setDirFilter(e.target.value as typeof DIRECTION_OPTIONS[number]); setPage(1); }}
            className="bg-surface border border-accent/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary"
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o} value={o} className="bg-surface">
                {o === "all" ? "All" : o === "credit" ? "Received (Credit)" : "Sent (Debit)"}
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
          <label className="text-xs text-accent/60 uppercase tracking-wider">Search (reference / account)</label>
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Reference, account number…"
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
            NGN Wallet Transactions
            {pagination.total > 0 && (
              <span className="ml-2 text-xs font-normal text-accent/60">
                ({pagination.total.toLocaleString()} total)
              </span>
            )}
          </h3>
          <button
            onClick={fetch_}
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
          <div className="p-8 text-center text-accent/60">No NGN transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent/5 text-xs uppercase font-semibold text-accent/60">
                <tr>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Amount (NGN)</th>
                  <th className="px-4 py-3">From / To Account</th>
                  <th className="px-4 py-3">Narration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-accent/5 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                          tx.direction === "credit"
                            ? "bg-secondary/10 text-secondary border-secondary/20"
                            : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        }`}
                      >
                        <span className="material-icons-outlined text-[12px]">
                          {tx.direction === "credit" ? "arrow_downward" : "arrow_upward"}
                        </span>
                        {tx.direction === "credit" ? "Received" : "Sent"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white max-w-[160px]">
                      <p className="truncate text-xs">{tx.userEmail ?? tx.userId}</p>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">
                      ₦{(tx.amountNGN ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-white text-xs">
                      {tx.direction === "credit" ? (
                        <>
                          <p className="text-accent/50">From:</p>
                          <p>{tx.senderName || tx.sourceAccount || "—"}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-accent/50">To:</p>
                          <p>{tx.destinationAccount || "—"}
                            {tx.destinationBankCode && (
                              <span className="text-accent/50 ml-1">({tx.destinationBankCode})</span>
                            )}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-accent/70 text-xs max-w-[160px]">
                      <p className="truncate" title={tx.narration ?? ""}>
                        {tx.narration || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                          tx.txnType === "sva_deposit"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        }`}
                      >
                        {tx.txnType === "sva_deposit" ? "Deposit" : "Send"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-accent/60 whitespace-nowrap text-xs">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-accent/60 text-xs font-mono max-w-[150px]">
                      <p className="truncate" title={tx.reference}>{tx.reference}</p>
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

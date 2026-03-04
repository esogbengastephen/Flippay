"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useMemo } from "react";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface Payment {
  reference: string;
  amount: number;
  status: string;
  customer: string;
  createdAt: string;
  verified: boolean;
  transactionId?: string | null;
  walletAddress?: string | null;
  sendAmount?: string | null;
  txHash?: string | null;
  source?: string;
}

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/payments"));
      const contentType = response.headers.get("content-type") || "";
      let data: { success?: boolean; payments?: Payment[]; error?: string; details?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = { error: `Invalid JSON (status ${response.status})` };
        }
      } else {
        data = { error: response.ok ? "Server returned non-JSON" : `Request failed (${response.status})` };
      }

      if (data.success === true && Array.isArray(data.payments)) {
        setPayments(data.payments);
      } else {
        const msg =
          data.error ||
          data.details ||
          (response.ok ? "Server returned no payments data." : `Request failed (${response.status}).`);
        setFetchError(msg);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not load payments";
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (reference: string, source?: string) => {
    if (source === "Flutterwave" || source === "ZainPay") {
      alert(`${source} payments are verified via webhook. Status is already up to date.`);
      return;
    }
    setVerifying(reference);
    try {
      const response = await fetch(getApiUrl(`/api/paystack/verify?reference=${reference}`));
      const data = await response.json();

      if (data.success) {
        await fetchPayments();
        setDrawerOpen(false);
        setSelectedPayment(null);
        alert("Payment verified successfully!");
      } else {
        alert("Payment verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Error verifying payment");
    } finally {
      setVerifying(null);
    }
  };

  const openDrawer = (payment: Payment) => {
    setSelectedPayment(payment);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedPayment(null);
  };

  const filteredPayments = useMemo(() => {
    let list = [...payments];

    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        list = list.filter((p) => p.status === "pending" || (!p.verified && p.status === "success"));
      } else if (statusFilter === "verified") {
        list = list.filter((p) => p.verified);
      }
    }

    if (sourceFilter !== "all") {
      list = list.filter((p) => (p.source || "").toLowerCase() === sourceFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.reference || "").toLowerCase().includes(q) ||
          (p.customer || "").toLowerCase().includes(q) ||
          (p.transactionId || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payments, statusFilter, sourceFilter, searchQuery]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPayments.slice(start, start + PAGE_SIZE);
  }, [filteredPayments, page]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const pendingCount = payments.filter(
    (p) => p.status === "pending" || (!p.verified && p.status === "success" && p.source === "Paystack")
  ).length;

  const getStatusBadge = (payment: Payment) => {
    if (payment.verified) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          Verified
        </span>
      );
    }
    if (payment.status === "pending") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          Pending
        </span>
      );
    }
    if (payment.status === "success") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          Pending Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        {payment.status?.toUpperCase() || "—"}
      </span>
    );
  };

  const canVerify = (p: Payment) =>
    !p.verified && p.status === "success" && p.source === "Paystack";

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4 p-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-accent/60 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search ID, User, or Ref..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-2 bg-primary border border-accent/10 rounded-lg text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none w-64"
            />
          </div>
          <button
            type="button"
            onClick={fetchPayments}
            className="p-2 rounded-lg bg-primary border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors"
            aria-label="Refresh"
          >
            <span className="material-icons-outlined text-lg">refresh</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none bg-primary border border-accent/10 rounded-lg pl-4 pr-10 py-2 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="pending">Status: Pending Review</option>
              <option value="verified">Status: Verified</option>
            </select>
            <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none bg-primary border border-accent/10 rounded-lg pl-4 pr-10 py-2 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
            >
              <option value="all">Source: All</option>
              <option value="Paystack">Paystack</option>
              <option value="Flutterwave">Flutterwave</option>
              <option value="ZainPay">ZainPay</option>
            </select>
            <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">
              expand_more
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-accent/70">
            Showing <span className="text-white font-bold">{pendingCount}</span> pending items
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">User / ID</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Proof</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">
                    Loading payments...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-accent/70 mb-4">{fetchError}</p>
                    <button
                      type="button"
                      onClick={fetchPayments}
                      className="px-4 py-2 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)]"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginatedPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">
                    No payments found
                  </td>
                </tr>
              ) : (
                paginatedPayments.map((payment) => (
                  <tr
                    key={payment.reference}
                    onClick={() => openDrawer(payment)}
                    className="hover:bg-accent/5 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-white">
                      {payment.reference}
                      {payment.transactionId && (
                        <span className="block text-[10px] text-accent/60 mt-0.5">
                          TX: {payment.transactionId.slice(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{payment.customer || "—"}</span>
                        {payment.walletAddress && (
                          <span className="text-xs text-accent/60 truncate max-w-[120px]">
                            {payment.walletAddress.slice(0, 6)}...{payment.walletAddress.slice(-4)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          ₦{payment.amount.toLocaleString()}
                        </span>
                        {payment.sendAmount && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">
                            {payment.sendAmount} $SEND
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white">
                        <span className="material-icons-outlined text-sm text-accent/70">
                          account_balance
                        </span>
                        {payment.source || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {payment.txHash ? (
                        <a
                          href={`https://basescan.org/tx/${payment.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-secondary hover:text-white transition-colors text-xs font-medium"
                        >
                          <span className="material-icons-outlined text-sm">open_in_new</span>
                          Basescan
                        </a>
                      ) : (
                        <span className="text-accent/50 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(payment)}</td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canVerify(payment) ? (
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(payment.reference, payment.source)}
                          disabled={verifying === payment.reference}
                          className="bg-secondary text-primary font-bold px-4 py-2 rounded-lg text-xs hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)] disabled:opacity-50"
                        >
                          {verifying === payment.reference ? "Verifying..." : "Verify Now"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDrawer(payment)}
                          className="text-accent/70 hover:text-white text-xs font-medium underline"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredPayments.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-accent/10 flex items-center justify-between bg-accent/[0.02]">
            <div className="text-xs text-accent/70">
              Showing{" "}
              <span className="text-white font-medium">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredPayments.length)}
              </span>{" "}
              of <span className="text-white font-medium">{filteredPayments.length}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs rounded bg-primary/60 border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-xs rounded bg-primary/60 border border-accent/10 text-white hover:bg-accent/5 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={closeDrawer}
          aria-hidden
        />
        <div
          className={`relative w-full max-w-[500px] h-full bg-primary border-l border-accent/10 shadow-2xl flex flex-col transform transition-transform duration-300 ${
            drawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-20 flex items-center justify-between px-6 border-b border-accent/10 bg-surface/40">
            <h2 className="text-lg font-bold text-white">Verify Transaction</h2>
            <button
              type="button"
              onClick={closeDrawer}
              className="text-accent/70 hover:text-white transition-colors"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          {selectedPayment && (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-accent/5 rounded-xl p-4 border border-accent/10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary text-xl font-bold">
                      {(selectedPayment.customer || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">
                        {selectedPayment.customer || "—"}
                      </h3>
                      <p className="text-accent/60 text-sm">
                        Ref: {selectedPayment.reference}
                      </p>
                    </div>
                  </div>
                  {selectedPayment.walletAddress && (
                    <div className="text-sm">
                      <span className="block text-accent/60 text-xs mb-1">Wallet</span>
                      <span className="text-white font-mono text-xs break-all">
                        {selectedPayment.walletAddress}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-accent/60 uppercase tracking-wider mb-3">
                    Transaction Details
                  </h4>
                  <div className="bg-accent/5 rounded-xl p-4 border border-accent/10 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-accent/10">
                      <span className="text-accent/60 text-sm">Amount</span>
                      <div className="text-right">
                        <span className="block text-xl font-bold text-white">
                          ₦{selectedPayment.amount.toLocaleString()} NGN
                        </span>
                        {selectedPayment.sendAmount && (
                          <span className="text-xs text-secondary">
                            {selectedPayment.sendAmount} $SEND
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-accent/60 text-sm">Reference ID</span>
                      <span className="text-white font-mono text-sm">
                        {selectedPayment.reference}
                      </span>
                    </div>
                    {selectedPayment.transactionId && (
                      <div className="flex justify-between items-center">
                        <span className="text-accent/60 text-sm">Transaction ID</span>
                        <span className="text-white font-mono text-sm">
                          {selectedPayment.transactionId}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-accent/60 text-sm">Source</span>
                      <span className="text-white text-sm">{selectedPayment.source || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-accent/60 text-sm">Date</span>
                      <span className="text-white text-sm">
                        {new Date(selectedPayment.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedPayment.txHash && (
                  <div>
                    <h4 className="text-sm font-semibold text-accent/60 uppercase tracking-wider mb-3">
                      Proof
                    </h4>
                    <a
                      href={`https://basescan.org/tx/${selectedPayment.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-secondary hover:text-white transition-colors text-sm font-medium"
                    >
                      <span className="material-icons-outlined text-sm">open_in_new</span>
                      View on Basescan
                    </a>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-accent/10 bg-surface/40 flex gap-3">
                {canVerify(selectedPayment) ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleVerifyPayment(selectedPayment.reference, selectedPayment.source)
                    }
                    disabled={verifying === selectedPayment.reference}
                    className="flex-[2] py-3 rounded-lg bg-secondary text-primary font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.4)] disabled:opacity-50"
                  >
                    {verifying === selectedPayment.reference
                      ? "Verifying..."
                      : "Confirm & Verify Payment"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex-1 py-3 rounded-lg border border-accent/20 text-accent/80 hover:text-white hover:bg-accent/5 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

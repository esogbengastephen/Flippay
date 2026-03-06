"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getApiUrl } from "@/lib/apiBase";

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  merchantEmail: string;
  amount: number;
  currency: string;
  cryptoChainId: string | null;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  transactionId: string | null;
  paystackReference: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const PAGE_SIZE = 20;

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const url = getApiUrl(statusFilter
        ? `/api/admin/invoices?status=${encodeURIComponent(statusFilter)}`
        : "/api/admin/invoices");
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";
      let data: { success?: boolean; invoices?: AdminInvoice[]; error?: string; details?: string } = {};
      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = { error: `Invalid JSON (status ${response.status})` };
        }
      } else {
        data = { error: response.ok ? "Server returned non-JSON" : `Request failed (${response.status})` };
      }

      if (data.success === true && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      } else {
        const msg =
          data.error ||
          data.details ||
          (response.ok ? "Server returned no invoice data." : `Request failed (${response.status}).`);
        setFetchError(msg);
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatAmount = (inv: AdminInvoice) => {
    const n = inv.amount;
    if (inv.currency === "NGN") {
      return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${inv.currency}`;
  };

  const customerLabel = (inv: AdminInvoice) =>
    inv.customerName || inv.customerEmail || inv.customerPhone || "—";

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.merchantEmail.toLowerCase().includes(q) ||
      (customerLabel(inv) || "").toLowerCase().includes(q) ||
      (inv.description || "").toLowerCase().includes(q)
    );
  });

  const paginatedInvoices = filteredInvoices.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));

  const getStatusBadge = (status: string) => {
    if (status === "paid") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
          Paid
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          Pending
        </span>
      );
    }
    if (status === "expired" || status === "cancelled") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent/70 border border-accent/20">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
        {status.toUpperCase()}
      </span>
    );
  };

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
              placeholder="Search invoice, merchant, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-2 bg-primary border border-accent/10 rounded-lg text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none w-64"
            />
          </div>
          <Link
            href="/invoice"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)] text-sm whitespace-nowrap"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary">add</span>
            Generate invoice
          </Link>
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
              className="appearance-none bg-primary border border-accent/10 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">
              expand_more
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-accent/70">
            Showing <span className="text-white font-bold">{filteredInvoices.length}</span> invoices
          </span>
          <button
            type="button"
            onClick={fetchInvoices}
            className="p-2 rounded-lg bg-primary border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors"
            aria-label="Refresh"
          >
            <span className="material-icons-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Merchant</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Due / Created</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-accent/60">
                    Loading invoices...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-accent/70 mb-2">{fetchError}</p>
                    <p className="text-xs text-accent/60 mb-4 max-w-md mx-auto">
                      Ensure the invoices migration has been applied in Supabase and SUPABASE_SERVICE_ROLE_KEY is set for the admin API.
                    </p>
                    <button
                      type="button"
                      onClick={fetchInvoices}
                      className="px-4 py-2 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)]"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-accent/60">
                    No invoices found. Invoices created by users at /invoice will appear here.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-accent/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-white">
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      {inv.merchantEmail}
                    </td>
                    <td className="px-6 py-4 text-sm text-accent/80 max-w-[140px] truncate" title={customerLabel(inv)}>
                      {customerLabel(inv)}
                    </td>
                    <td className="px-6 py-4 text-sm text-accent/70 max-w-[140px] truncate" title={inv.description || "—"}>
                      {inv.description || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">
                      {formatAmount(inv)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-accent/70">
                      <span className="block" title={inv.dueDate ? `Due: ${new Date(inv.dueDate).toLocaleString()}` : undefined}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                      </span>
                      <span className="block text-xs text-accent/50 mt-0.5">
                        {new Date(inv.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/invoice/${inv.invoiceNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-secondary/20 text-secondary text-xs font-bold hover:bg-secondary hover:text-primary transition-all"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredInvoices.length > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-accent/10 flex items-center justify-between bg-accent/[0.02]">
            <div className="text-xs text-accent/70">
              Showing{" "}
              <span className="text-white font-medium">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredInvoices.length)}
              </span>{" "}
              of <span className="text-white font-medium">{filteredInvoices.length}</span>
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
    </div>
  );
}

"use client";

import { getApiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import BulkEmailSection from "./BulkEmailSection";
import FSpinner from "@/components/FSpinner";

interface ReferralUser {
  id: string;
  email: string;
  referral_code: string;
  referral_count: number;
  referred_by: string | null;
  created_at: string;
  referredUsers?: any[];
  activeReferralsCount?: number;
  totalReferralSpending?: number;
  totalReferralTransactions?: number;
  userOwnTransactionCount?: number;
  userOwnSpending?: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function ReferralsPage() {
  const { address } = useAccount();
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalReferrals: 0,
    activeReferrers: 0,
    totalReferralRevenue: 0,
    avgReferralsPerUser: "0",
    topReferrer: null as any,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minReferrals: "",
    maxReferrals: "",
    minActiveReferrals: "",
    minReferralSpending: "",
    accountDateFrom: "",
    accountDateTo: "",
    referralStatus: "all",
    hasTransactingReferrals: "all",
    hasOwnTransactions: "all",
  });
  const [exporting, setExporting] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (address) fetchReferrals();
  }, [address, pagination.page, pagination.pageSize, search, filters]);

  const fetchReferrals = async () => {
    if (!address) return;
    setLoading(true);
    setSelectedUsers([]);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        ...filters,
      });
      const response = await fetch(getApiUrl(`/api/admin/referrals?${params.toString()}`));
      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
        setStats(data.stats || { totalUsers: 0, totalReferrals: 0, activeReferrers: 0, totalReferralRevenue: 0, avgReferralsPerUser: "0", topReferrer: null });
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to fetch referral data");
      }
    } catch (err: any) {
      setError("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      minReferrals: "",
      maxReferrals: "",
      minActiveReferrals: "",
      minReferralSpending: "",
      accountDateFrom: "",
      accountDateTo: "",
      referralStatus: "all",
      hasTransactingReferrals: "all",
      hasOwnTransactions: "all",
    });
    setSearch("");
  };

  const hasActiveFilters =
    search !== "" ||
    Object.entries(filters).some(([k, v]) =>
      !["referralStatus", "hasTransactingReferrals", "hasOwnTransactions"].includes(k) ? v !== "" : v !== "all"
    );

  const handleSelectAll = (checked: boolean) => {
    setSelectedUsers(checked ? users.map((u) => u.email) : []);
  };

  const handleSelectUser = (email: string, checked: boolean) => {
    setSelectedUsers((prev) => (checked ? [...prev, email] : prev.filter((e) => e !== email)));
  };

  const handleBulkEmail = async () => {
    if (!emailSubject || !emailMessage || selectedUsers.length === 0) {
      setError("Please fill in subject, message, and select users");
      return;
    }
    setSendingBulkEmail(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/referrals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailList: selectedUsers, subject: emailSubject, message: emailMessage }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setEmailSubject("");
        setEmailMessage("");
        setSelectedUsers([]);
        setTimeout(() => setSuccess(false), 5000);
        fetchReferrals();
      } else {
        setError(data.error || "Failed to send email");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  const handleSendEmailToUser = async (userEmail: string) => {
    if (!emailSubject || !emailMessage) {
      setError("Please fill in email subject and message");
      return;
    }
    setSendingBulkEmail(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/referrals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailList: [userEmail], subject: emailSubject, message: emailMessage }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to send email");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send email");
    } finally {
      setSendingBulkEmail(false);
    }
  };

  const handleExport = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select at least one user to export");
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(getApiUrl("/api/admin/referrals/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmails: selectedUsers }),
      });
      if (!response.ok) throw new Error("Failed to export");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referrals-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to export");
      setTimeout(() => setError(null), 5000);
    } finally {
      setExporting(false);
    }
  };

  const getReferrerStatus = (u: ReferralUser, topCount: number) => {
    if (u.referral_count === 0) return { label: "Inactive", cls: "bg-red-500/10 text-red-400 border-red-500/30" };
    if (u.referral_count >= topCount && topCount > 0) return { label: "Top Tier", cls: "bg-secondary/10 text-secondary border-secondary/30" };
    if (u.referral_count <= 10) return { label: "New", cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" };
    return { label: "Active", cls: "bg-secondary/10 text-secondary border-secondary/30" };
  };

  const getUserInitials = (u: ReferralUser) => (u.email ? u.email.slice(0, 2).toUpperCase() : "U");
  const topCount = stats.topReferrer?.referral_count || 0;
  const isAllSelected = users.length > 0 && selectedUsers.length === users.length;

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4">
        <button
          onClick={handleExport}
          disabled={selectedUsers.length === 0 || exporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface/60 border border-secondary/30 text-secondary font-bold rounded-lg hover:bg-secondary/10 transition-all shadow-[0_0_10px_rgba(19,236,90,0.1)] disabled:opacity-50"
        >
          <span className="material-icons-outlined text-lg text-white">download</span>
          Export Report
        </button>
      </header>

      {success && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
          <p className="text-sm text-secondary font-medium">✓ Action completed successfully</p>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Referral Revenue", value: `₦${stats.totalReferralRevenue.toLocaleString()}`, icon: "payments", color: "secondary" },
          { label: "Active Referrers", value: stats.activeReferrers.toLocaleString(), icon: "group_add", color: "blue" },
          { label: "Total Referrals", value: stats.totalReferrals.toLocaleString(), icon: "account_balance_wallet", color: "purple" },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl bg-surface/60 backdrop-blur-[16px] px-4 py-5 border border-accent/10 hover:border-secondary/30 transition-all"
          >
            <div className={`absolute rounded-lg p-3 border ${s.color === "secondary" ? "bg-secondary/10 border-secondary/20" : s.color === "blue" ? "bg-secondary/10 border-secondary/20" : "bg-surface-highlight/50 border-surface-highlight"}`}>
              <span className="material-icons-outlined text-xl text-white">{s.icon}</span>
            </div>
            <p className="ml-16 text-[10px] uppercase tracking-wider text-accent/60 font-bold">{s.label}</p>
            <p className="ml-16 text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-4 rounded-xl border border-accent/10">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white text-lg">search</span>
            <input
              type="text"
              placeholder="Search referrer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-primary/50 border border-accent/10 rounded-lg text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={filters.referralStatus}
                onChange={(e) => handleFilterChange("referralStatus", e.target.value)}
                className="appearance-none bg-primary/50 border border-accent/10 rounded-lg py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="has_referrals">Has Referrals</option>
                <option value="no_referrals">No Referrals</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none text-sm">expand_more</span>
            </div>
            <div className="relative">
              <select
                value={pagination.pageSize}
                onChange={(e) => setPagination((p) => ({ ...p, pageSize: parseInt(e.target.value), page: 1 }))}
                className="appearance-none bg-primary/50 border border-accent/10 rounded-lg py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none text-sm">expand_more</span>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2.5 border border-accent/10 rounded-lg text-accent/70 hover:text-white hover:bg-accent/5 text-sm font-medium transition-colors"
            >
              <span className="material-icons-outlined text-lg text-white">filter_list</span>
              Filter
              {hasActiveFilters && <span className="bg-secondary/20 text-secondary text-xs px-2 py-0.5 rounded-full">Active</span>}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-accent/70 hover:text-white transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-primary/40 rounded-xl border border-accent/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Min Referrals</label>
              <input type="number" placeholder="0" value={filters.minReferrals} onChange={(e) => handleFilterChange("minReferrals", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Max Referrals</label>
              <input type="number" placeholder="No limit" value={filters.maxReferrals} onChange={(e) => handleFilterChange("maxReferrals", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Min Referral Spending (₦)</label>
              <input type="number" placeholder="0" value={filters.minReferralSpending} onChange={(e) => handleFilterChange("minReferralSpending", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Min Active Referrals</label>
              <input type="number" placeholder="0" value={filters.minActiveReferrals} onChange={(e) => handleFilterChange("minActiveReferrals", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Account From</label>
              <input type="date" value={filters.accountDateFrom} onChange={(e) => handleFilterChange("accountDateFrom", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Account To</label>
              <input type="date" value={filters.accountDateTo} onChange={(e) => handleFilterChange("accountDateTo", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Export selected banner */}
      {selectedUsers.length > 0 && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-secondary font-medium">{selectedUsers.length} user(s) selected</span>
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 disabled:opacity-50">
            {exporting ? <FSpinner size="xs" /> : <span className="material-icons-outlined text-primary">file_download</span>}
            Export Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-accent/10 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Top Referrers
            <span className="text-xs text-accent/50 uppercase tracking-wider font-semibold">Live Data</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="w-4 h-4 rounded border-accent/30 bg-primary text-secondary focus:ring-secondary cursor-pointer" />
                </th>
                <th className="px-6 py-4">User / ID</th>
                <th className="px-6 py-4">Referrals</th>
                <th className="px-6 py-4">Total Earnings</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-accent/60">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-accent/60">No referrers found</td>
                </tr>
              ) : (
                users.map((user) => {
                  const status = getReferrerStatus(user, topCount);
                  return (
                    <tr key={user.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="px-6 py-4">
                        <input type="checkbox" checked={selectedUsers.includes(user.email)} onChange={(e) => handleSelectUser(user.email, e.target.checked)} className="w-4 h-4 rounded border-accent/30 bg-primary text-secondary focus:ring-secondary cursor-pointer" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded flex items-center justify-center font-bold text-xs border ${user.referral_count >= topCount && topCount > 0 ? "bg-surface-highlight border-secondary/20 text-secondary" : "bg-surface-highlight border-accent/10 text-white"}`}>
                            {getUserInitials(user)}
                          </div>
                          <div>
                            <div className="font-medium text-white">{user.email}</div>
                            <div className="text-xs text-accent/50 font-mono">ID: #{user.id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white font-bold">{user.referral_count || 0}</td>
                      <td className="px-6 py-4 text-secondary font-mono">₦{(user.totalReferralSpending || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleSendEmailToUser(user.email)} disabled={!emailSubject || !emailMessage || sendingBulkEmail} className="p-2 rounded-lg text-white hover:text-secondary hover:bg-accent/5 transition-colors disabled:opacity-50" title="Send Email">
                          <span className="material-icons-outlined text-lg text-white">mail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-accent/10 flex items-center justify-between bg-accent/[0.02]">
          <p className="text-sm text-accent/60">
            Showing <span className="font-medium text-white">{Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}</span> to{" "}
            <span className="font-medium text-white">{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}</span> of{" "}
            <span className="font-medium text-white">{pagination.totalCount}</span> referrers
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-accent/10 bg-primary/60 text-accent/70 hover:bg-accent/5 disabled:opacity-50 transition-colors">
              <span className="material-icons-outlined text-sm text-white">chevron_left</span>
            </button>
            <span className="px-3 text-sm text-accent/70">Page {pagination.page} of {pagination.totalPages}</span>
            <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))} disabled={pagination.page >= pagination.totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-accent/10 bg-primary/60 text-accent/70 hover:bg-accent/5 disabled:opacity-50 transition-colors">
              <span className="material-icons-outlined text-sm text-white">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Email */}
      <BulkEmailSection
        emailSubject={emailSubject}
        setEmailSubject={setEmailSubject}
        emailMessage={emailMessage}
        setEmailMessage={setEmailMessage}
        selectedCount={selectedUsers.length}
        usersOnPage={users.length}
        sending={sendingBulkEmail}
        onSend={handleBulkEmail}
      />
    </div>
  );
}

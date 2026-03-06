"use client";

import { getApiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import DangerZone from "./DangerZone";
import FSpinner from "@/components/FSpinner";

interface User {
  id: string;
  email: string | null;
  walletAddress: string | null;
  referralCode: string | null;
  referralCount: number;
  referredBy: string | null;
  sendtag?: string | null;
  totalTransactions: number;
  totalSpentNGN: number;
  totalReceivedSEND: string;
  firstTransactionAt: string | null;
  lastTransactionAt: string | null;
  createdAt: string;
  userType: "email" | "wallet";
  isBlocked?: boolean;
  requiresReset?: boolean;
  blockedAt?: string | null;
  blockedReason?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersToday: 0,
    totalTransactions: 0,
    totalRevenue: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minTransactions: "",
    maxTransactions: "",
    minSpent: "",
    maxSpent: "",
    transactionDateFrom: "",
    transactionDateTo: "",
    hasTransactions: "all",
  });
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        search,
        sortBy,
        sortOrder,
        ...filters,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const [usersResponse, statsResponse] = await Promise.all([
        fetch(getApiUrl(`/api/admin/users?${new URLSearchParams(params)}`)),
        fetch(getApiUrl("/api/admin/users?stats=true")),
      ]);

      const usersData = await usersResponse.json();
      const statsData = await statsResponse.json();

      if (usersData.success) {
        setUsers(usersData.users);
        setPagination(usersData.pagination);
        setSelectedUsers(new Set());
        setSelectAll(false);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.page, pagination.pageSize, search, statusFilter, sortBy, sortOrder, filters]);

  const handleUserAction = async (userId: string, action: "block" | "unblock", userEmail: string) => {
    if (!confirm(`Are you sure you want to ${action} ${userEmail}?`)) return;
    setActionLoading(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/users/manage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action,
          reason: action === "block" ? "Blocked by administrator" : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setActionSuccess(data.message);
        setTimeout(() => setActionSuccess(null), 5000);
        fetchUsers();
      } else {
        setActionError(data.error || "Failed to perform action");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to perform action");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearchUser = async () => {
    if (!resetEmail.trim()) {
      setSearchError("Please enter an email address");
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchedUser(null);
    setDeleteConfirmation("");
    try {
      const response = await fetch(getApiUrl(`/api/admin/users/search?email=${encodeURIComponent(resetEmail)}`));
      const data = await response.json();
      if (data.success) setSearchedUser(data.user);
      else setSearchError(data.error || "User not found");
    } catch (err: any) {
      setSearchError("Failed to search user");
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePermanentReset = async () => {
    if (deleteConfirmation !== "DELETE") {
      setSearchError("Please type DELETE to confirm");
      return;
    }
    if (!confirm(`⚠️ FINAL CONFIRMATION\n\nThis will PERMANENTLY delete all data for ${searchedUser.email}.\n\nThis action CANNOT be undone!`)) return;
    setResetting(true);
    setSearchError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/users/manage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: searchedUser.id, action: "permanent_reset" }),
      });
      const data = await response.json();
      if (data.success) {
        setActionSuccess(data.message);
        setSearchedUser(null);
        setResetEmail("");
        setDeleteConfirmation("");
        setTimeout(() => setActionSuccess(null), 10000);
        fetchUsers();
      } else {
        setSearchError(data.error || "Failed to reset account");
      }
    } catch (err: any) {
      setSearchError(err.message || "Failed to reset account");
    } finally {
      setResetting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(users.map((u) => u.id)));
    setSelectAll(!selectAll);
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) newSelected.delete(userId);
    else newSelected.add(userId);
    setSelectedUsers(newSelected);
    setSelectAll(newSelected.size === users.length && users.length > 0);
  };

  const handleExport = async () => {
    if (selectedUsers.size === 0) {
      alert("Please select at least one user to export");
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(getApiUrl("/api/admin/users/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedUsers), includeTransactions: true }),
      });
      if (!response.ok) throw new Error("Failed to export users");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setActionSuccess(`Exported ${selectedUsers.size} user(s)`);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (error: any) {
      setActionError(error.message || "Failed to export users");
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      minTransactions: "",
      maxTransactions: "",
      minSpent: "",
      maxSpent: "",
      transactionDateFrom: "",
      transactionDateTo: "",
      hasTransactions: "all",
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => (k !== "hasTransactions" ? v !== "" : v !== "all"));

  const getUserInitials = (u: User) => {
    if (u.email) return u.email.slice(0, 2).toUpperCase();
    if (u.walletAddress) return u.walletAddress.slice(2, 4).toUpperCase();
    return "U";
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {actionSuccess && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
          <p className="text-sm text-secondary font-medium">✓ {actionSuccess}</p>
        </div>
      )}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-sm text-red-400">{actionError}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.totalUsers, icon: "group", color: "secondary" },
          { label: "New Today", value: stats.newUsersToday, icon: "trending_up", color: "secondary" },
          { label: "Total Transactions", value: stats.totalTransactions, icon: "receipt_long", color: "secondary" },
          { label: "Total Revenue", value: `₦${stats.totalRevenue.toLocaleString()}`, icon: "payments", color: "secondary" },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl bg-surface/60 backdrop-blur-[16px] px-4 py-5 border border-accent/10 hover:border-secondary/30 transition-all"
          >
            <div className="absolute rounded-lg bg-secondary/10 p-3 border border-secondary/20">
              <span className={`material-icons-outlined text-secondary text-xl`}>{s.icon}</span>
            </div>
            <p className="ml-16 text-[10px] uppercase tracking-wider text-accent/60 font-bold">{s.label}</p>
            <p className="ml-16 text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-4 rounded-xl border border-accent/10">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary/70 text-lg">search</span>
            <input
              type="text"
              placeholder="Search by name, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-primary/50 border border-accent/10 rounded-lg text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                className="appearance-none bg-primary/50 border border-accent/10 rounded-lg py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">expand_more</span>
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-primary/50 border border-accent/10 rounded-lg py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
              >
                <option value="created_at">Date Joined</option>
                <option value="email">Email</option>
                <option value="referral_count">Referrals</option>
              </select>
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">expand_more</span>
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
              <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">expand_more</span>
            </div>
            <button
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              className="p-2.5 rounded-lg border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors"
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
            <button
              onClick={handleExport}
              disabled={selectedUsers.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-accent/10 rounded-lg text-sm font-medium text-accent/80 hover:text-secondary hover:border-secondary hover:bg-secondary/5 transition-all disabled:opacity-50"
            >
              <span className="material-icons-outlined text-lg">download</span>
              Export
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors text-sm"
          >
            <span className="material-icons-outlined text-lg">filter_alt</span>
            Advanced Filters
            {hasActiveFilters && <span className="bg-secondary/20 text-secondary text-xs px-2 py-0.5 rounded-full">Active</span>}
            <span>{showFilters ? "▲" : "▼"}</span>
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-accent/70 hover:text-white transition-colors">
              Clear Filters
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-primary/40 rounded-xl border border-accent/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Transaction Count</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={filters.minTransactions} onChange={(e) => handleFilterChange("minTransactions", e.target.value)} className="flex-1 bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
                <input type="number" placeholder="Max" value={filters.maxTransactions} onChange={(e) => handleFilterChange("maxTransactions", e.target.value)} className="flex-1 bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Amount Spent (₦)</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={filters.minSpent} onChange={(e) => handleFilterChange("minSpent", e.target.value)} className="flex-1 bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
                <input type="number" placeholder="Max" value={filters.maxSpent} onChange={(e) => handleFilterChange("maxSpent", e.target.value)} className="flex-1 bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Transaction Status</label>
              <select value={filters.hasTransactions} onChange={(e) => handleFilterChange("hasTransactions", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="all">All Users</option>
                <option value="yes">With Transactions</option>
                <option value="no">No Transactions</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Date From</label>
              <input type="date" value={filters.transactionDateFrom} onChange={(e) => handleFilterChange("transactionDateFrom", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-accent/60 mb-2 font-bold">Date To</label>
              <input type="date" value={filters.transactionDateTo} onChange={(e) => handleFilterChange("transactionDateTo", e.target.value)} className="w-full bg-primary border border-accent/10 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Export selected banner */}
      {selectedUsers.size > 0 && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-secondary font-medium">{selectedUsers.size} user(s) selected</span>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            {exporting ? <FSpinner size="xs" /> : <span className="material-icons-outlined text-primary">file_download</span>}
            Export Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="w-4 h-4 rounded border-accent/30 bg-primary text-secondary focus:ring-secondary cursor-pointer" title="Select all" />
                </th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Referrals</th>
                <th className="px-6 py-4">Transactions</th>
                <th className="px-6 py-4">Spent / Received</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-accent/60">No users found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="w-4 h-4 rounded border-accent/30 bg-primary text-secondary focus:ring-secondary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-surface-highlight flex items-center justify-center text-white font-bold border border-accent/10 group-hover:border-secondary/50 transition-colors">
                          {getUserInitials(user)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white group-hover:text-secondary transition-colors">{user.email || "—"}</div>
                          <div className="text-xs text-accent/50">
                            {user.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : user.referralCode || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{user.referralCount || 0}</td>
                    <td className="px-6 py-4 text-white font-bold">{user.totalTransactions}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="text-secondary font-medium">₦{user.totalSpentNGN.toLocaleString()}</span>
                        <span className="block text-xs text-accent/60">{parseFloat(user.totalReceivedSEND).toLocaleString()} $SEND</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5 animate-pulse" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.isBlocked ? (
                          <button
                            onClick={() => handleUserAction(user.id, "unblock", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="p-1.5 rounded text-accent/60 hover:text-secondary hover:bg-secondary/10 transition-colors disabled:opacity-50"
                            title="Unblock User"
                          >
                            <span className="material-icons-outlined text-lg">check_circle</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, "block", user.email || "")}
                            disabled={actionLoading === user.id}
                            className="p-1.5 rounded text-accent/60 hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                            title="Block User"
                          >
                            <span className="material-icons-outlined text-lg">block</span>
                          </button>
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
        <div className="px-6 py-4 border-t border-accent/10 flex items-center justify-between bg-accent/[0.02]">
          <p className="text-sm text-accent/70">
            Showing <span className="font-medium text-white">{Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}</span> to{" "}
            <span className="font-medium text-white">{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}</span> of{" "}
            <span className="font-medium text-white">{pagination.totalCount}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-accent/10 bg-primary/60 text-accent/70 hover:bg-accent/5 disabled:opacity-50 transition-colors"
            >
              <span className="material-icons-outlined text-sm">chevron_left</span>
            </button>
            <span className="px-3 text-sm text-accent/70">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-accent/10 bg-primary/60 text-accent/70 hover:bg-accent/5 disabled:opacity-50 transition-colors"
            >
              <span className="material-icons-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <DangerZone
        resetEmail={resetEmail}
        setResetEmail={setResetEmail}
        searchedUser={searchedUser}
        setSearchedUser={setSearchedUser}
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        searchError={searchError}
        searchLoading={searchLoading}
        resetting={resetting}
        onSearch={handleSearchUser}
        onReset={handlePermanentReset}
        onCancel={() => {
          setSearchedUser(null);
          setResetEmail("");
          setDeleteConfirmation("");
          setSearchError(null);
        }}
      />
    </div>
  );
}

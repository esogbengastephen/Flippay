"use client";

import { getApiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { KYC_TIERS, getKYCTierInfo, type KYCTier } from "@/lib/kyc-tiers";

interface User {
  id: string;
  email: string;
  display_name?: string;
  flutterwave_kyc_tier: number | null;
  flutterwave_nin?: string;
  created_at: string;
  kyc_first_name?: string;
  kyc_surname?: string;
  kyc_mobile_number?: string;
  kyc_date_of_birth?: string;
  kyc_gender?: string;
  kyc_address?: string;
  kyc_title?: string;
  kyc_state?: string;
  kyc_bvn_last4?: string;
  kyc_submitted_at?: string;
  kycTierInfo?: any;
  hasBVN?: boolean;
  canUpgrade?: boolean;
  zainpay_virtual_account_number?: string | null;
  zainpay_virtual_account_bank?: string | null;
  zainpay_virtual_account_name?: string | null;
  zainpay_virtual_account_created_at?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function KYCManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [selectedTier, searchTerm, pagination.page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (selectedTier !== "all") params.append("tier", selectedTier);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(getApiUrl(`/api/admin/kyc?${params.toString()}`));
      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTierUpdate = async (userId: string, newTier: number) => {
    if (!confirm(`Are you sure you want to update this user's KYC tier to Tier ${newTier}?`)) return;
    setUpdatingUserId(userId);
    try {
      const response = await fetch(getApiUrl("/api/admin/kyc"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier: newTier }),
      });
      const data = await response.json();
      if (data.success) {
        fetchUsers();
        alert(`KYC tier updated successfully to ${data.user?.kycTierInfo?.name || `Tier ${newTier}`}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error updating tier:", error);
      alert("Failed to update KYC tier");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const tierStats = {
    tier1: users.filter((u) => (u.flutterwave_kyc_tier || 1) === 1).length,
    tier2: users.filter((u) => u.flutterwave_kyc_tier === 2).length,
    tier3: users.filter((u) => u.flutterwave_kyc_tier === 3).length,
    total: pagination.total,
  };

  const getUserInitials = (u: User) => {
    if (u.display_name) return u.display_name.slice(0, 2).toUpperCase();
    if (u.email) return u.email.slice(0, 2).toUpperCase();
    return "U";
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4">
        <div className="relative w-full sm:w-80">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary/70 text-lg">search</span>
          <input
            type="text"
            placeholder="Search user by ID or Name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface/80 border border-secondary/20 rounded-lg text-sm text-white placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none shadow-inner"
          />
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tier 1 (Basic)", value: tierStats.tier1, icon: "hourglass_empty", sub: "No BVN" },
          { label: "Tier 2 (BVN Verified)", value: tierStats.tier2, icon: "verified_user", sub: "BVN Verified" },
          { label: "Tier 3 (Enhanced)", value: tierStats.tier3, icon: "verified_user", sub: "Enhanced KYC" },
          { label: "Total Users", value: tierStats.total, icon: "group", sub: "" },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl bg-surface/60 backdrop-blur-[16px] px-4 py-5 border border-accent/10 hover:border-secondary/30 transition-all"
          >
            <div className="absolute rounded-lg bg-secondary/10 p-3 border border-secondary/20">
              <span className="material-icons-outlined text-secondary text-xl">{s.icon}</span>
            </div>
            <p className="ml-16 text-[10px] uppercase tracking-wider text-accent/60 font-bold">{s.label}</p>
            <p className="ml-16 text-2xl font-bold text-white mt-1">{loading ? "..." : s.value.toLocaleString()}</p>
            {s.sub && <p className="ml-16 text-xs text-secondary font-medium mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tier Configurations */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <span className="w-1 h-6 bg-secondary rounded-full shadow-[0_0_10px_rgba(19,236,90,0.6)]" />
          Tier Configurations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([1, 2, 3] as const).map((tierNum) => {
            const t = KYC_TIERS[tierNum];
            const isPopular = tierNum === 2;
            return (
              <div
                key={tierNum}
                className={`rounded-xl p-6 border relative overflow-hidden transition-all ${
                  isPopular
                    ? "bg-gradient-to-b from-surface-highlight to-surface border-secondary/30 shadow-lg shadow-secondary/5"
                    : "bg-surface/60 backdrop-blur-[16px] border-accent/10 hover:border-secondary/30"
                }`}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isPopular ? "bg-secondary text-primary shadow-[0_0_10px_rgba(19,236,90,0.4)]" : "bg-secondary/10 border border-secondary/30 text-secondary"
                      }`}
                    >
                      T{tierNum}
                    </div>
                    <h4 className="text-xl font-bold text-white">{t.name.replace(`Tier ${tierNum} - `, "")}</h4>
                    {isPopular && (
                      <span className="ml-auto bg-secondary/20 text-secondary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border border-secondary/30">
                        Popular
                      </span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex justify-between text-sm">
                      <span className="text-accent/60">Daily Limit</span>
                      <span className="text-white font-medium">₦{t.dailyLimit.toLocaleString()}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span className="text-accent/60">Monthly Limit</span>
                      <span className="text-white font-medium">₦{t.monthlyLimit.toLocaleString()}</span>
                    </li>
                    <li className="flex justify-between text-sm">
                      <span className="text-accent/60">BVN Required</span>
                      {t.requiresBVN ? (
                        <span className="text-secondary text-xs font-medium bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">Yes</span>
                      ) : (
                        <span className="text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded">No</span>
                      )}
                    </li>
                  </ul>
                  <div className="border-t border-accent/10 pt-4">
                    <p className="text-[10px] text-accent/50 uppercase tracking-widest mb-2 font-bold">Requirements</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-surface-highlight/50 rounded text-xs text-accent/80 border border-accent/10">
                        {t.requiresBVN ? "BVN Verified" : "Email"}
                      </span>
                      {t.requiresEnhancedKYC && (
                        <span className="px-2 py-1 bg-surface-highlight/50 rounded text-xs text-accent/80 border border-accent/10">
                          Enhanced Docs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface/60 backdrop-blur-[16px] rounded-2xl border border-accent/10 overflow-hidden">
        <div className="p-6 border-b border-accent/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Users by KYC Tier
              <span className="bg-secondary/20 text-secondary text-xs px-2 py-0.5 rounded-full font-bold">
                {pagination.total}
              </span>
            </h3>
            <p className="text-accent/60 text-sm mt-1">View and manually update user KYC tiers.</p>
          </div>
          <div className="relative">
            <select
              value={selectedTier}
              onChange={(e) => {
                setSelectedTier(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="appearance-none bg-primary/60 border border-accent/10 rounded-lg py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-secondary focus:outline-none cursor-pointer"
            >
              <option value="all">All Tiers</option>
              <option value="1">Tier 1 - Basic</option>
              <option value="2">Tier 2 - BVN Verified</option>
              <option value="3">Tier 3 - Enhanced</option>
            </select>
            <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 text-accent/60 pointer-events-none text-sm">expand_more</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-accent/5 text-[10px] uppercase tracking-widest text-accent/70 font-bold border-b border-accent/10">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">KYC Tier</th>
                <th className="px-6 py-4">BVN Status</th>
                <th className="px-6 py-4">Zainpay KYC</th>
                <th className="px-6 py-4">Limits</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-accent/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-accent/60">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-accent/60">No users found</td>
                </tr>
              ) : (
                users.map((user) => {
                  const tier = (user.flutterwave_kyc_tier || 1) as KYCTier;
                  const tierInfo = user.kycTierInfo || getKYCTierInfo(tier);
                  return (
                    <tr key={user.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-surface-highlight flex items-center justify-center text-white font-bold text-xs border border-accent/10 shrink-0">
                            {getUserInitials(user)}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {user.kyc_first_name && user.kyc_surname
                                ? `${user.kyc_title ? user.kyc_title + " " : ""}${user.kyc_first_name} ${user.kyc_surname}`
                                : user.display_name || user.email}
                            </div>
                            <div className="text-xs text-accent/50">{user.email}</div>
                            {user.kyc_mobile_number && (
                              <div className="text-xs text-accent/50 mt-0.5">Mobile: {user.kyc_mobile_number}</div>
                            )}
                            {user.kyc_bvn_last4 && (
                              <div className="text-xs text-accent/50 mt-0.5">BVN: ****{user.kyc_bvn_last4}</div>
                            )}
                            {user.kyc_submitted_at && (
                              <div className="text-xs text-accent/40 mt-0.5">
                                KYC submitted {new Date(user.kyc_submitted_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tier === 2
                              ? "bg-secondary/10 text-secondary border border-secondary/20"
                              : tier === 3
                              ? "bg-secondary/10 text-secondary border border-secondary/20"
                              : "bg-surface-highlight/50 text-accent/80 border border-accent/10"
                          }`}
                        >
                          {tierInfo.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.hasBVN ? (
                          <span className="text-secondary text-xs font-bold">✓ Verified</span>
                        ) : (
                          <span className="text-amber-500 text-xs font-bold">Not Verified</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.kyc_submitted_at || user.zainpay_virtual_account_number ? (
                          <div className="text-xs space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-medium">
                              <span className="material-icons-outlined text-sm">account_balance</span>
                              Zainpay
                            </span>
                            {user.zainpay_virtual_account_number && (
                              <>
                                <p className="font-mono text-white font-medium mt-1">
                                  {user.zainpay_virtual_account_number}
                                </p>
                                <p className="text-accent/50">
                                  {user.zainpay_virtual_account_bank || "ZainBank"}
                                  {user.zainpay_virtual_account_name && ` · ${user.zainpay_virtual_account_name}`}
                                </p>
                              </>
                            )}
                            {user.kyc_submitted_at && (
                              <p className="text-accent/40">
                                Submitted {new Date(user.kyc_submitted_at).toLocaleDateString()}
                              </p>
                            )}
                            {(user.kyc_date_of_birth || user.kyc_state) && (
                              <p className="text-accent/40 truncate max-w-[180px]" title={[user.kyc_date_of_birth, user.kyc_state, user.kyc_address].filter(Boolean).join(" · ")}>
                                {[user.kyc_date_of_birth, user.kyc_state].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-accent/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-accent/80 text-xs">
                        <p>Daily: ₦{tierInfo.dailyLimit.toLocaleString()}</p>
                        <p>Monthly: ₦{tierInfo.monthlyLimit.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {tier < 2 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, 2)}
                              disabled={updatingUserId === user.id}
                              className="px-4 py-2 bg-secondary text-primary text-xs font-bold rounded-lg hover:brightness-110 transition-all shadow-[0_0_10px_rgba(19,236,90,0.3)] disabled:opacity-50 flex items-center gap-1"
                            >
                              <span className="material-icons-outlined text-sm">check</span>
                              {updatingUserId === user.id ? "Updating..." : "Upgrade to T2"}
                            </button>
                          )}
                          {tier < 3 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, 3)}
                              disabled={updatingUserId === user.id}
                              className="px-4 py-2 bg-secondary/10 border border-secondary/30 text-secondary text-xs font-bold rounded-lg hover:bg-secondary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <span className="material-icons-outlined text-sm">trending_up</span>
                              {updatingUserId === user.id ? "Updating..." : "Upgrade to T3"}
                            </button>
                          )}
                          {tier > 1 && (
                            <button
                              onClick={() => handleTierUpdate(user.id, tier - 1)}
                              disabled={updatingUserId === user.id}
                              className="px-4 py-2 bg-surface-highlight/50 border border-accent/10 text-accent/80 text-xs font-bold rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-50"
                            >
                              Downgrade
                            </button>
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
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-accent/10 flex items-center justify-between bg-accent/[0.02]">
            <span className="text-xs text-accent/50">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-xs rounded bg-primary/60 border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-xs rounded bg-primary/60 border border-accent/10 text-accent/70 hover:text-white hover:bg-accent/5 transition-colors disabled:opacity-50"
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

"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

interface EnhancedStats {
  // User stats
  totalUsers?: number;
  
  // Total volume processed (TV): all funds processed by the app
  totalVolumeProcessed?: number;
  
  // Onramp stats
  totalTransactions: number;
  totalRevenue: number;
  totalTokensDistributed: number;
  totalRevenueInSEND?: number;
  pendingPayments: number;
  successfulPayments: number;
  failedPayments: number;
  
  // Offramp stats
  offramp?: {
    total: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
      successRate: string;
    };
    base: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
    };
    solana: {
      transactions: number;
      completed: number;
      pending: number;
      failed: number;
      volume: number;
    };
  };
  
  // Multi-chain stats
  networkBreakdown?: {
    base: {
      onramp: number;
      offramp: number;
      total: number;
    };
    solana: {
      onramp: number;
      offramp: number;
      total: number;
    };
  };
  
  // Smart wallet stats
  smartWallets?: {
    totalUsers: number;
    usersWithSmartWallets: number;
    usersWithSolanaWallets: number;
    usersWithBothWallets: number;
    smartWalletAdoptionRate: string;
    solanaWalletAdoptionRate: string;
  };
  
  // KYC stats
  kyc?: {
    tier1: number;
    tier2: number;
    tier3: number;
    total: number;
  };
  
  // Revenue breakdown
  revenueBreakdown?: {
    onramp: number;
    offramp: number;
    total: number;
  };
  
  percentageChanges?: {
    totalTransactions: string;
    totalRevenue: string;
    totalTokensDistributed: string;
    totalVolumeProcessed?: string;
    pendingPayments: string;
    successfulPayments: string;
    failedPayments: string;
    offrampTransactions?: string;
    offrampVolume?: string;
  };
}

interface ChartData {
  date: string;
  revenue: number;
  transactions: number;
  tokens: number;
}

const COLORS = {
  primary: "#13EC5A",
  backgroundDark: "#05110B",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  surfaceHighlight: "#23423E",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<EnhancedStats>({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalTokensDistributed: 0,
    totalRevenueInSEND: 0,
    pendingPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<ChartData[]>([]);
  const [transactionData, setTransactionData] = useState<ChartData[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(getApiUrl("/api/admin/stats"));
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchChartData = async () => {
      try {
        const response = await fetch(getApiUrl("/api/admin/charts"));
        const data = await response.json();
        if (data.success) {
          setRevenueData(data.revenueData);
          setTransactionData(data.transactionData);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    };

    const fetchRecentActivity = async () => {
      try {
        const response = await fetch(getApiUrl("/api/admin/recent-activity"));
        const data = await response.json();
        if (data.success) {
          setRecentActivities(data.activities);
        }
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      }
    };

    fetchStats();
    fetchChartData();
    fetchRecentActivity();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchChartData();
      fetchRecentActivity();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Prepare KYC pie chart data
  const kycChartData = stats.kyc ? [
    { name: "Tier 1", value: stats.kyc.tier1, color: COLORS.warning },
    { name: "Tier 2", value: stats.kyc.tier2, color: COLORS.primary },
    { name: "Tier 3", value: stats.kyc.tier3, color: COLORS.success },
  ] : [];

  // Prepare network breakdown chart data
  const networkChartData = stats.networkBreakdown ? [
    { name: "Base", onramp: stats.networkBreakdown.base.onramp, offramp: stats.networkBreakdown.base.offramp },
    { name: "Solana", onramp: stats.networkBreakdown.solana.onramp, offramp: stats.networkBreakdown.solana.offramp },
  ] : [];

  // Prepare revenue breakdown chart data
  const revenueBreakdownData = stats.revenueBreakdown ? [
    { name: "Onramp", value: stats.revenueBreakdown.onramp || 0, color: COLORS.primary },
    { name: "Offramp", value: stats.revenueBreakdown.offramp || 0, color: COLORS.surfaceHighlight },
  ] : [];

  const statCards = [
    {
      title: "Total Volume (TV)",
      value: loading ? "..." : `₦${(stats.totalVolumeProcessed ?? stats.revenueBreakdown?.total ?? 0).toLocaleString()}`,
      icon: "savings",
      color: "bg-primary",
      change: stats.percentageChanges?.totalVolumeProcessed ?? "0%",
      subtitle: "All funds processed (onramp + offramp)",
    },
    {
      title: "Total Users",
      value: loading ? "..." : (stats.totalUsers || 0).toLocaleString(),
      icon: "people",
      color: "bg-primary",
      change: "0%",
    },
    {
      title: "Total Onramp Transactions",
      value: loading ? "..." : (stats.totalTransactions || 0).toLocaleString(),
      icon: "receipt_long",
      color: "bg-primary",
      change: stats.percentageChanges?.totalTransactions || "0%",
    },
    {
      title: "Total Revenue (NGN)",
      value: loading ? "..." : `₦${((stats.revenueBreakdown?.total || stats.totalRevenue || 0)).toLocaleString()}`,
      icon: "payments",
      color: "bg-primary",
      change: stats.percentageChanges?.totalRevenue || "0%",
    },
    {
      title: "Total Revenue ($SEND)",
      value: loading 
        ? "..." 
        : (stats.totalRevenueInSEND || 0) > 0 
          ? `${(stats.totalRevenueInSEND || 0).toLocaleString()} $SEND`
          : "0 $SEND",
      icon: "account_balance",
      color: "bg-primary",
      change: "0%",
    },
    {
      title: "Tokens Distributed",
      value: loading 
        ? "..." 
        : (stats.totalTokensDistributed || 0) > 0 
          ? `${(stats.totalTokensDistributed || 0).toLocaleString()} $SEND`
          : "0 $SEND",
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: stats.percentageChanges?.totalTokensDistributed || "0%",
    },
    {
      title: "Offramp Transactions",
      value: loading ? "..." : (stats.offramp?.total.transactions || 0).toLocaleString(),
      icon: "swap_horiz",
      color: "bg-primary",
      change: stats.percentageChanges?.offrampTransactions || "0%",
    },
    {
      title: "Offramp Volume (NGN)",
      value: loading ? "..." : `₦${((stats.offramp?.total.volume || 0)).toLocaleString()}`,
      icon: "trending_up",
      color: "bg-primary",
      change: stats.percentageChanges?.offrampVolume || "0%",
    },
    {
      title: "Smart Wallets",
      value: loading ? "..." : (stats.smartWallets?.usersWithSmartWallets || 0).toLocaleString(),
      icon: "account_balance_wallet",
      color: "bg-primary",
      change: `${stats.smartWallets?.smartWalletAdoptionRate || "0"}%`,
    },
    {
      title: "KYC Verified (Tier 2+)",
      value: loading ? "..." : ((stats.kyc?.tier2 || 0) + (stats.kyc?.tier3 || 0)).toLocaleString(),
      icon: "verified_user",
      color: "bg-primary",
      change: stats.kyc?.total ? `${(((stats.kyc.tier2 + stats.kyc.tier3) / stats.kyc.total) * 100).toFixed(1)}%` : "0%",
    },
    {
      title: "Pending Payments",
      value: loading ? "..." : (stats.pendingPayments || 0).toString(),
      icon: "schedule",
      color: "bg-warning",
      change: stats.percentageChanges?.pendingPayments || "0%",
    },
    {
      title: "Successful",
      value: loading ? "..." : (stats.successfulPayments || 0).toString(),
      icon: "check_circle",
      color: "bg-success",
      change: stats.percentageChanges?.successfulPayments || "0%",
    },
    {
      title: "Failed",
      value: loading ? "..." : (stats.failedPayments || 0).toString(),
      icon: "error",
      color: "bg-error",
      change: stats.percentageChanges?.failedPayments || "0%",
    },
  ];

  const topStats = [
    {
      title: "Total Volume",
      value: loading ? "..." : `₦${(stats.totalVolumeProcessed ?? stats.revenueBreakdown?.total ?? 0).toLocaleString()}`,
      icon: "savings",
      change: stats.percentageChanges?.totalVolumeProcessed ?? "0%",
      subtitle: "All funds processed (onramp + offramp)",
    },
    {
      title: "Active Users",
      value: loading ? "..." : (stats.totalUsers || 0).toLocaleString(),
      icon: "people",
      change: "0%",
    },
    {
      title: "Total Revenue (NGN)",
      value: loading ? "..." : `₦${((stats.revenueBreakdown?.total || stats.totalRevenue || 0)).toLocaleString()}`,
      icon: "payments",
      change: stats.percentageChanges?.totalRevenue || "0%",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header controls */}
      <header className="h-20 flex items-center justify-between gap-4 px-6 lg:px-8 border-b border-accent/10 bg-surface/95 backdrop-blur z-10">
        <div className="relative hidden sm:block flex-1 min-w-0 max-w-xs">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white">search</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-primary border border-accent/10 rounded-lg text-sm text-white focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none placeholder:text-accent/50"
              placeholder="Search data..."
              type="text"
            />
        </div>
        <button className="p-2 text-white hover:text-secondary transition-colors relative flex-shrink-0" aria-label="Notifications">
            <span className="material-icons-outlined">notifications</span>
            {(stats.pendingPayments || 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full shadow-[0_0_5px_rgba(19,236,90,0.8)]" />
            )}
        </button>
      </header>

      <div className="flex-1 overflow-auto pt-6 px-6 lg:px-8 pb-6 lg:pb-8">
        {/* Top 3 Stats - Flippay card style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {topStats.map((stat, index) => (
            <div
              key={index}
              className="bg-primary rounded-xl p-6 border border-accent/10 hover:border-secondary/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons-outlined text-6xl text-white">{stat.icon}</span>
              </div>
              <p className="text-sm font-medium text-accent/70 mb-1">{stat.title}</p>
              {"subtitle" in stat && stat.subtitle && (
                <p className="text-xs text-accent/50 mb-1">{stat.subtitle}</p>
              )}
              <div className="flex items-end gap-2">
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  {stat.value}
                </h3>
                <span className={`text-sm font-semibold mb-1 flex items-center ${
                  stat.change.startsWith("+") ? "text-secondary" : stat.change.startsWith("-") ? "text-red-400" : "text-accent/60"
                }`}>
                  <span className="material-icons-outlined text-sm text-white">trending_up</span> {stat.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-primary rounded-xl border border-accent/10 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Revenue Trends
                  <span className="bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded border border-secondary/20">SEND/NGN</span>
                </h3>
                <p className="text-xs text-accent/60 mt-1">Last 30 days</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                  <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#11281A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    formatter={(value: number | undefined) => value != null ? [`₦${value?.toLocaleString()}`, "Revenue"] : ["", "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#13EC5A" strokeWidth={2} name="Revenue (NGN)" dot={{ fill: "#13EC5A", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-primary rounded-xl border border-accent/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-4">
              <Link
                href="/admin/users"
                className="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <span className="material-icons-outlined">block</span>
                  </div>
                  <div className="text-left">
                    <span className="block text-white font-semibold">Block User</span>
                    <span className="text-xs text-accent/60">Restrict account access</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-white transition-colors">arrow_forward_ios</span>
              </Link>
              <Link
                href="/admin/payments"
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/5 border border-secondary/20 hover:bg-secondary/10 hover:border-secondary/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <span className="material-icons-outlined">verified</span>
                  </div>
                  <div className="text-left">
                    <span className="block text-white font-semibold">Verify Payment</span>
                    <span className="text-xs text-accent/60">Manual TX confirmation</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-white transition-colors">arrow_forward_ios</span>
              </Link>
              <Link
                href="/admin/price-action"
                className="flex items-center justify-between p-4 rounded-lg bg-accent/5 border border-accent/10 hover:bg-accent/10 hover:border-secondary/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <span className="material-icons-outlined">percent</span>
                  </div>
                  <div className="text-left">
                    <span className="block text-white font-semibold">Adjust Margins</span>
                    <span className="text-xs text-accent/60">Global fee settings</span>
                  </div>
                </div>
                <span className="material-icons-outlined text-white/20 group-hover:text-white transition-colors">arrow_forward_ios</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-primary rounded-xl border border-accent/10 overflow-hidden mb-8">
          <div className="p-6 border-b border-accent/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Recent Activity</h3>
            <Link href="/admin/transactions" className="text-xs text-secondary hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-accent/70">
              <thead className="bg-accent/5 text-xs uppercase font-medium text-white">
                <tr>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">User / ID</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-accent/60">Loading...</td>
                  </tr>
                ) : recentActivities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-accent/60">No recent activity</td>
                  </tr>
                ) : (
                  recentActivities.slice(0, 5).map((activity, i) => (
                    <tr key={i} className="hover:bg-accent/5 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          activity.type === "completed" ? "bg-secondary shadow-[0_0_5px_rgba(19,236,90,0.8)]" :
                          activity.type === "failed" ? "bg-red-500" : "bg-yellow-500"
                        }`} />
                        {activity.message}
                      </td>
                      <td className="px-6 py-4 text-white">{activity.wallet || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          activity.type === "completed" ? "bg-secondary/10 text-secondary border-secondary/20" :
                          activity.type === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                        }`}>
                          {activity.type === "completed" ? "Completed" : activity.type === "failed" ? "Failed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{activity.time}</td>
                      <td className="px-6 py-4 text-right">
                        {activity.txHash ? (
                          <a href={`https://basescan.org/tx/${activity.txHash}`} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
                            Details
                          </a>
                        ) : (
                          <span className="text-accent/50">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Stats Grid - keep our project content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {statCards.slice(3).map((stat, index) => (
            <div
              key={index}
              className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10 hover:border-secondary/30 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-accent/10">
                  <span className="material-icons-outlined text-white">
                    {stat.icon}
                  </span>
                </div>
                <span className={`text-sm font-medium ${
                  stat.change.startsWith("+") ? "text-secondary" : stat.change.startsWith("-") ? "text-red-400" : "text-accent/60"
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-medium text-accent/70 mb-1">{stat.title}</h3>
              {"subtitle" in stat && stat.subtitle && (
                <p className="text-xs text-accent/50 mb-1">{stat.subtitle}</p>
              )}
              <p className="text-xl sm:text-2xl font-bold text-white">
                {loading ? "..." : stat.value}
              </p>
            </div>
          ))}
        </div>

      {/* Network Breakdown Section */}
      {stats.offramp && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              Base Network
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-accent/70">Transactions</p>
                <p className="text-2xl font-bold text-white">
                  {stats.offramp.base.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Volume</p>
                <p className="text-xl font-bold text-secondary">₦{stats.offramp.base.volume.toLocaleString()}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-accent/60">Completed</p>
                  <p className="text-lg font-semibold text-secondary">{stats.offramp.base.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-accent/60">Pending</p>
                  <p className="text-lg font-semibold text-yellow-500">{stats.offramp.base.pending}</p>
                </div>
                <div>
                  <p className="text-xs text-accent/60">Failed</p>
                  <p className="text-lg font-semibold text-red-400">{stats.offramp.base.failed}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              Solana Network
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-accent/70">Transactions</p>
                <p className="text-2xl font-bold text-white">
                  {stats.offramp.solana.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Volume</p>
                <p className="text-xl font-bold text-secondary">₦{stats.offramp.solana.volume.toLocaleString()}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-accent/70">Completed</p>
                  <p className="text-lg font-semibold text-success">{stats.offramp.solana.completed}</p>
                </div>
                <div>
                  <p className="text-xs text-accent/70">Pending</p>
                  <p className="text-lg font-semibold text-warning">{stats.offramp.solana.pending}</p>
                </div>
                <div>
                  <p className="text-xs text-accent/70">Failed</p>
                  <p className="text-lg font-semibold text-error">{stats.offramp.solana.failed}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              Offramp Summary
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-accent/70">Total Transactions</p>
                <p className="text-2xl font-bold text-white">
                  {stats.offramp.total.transactions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Total Volume</p>
                <p className="text-xl font-bold text-secondary">₦{stats.offramp.total.volume.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Success Rate</p>
                <p className="text-xl font-bold text-secondary">{stats.offramp.total.successRate}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Wallet & KYC Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {stats.smartWallets && (
          <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              Smart Wallet Adoption
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-accent/70">Base Wallets</p>
                  <p className="text-2xl font-bold text-secondary">{stats.smartWallets.usersWithSmartWallets.toLocaleString()}</p>
                  <p className="text-xs text-accent/60 mt-1">
                    {stats.smartWallets.smartWalletAdoptionRate}% adoption
                  </p>
                </div>
                <div>
                  <p className="text-sm text-accent/70">Solana Wallets</p>
                  <p className="text-2xl font-bold text-secondary">{stats.smartWallets.usersWithSolanaWallets.toLocaleString()}</p>
                  <p className="text-xs text-accent/60 mt-1">
                    {stats.smartWallets.solanaWalletAdoptionRate}% adoption
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-accent/70">Users with Both</p>
                <p className="text-xl font-bold text-white">
                  {stats.smartWallets.usersWithBothWallets.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Total Users</p>
                <p className="text-lg font-semibold text-white">
                  {stats.smartWallets.totalUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {stats.kyc && (
          <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              KYC Tier Distribution
            </h2>
            <div className="space-y-4">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kycChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {kycChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-accent/60">Tier 1</p>
                  <p className="text-lg font-bold text-amber-500">{stats.kyc.tier1}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-accent/60">Tier 2</p>
                  <p className="text-lg font-bold text-secondary">{stats.kyc.tier2}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-accent/60">Tier 3</p>
                  <p className="text-lg font-bold text-secondary">{stats.kyc.tier3}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revenue Breakdown */}
      {stats.revenueBreakdown && (
        <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
            Revenue Breakdown by Service Type
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | undefined) => value != null ? `₦${value.toLocaleString()}` : ""} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-accent/70">Onramp Revenue</p>
                <p className="text-2xl font-bold text-secondary">₦{(stats.revenueBreakdown?.onramp || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Offramp Revenue</p>
                <p className="text-2xl font-bold text-secondary">₦{(stats.revenueBreakdown?.offramp || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-accent/70">Total Revenue</p>
                <p className="text-3xl font-bold text-white">
                  ₦{(stats.revenueBreakdown?.total || stats.totalRevenue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Breakdown Chart */}
      {networkChartData.length > 0 && (
        <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
            Network Revenue Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={networkChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number | undefined) => value != null ? `₦${value.toLocaleString()}` : ""}
                contentStyle={{ backgroundColor: "#11281A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
              />
              <Legend />
              <Bar dataKey="onramp" fill="#13EC5A" name="Onramp" radius={[8, 8, 0, 0]} />
              <Bar dataKey="offramp" fill="#23423E" name="Offramp" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-primary p-4 sm:p-6 rounded-xl border border-accent/10">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
            Revenue Trends (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#11281A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                formatter={(value: number | undefined) => value != null ? [`₦${value.toLocaleString()}`, "Revenue"] : ["", "Revenue"]}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#13EC5A" strokeWidth={2} name="Revenue (NGN)" dot={{ fill: "#13EC5A", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-primary p-6 rounded-xl border border-accent/10">
          <h2 className="text-xl font-bold text-white mb-4">
            Transaction Volume (Last 30 Days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#11281A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                formatter={(value: number | undefined) => [value ?? 0, "Transactions"]}
              />
              <Legend />
              <Bar dataKey="transactions" fill="#13EC5A" name="Transactions" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      </div>
    </div>
  );
}

"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";

interface UtilityService {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "disabled";
  apiEndpoint?: string;
  supportedNetworks?: string[];
  category: "airtime" | "data" | "tv" | "betting" | "school" | "electricity" | "other";
  markup?: number; // Percentage markup
  minAmount?: number;
  maxAmount?: number;
}

interface NetworkPrice {
  network: string;
  markup: number;
  enabled: boolean;
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export default function UtilityPage() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingService, setEditingService] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<{ balance: string; date?: string | null; id?: string | null; phoneno?: string | null } | null>(null);

  // Utility services with default prices
  const [utilityServices, setUtilityServices] = useState<UtilityService[]>([
    {
      id: "airtime",
      name: "Airtime",
      description: "Purchase airtime for all major networks (MTN, Airtel, Glo, 9mobile). Instant top-up with competitive rates.",
      icon: "phone_android",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetAirTimeV1.asp",
      supportedNetworks: ["MTN", "Airtel", "Glo", "9mobile"],
      category: "airtime",
      markup: 2.5, // 2.5% markup
      minAmount: 50,
      maxAmount: 10000,
    },
    {
      id: "data",
      name: "Data Bundle",
      description: "Buy data bundles for all networks. Various plans available from daily to monthly subscriptions.",
      icon: "data_usage",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetDataV1.asp",
      supportedNetworks: ["MTN", "Airtel", "Glo", "9mobile"],
      category: "data",
      markup: 3.0,
      minAmount: 100,
      maxAmount: 50000,
    },
    {
      id: "tv",
      name: "Cable TV Subscription",
      description: "Subscribe to DStv, GOtv, and Startimes. Monthly and yearly packages available.",
      icon: "tv",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetCableTVV1.asp",
      supportedNetworks: ["DStv", "GOtv", "Startimes"],
      category: "tv",
      markup: 2.0,
      minAmount: 1000,
      maxAmount: 50000,
    },
    {
      id: "betting",
      name: "Betting Wallet Funding",
      description: "Fund betting wallets for major platforms. Instant funding with secure transactions.",
      icon: "sports_esports",
      status: "active",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetBettingV1.asp",
      category: "betting",
      markup: 2.5,
      minAmount: 100,
      maxAmount: 100000,
    },
    {
      id: "school",
      name: "School e-PINs",
      description: "Purchase WAEC and JAMB e-PINs for students. Secure and instant delivery.",
      icon: "school",
      status: "disabled",
      apiEndpoint: "https://www.clubkonnect.com/APIParaGetSchoolV1.asp",
      supportedNetworks: ["WAEC", "JAMB"],
      category: "school",
      markup: 1.5,
      minAmount: 1000,
      maxAmount: 10000,
    },
    {
      id: "electricity",
      name: "Electricity Bill Payment",
      description: "Pay electricity bills for EKEDC, IKEDC, AEDC, and other providers.",
      icon: "bolt",
      status: "active",
      apiEndpoint: "https://www.nellobytesystems.com/APIElectricityV1.asp",
      supportedNetworks: ["EKEDC", "IKEDC", "AEDC", "PHED", "KEDCO", "EEDC", "IBEDC", "KAEDCO", "JED", "YEDC"],
      category: "electricity",
      markup: 2.0,
      minAmount: 100,
      maxAmount: 100000,
    },
  ]);

  const [networkPrices, setNetworkPrices] = useState<Record<string, NetworkPrice[]>>({});

  const categories = [
    { id: "all", name: "All Services", icon: "apps" },
    { id: "airtime", name: "Airtime", icon: "phone_android" },
    { id: "data", name: "Data", icon: "data_usage" },
    { id: "tv", name: "TV", icon: "tv" },
    { id: "betting", name: "Betting", icon: "sports_esports" },
    { id: "school", name: "School", icon: "school" },
    { id: "electricity", name: "Electricity", icon: "bolt" },
  ];

  const filteredServices = selectedCategory === "all"
    ? utilityServices
    : utilityServices.filter(service => service.category === selectedCategory);

  // Fetch utility settings on mount
  useEffect(() => {
    if (address) {
      fetchUtilitySettings();
    } else {
      const t = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(t);
    }
  }, [address]);

  // Fetch wallet balance when admin is connected (optional; user can also click Refresh)
  useEffect(() => {
    if (address) fetchWalletBalance();
  }, [address]);

  const fetchUtilitySettings = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/admin/utility?adminWallet=${address}`));
      const data = await response.json();
      
      if (data.success && data.services) {
        setUtilityServices(data.services);
        if (data.networkPrices) {
          setNetworkPrices(data.networkPrices);
        }
      }
    } catch (error) {
      console.error("Error fetching utility settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletBalance = async () => {
    if (!address) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const response = await fetch(getApiUrl(`/api/admin/utility/balance?adminWallet=${address}`));
      const data = await response.json();
      if (data.success) {
        setWalletBalance({
          balance: data.balance,
          date: data.date ?? null,
          id: data.id ?? null,
          phoneno: data.phoneno ?? null,
        });
      } else {
        setBalanceError(data.error || "Failed to load balance");
        setWalletBalance(null);
      }
    } catch (err) {
      console.error("Error fetching wallet balance:", err);
      setBalanceError("Failed to fetch balance");
      setWalletBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const saveServiceSettings = async (serviceId: string) => {
    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const service = utilityServices.find(s => s.id === serviceId);
      if (!service) return;

      const response = await fetch(getApiUrl("/api/admin/utility"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminWallet: address,
          serviceId,
          service: {
            status: service.status,
            markup: service.markup,
            minAmount: service.minAmount,
            maxAmount: service.maxAmount,
          },
          networkPrices: networkPrices[serviceId] || [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`${service.name} settings saved successfully!`);
        setEditingService(null);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save settings");
        setTimeout(() => setError(null), 5000);
      }
    } catch (error: any) {
      console.error("Error saving utility settings:", error);
      setError(error.message || "Failed to save settings");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const updateService = (serviceId: string, updates: Partial<UtilityService>) => {
    setUtilityServices(prev => prev.map(service => 
      service.id === serviceId ? { ...service, ...updates } : service
    ));
  };

  const updateNetworkPrice = (serviceId: string, network: string, updates: Partial<NetworkPrice>) => {
    setNetworkPrices(prev => {
      const current = prev[serviceId] || [];
      const existing = current.find(np => np.network === network);
      
      if (existing) {
        return {
          ...prev,
          [serviceId]: current.map(np => 
            np.network === network ? { ...np, ...updates } : np
          ),
        };
      } else {
        return {
          ...prev,
          [serviceId]: [...current, { network, markup: 0, enabled: true, ...updates }],
        };
      }
    });
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-secondary/20 text-secondary border-secondary/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";
  };

  if (loading) {
    return <PageLoadingSpinner message="Loading utility settings..." bgClass="bg-background-dark" />;
  }

  return (
    <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 space-y-6 lg:space-y-8">
      {/* Header controls */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-surface/60 backdrop-blur-[16px] border border-accent/10 rounded-full flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs font-semibold text-secondary">SYSTEM LIVE</span>
          </div>
          <button
            onClick={() => address && fetchUtilitySettings()}
            disabled={!address}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-full font-bold text-sm hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary">refresh</span>
            Force Sync
          </button>
        </div>
      </header>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
          <p className="text-secondary text-sm font-medium flex items-center gap-2">
            <span className="material-icons-outlined text-lg">check_circle</span>
            {success}
          </p>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium flex items-center gap-2">
            <span className="material-icons-outlined text-lg">error</span>
            {error}
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10 border-l-4 border-l-secondary">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center">
              <span className="material-icons-outlined text-secondary text-2xl">apps</span>
            </div>
          </div>
          <p className="text-accent/70 text-sm mb-1 font-medium">Total Services</p>
          <h2 className="text-xl font-bold text-white">{utilityServices.length}</h2>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10 border-l-4 border-l-secondary">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center">
              <span className="material-icons-outlined text-secondary text-2xl">check_circle</span>
            </div>
            <span className="text-[10px] font-bold text-secondary uppercase">Active</span>
          </div>
          <p className="text-accent/70 text-sm mb-1 font-medium">Active Services</p>
          <h2 className="text-xl font-bold text-white">
            {utilityServices.filter(s => s.status === "active").length}
          </h2>
        </div>
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10 border-l-4 border-l-amber-500">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
              <span className="material-icons-outlined text-amber-500 text-2xl">block</span>
            </div>
            <span className="text-[10px] font-bold text-amber-500 uppercase">Disabled</span>
          </div>
          <p className="text-accent/70 text-sm mb-1 font-medium">Disabled Services</p>
          <h2 className="text-xl font-bold text-white">
            {utilityServices.filter(s => s.status === "disabled").length}
          </h2>
        </div>
      </div>

      {/* API Provider Info */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">API Provider: ClubKonnect</h2>
            <p className="text-sm text-accent/70 mt-1">Utility Services Platform</p>
          </div>
          <a
            href="https://www.clubkonnect.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-white transition-colors text-sm font-medium"
          >
            Visit Website →
          </a>
        </div>
      </div>

      {/* Check Wallet Balance API (ClubKonnect / Nellobytes) */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">account_balance_wallet</span>
          Check Wallet Balance API
        </h2>
        <p className="text-sm text-accent/70 mb-4">
          ClubKonnect / Nellobytes wallet balance (APIWalletBalanceV1). Credentials are used server-side only.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => address && fetchWalletBalance()}
            disabled={!address || balanceLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {balanceLoading ? (
              <>
                <span className="material-icons-outlined animate-spin text-lg">refresh</span>
                Loading…
              </>
            ) : (
              <>
                <span className="material-icons-outlined text-lg">refresh</span>
                Refresh balance
              </>
            )}
          </button>
          {walletBalance && (
            <div className="flex flex-wrap items-baseline gap-6 text-sm">
              <span className="text-accent/70">Balance:</span>
              <span className="text-xl font-bold text-secondary">₦{Number(walletBalance.balance).toLocaleString()}</span>
              {walletBalance.date && <span className="text-accent/60">Date: {walletBalance.date}</span>}
              {walletBalance.id && <span className="text-accent/60">ID: {walletBalance.id}</span>}
              {walletBalance.phoneno && <span className="text-accent/60">Phone: {walletBalance.phoneno}</span>}
            </div>
          )}
        </div>
        {balanceError && (
          <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
            <span className="material-icons-outlined text-lg">error</span>
            {balanceError}
          </p>
        )}
      </div>

      {/* Category Filter */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">filter_list</span>
          Filter by Category
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? "bg-secondary/20 text-secondary border border-secondary/30"
                  : "bg-primary/40 border border-accent/10 text-accent/80 hover:bg-accent/10 hover:text-white"
              }`}
            >
              <span className="material-icons-outlined text-lg text-white">{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className={`bg-surface/60 backdrop-blur-[16px] p-4 rounded-xl border border-accent/10 relative overflow-hidden border-l-4 ${
              service.status === "active" ? "border-l-secondary" : "border-l-amber-500"
            }`}
          >
            {/* Service Header */}
            <div className="flex justify-between items-start gap-2 mb-2 min-w-0">
              <div className="w-9 h-9 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
                <span className="material-icons-outlined text-secondary text-lg">{service.icon}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="cursor-pointer">
                  <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    service.status === "active" ? "bg-secondary" : "bg-accent/20"
                  }`}>
                    <input
                      type="checkbox"
                      checked={service.status === "active"}
                      onChange={(e) => updateService(service.id, { status: e.target.checked ? "active" : "disabled" })}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        service.status === "active" ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </div>
                </label>
                <button
                  onClick={() => setEditingService(editingService === service.id ? null : service.id)}
                  className="p-1.5 bg-primary/40 border border-accent/10 text-accent/80 rounded-lg hover:bg-accent/10 hover:text-white transition-colors"
                  title={editingService === service.id ? "Cancel" : "Configure"}
                >
                  <span className="material-icons-outlined text-base">
                    {editingService === service.id ? "close" : "settings"}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${getStatusColor(service.status)}`}>
                {service.status === "active" ? "ACTIVE" : "DISABLED"}
              </span>
              <span className="text-[10px] text-accent/60 capitalize">{service.category}</span>
            </div>
            <h3 className="text-base font-bold text-white mb-2">{service.name}</h3>

            {/* Service Description */}
            <p className="text-[11px] text-accent/70 mb-3 line-clamp-2 leading-tight">{service.description}</p>

            {/* Current Settings Summary */}
            {editingService !== service.id && (
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-primary/40 p-1.5 rounded text-center">
                  <p className="text-[9px] text-accent/60">Markup</p>
                  <p className="text-xs font-bold text-white">{service.markup?.toFixed(1)}%</p>
                </div>
                <div className="bg-primary/40 p-1.5 rounded text-center">
                  <p className="text-[9px] text-accent/60">Min</p>
                  <p className="text-xs font-bold text-white truncate" title={`₦${service.minAmount?.toLocaleString()}`}>₦{formatCompact(service.minAmount ?? 0)}</p>
                </div>
                <div className="bg-primary/40 p-1.5 rounded text-center">
                  <p className="text-[9px] text-accent/60">Max</p>
                  <p className="text-xs font-bold text-white truncate" title={`₦${service.maxAmount?.toLocaleString()}`}>₦{formatCompact(service.maxAmount ?? 0)}</p>
                </div>
                <div className="bg-primary/40 p-1.5 rounded text-center">
                  <p className="text-[9px] text-accent/60">Nets</p>
                  <p className="text-xs font-bold text-white">{service.supportedNetworks?.length || 0}</p>
                </div>
              </div>
            )}

            {/* Configuration Form */}
            {editingService === service.id && (
              <div className="border-t border-accent/10 pt-3 mt-3 space-y-3">
                <h4 className="text-sm font-semibold text-white mb-2">Price Configuration</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Markup (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={service.markup || 0}
                      onChange={(e) => updateService(service.id, { markup: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                      placeholder="2.5"
                    />
                    <p className="text-xs text-accent/60 mt-1">Percentage added to base price</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Min Amount (₦)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={service.minAmount || 0}
                      onChange={(e) => updateService(service.id, { minAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Max Amount (₦)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={service.maxAmount || 0}
                      onChange={(e) => updateService(service.id, { maxAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                      placeholder="10000"
                    />
                  </div>
                </div>

                {/* Network-Specific Pricing */}
                {service.supportedNetworks && service.supportedNetworks.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-semibold text-white mb-3">Network-Specific Pricing</h5>
                    <div className="space-y-2">
                      {service.supportedNetworks.map((network) => {
                        const networkPrice = networkPrices[service.id]?.find(np => np.network === network) || {
                          network,
                          markup: service.markup || 0,
                          enabled: true,
                        };
                        return (
                          <div key={network} className="flex items-center gap-4 p-3 bg-primary/40 rounded-xl border border-accent/10">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">{network}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer">
                                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  networkPrice.enabled ? "bg-secondary" : "bg-accent/20"
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={networkPrice.enabled}
                                    onChange={(e) => updateNetworkPrice(service.id, network, { enabled: e.target.checked })}
                                    className="sr-only"
                                  />
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                      networkPrice.enabled ? "translate-x-5" : "translate-x-1"
                                    }`}
                                  />
                                </div>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={networkPrice.markup}
                                onChange={(e) => updateNetworkPrice(service.id, network, { markup: parseFloat(e.target.value) || 0 })}
                                className="w-24 rounded-lg border border-accent/10 bg-primary text-white px-2 py-1 text-sm focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50"
                                placeholder="2.5"
                                disabled={!networkPrice.enabled}
                              />
                              <span className="text-sm text-accent/60">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* API Endpoint Info */}
                {service.apiEndpoint && (
                  <div className="mt-4 p-3 bg-primary/40 rounded-xl border border-accent/10">
                    <p className="text-xs font-medium text-accent/60 mb-1">API Endpoint:</p>
                    <a
                      href={service.apiEndpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-secondary hover:text-white break-all transition-colors"
                    >
                      {service.apiEndpoint}
                    </a>
                  </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end gap-2 pt-4 border-t border-accent/10">
                  <button
                    onClick={() => setEditingService(null)}
                    className="px-4 py-2 bg-primary/40 border border-accent/10 text-accent/80 rounded-xl hover:bg-accent/10 hover:text-white transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveServiceSettings(service.id)}
                    disabled={saving}
                    className="px-4 py-2 bg-secondary text-primary font-bold rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <FSpinner size="xs" />
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


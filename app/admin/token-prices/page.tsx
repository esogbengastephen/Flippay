"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getTokenLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";

export default function TokenPricesPage() {
  const { address } = useAccount();
  const [prices, setPrices] = useState({
    SEND: "",
    USDC: "",
    USDT: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [priceDetails, setPriceDetails] = useState<Record<string, { price: number; updated_at: string; updated_by: string | null }>>({});

  useEffect(() => {
    if (address) {
      fetchPrices();
    } else {
      // When no wallet connected, stop loading after wagmi settles
      const t = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(t);
    }
  }, [address]);

  const fetchPrices = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl("/api/admin/token-prices"), {
        headers: {
          Authorization: `Bearer ${address}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Set prices for editing
        setPrices({
          SEND: data.prices.SEND ? data.prices.SEND.toString() : "",
          USDC: data.prices.USDC ? data.prices.USDC.toString() : "",
          USDT: data.prices.USDT ? data.prices.USDT.toString() : "",
        });
        if (data.priceDetails) {
          setPriceDetails(data.priceDetails);
        }
      } else {
        setError(data.error || "Failed to fetch token prices");
      }
    } catch (err: any) {
      console.error("Error fetching token prices:", err);
      setError(err.message || "Failed to fetch token prices");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!address) return;

    // Validate prices
    const priceValues: Record<string, number> = {};
    let hasError = false;

    for (const [token, priceStr] of Object.entries(prices)) {
      if (priceStr.trim() === "") {
        continue; // Skip empty fields
      }
      const price = parseFloat(priceStr);
      if (isNaN(price) || price <= 0) {
        setError(`Invalid price for ${token}. Must be a positive number.`);
        hasError = true;
        break;
      }
      priceValues[token] = price;
    }

    if (hasError) {
      return;
    }

    if (Object.keys(priceValues).length === 0) {
      setError("At least one price must be provided");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(getApiUrl("/api/admin/token-prices"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${address}`,
        },
        body: JSON.stringify({
          prices: priceValues,
          walletAddress: address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Token prices updated successfully!");
        // Update displayed prices
        setPrices({
          SEND: data.prices.SEND ? data.prices.SEND.toString() : "",
          USDC: data.prices.USDC ? data.prices.USDC.toString() : "",
          USDT: data.prices.USDT ? data.prices.USDT.toString() : "",
        });
        // Refresh price details
        await fetchPrices();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to update token prices");
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      console.error("Error updating token prices:", err);
      setError(err.message || "Failed to update token prices");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatWalletAddress = (address: string | null) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <FSpinner size="md" className="mb-4" />
          <p className="text-accent/70">Loading token prices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg space-y-4">
        {/* Success Message */}
        {success && (
          <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3">
            <p className="text-secondary text-sm font-medium flex items-center gap-2">
              <span className="material-icons-outlined text-base">check_circle</span>
              {success}
            </p>
          </div>
        )}

        {/* Connect wallet prompt when no address */}
        {!address && (
          <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3">
            <p className="text-white text-sm font-medium flex items-center gap-2">
              <span className="material-icons-outlined text-base">info</span>
              Connect your wallet to fetch and save token prices.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="text-red-400 text-sm font-medium flex items-center gap-2">
              <span className="material-icons-outlined text-base">error</span>
              {error}
            </p>
          </div>
        )}

        {/* Price Management Form - auth card size */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] border border-secondary/10 shadow-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary text-lg">attach_money</span>
          Update Buy Prices
        </h2>

        <div className="space-y-4">
          {/* SEND Token */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center overflow-hidden">
              <img
                src={getTokenLogo("SEND")}
                alt="SEND"
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">
                SEND Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.SEND}
                onChange={(e) => setPrices({ ...prices, SEND: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2.5 text-sm placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              />
              {priceDetails.SEND && (
                <p className="text-[10px] text-accent/60 mt-2">
                  Last updated: {formatDate(priceDetails.SEND.updated_at)} by {formatWalletAddress(priceDetails.SEND.updated_by)}
                </p>
              )}
            </div>
          </div>

          {/* USDC Token */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center overflow-hidden">
              <img
                src={getTokenLogo("USDC")}
                alt="USDC"
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">
                USDC Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.USDC}
                onChange={(e) => setPrices({ ...prices, USDC: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2.5 text-sm placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              />
              {priceDetails.USDC && (
                <p className="text-[10px] text-accent/60 mt-2">
                  Last updated: {formatDate(priceDetails.USDC.updated_at)} by {formatWalletAddress(priceDetails.USDC.updated_by)}
                </p>
              )}
            </div>
          </div>

          {/* USDT Token */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center overflow-hidden">
              <img
                src={getTokenLogo("USDT")}
                alt="USDT"
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://via.placeholder.com/48";
                }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">
                USDT Token (NGN)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prices.USDT}
                onChange={(e) => setPrices({ ...prices, USDT: e.target.value })}
                placeholder="Enter buy price in NGN"
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-3 py-2.5 text-sm placeholder-accent/40 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
              />
              {priceDetails.USDT && (
                <p className="text-[10px] text-accent/60 mt-2">
                  Last updated: {formatDate(priceDetails.USDT.updated_at)} by {formatWalletAddress(priceDetails.USDT.updated_by)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-secondary text-primary font-bold px-6 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons-outlined text-sm font-bold text-primary">save</span>
            {saving ? "Saving..." : "Save Prices"}
          </button>
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium border border-accent/20 text-accent/80 hover:bg-accent/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-icons-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>
      </div>

        {/* Info Box */}
        <div className="bg-primary/40 border border-accent/10 rounded-xl p-3 mt-4">
          <p className="text-accent/80 text-xs flex items-start gap-2">
            <span className="material-icons-outlined text-secondary text-base flex-shrink-0">info</span>
            <span>
              <strong className="text-white">Note:</strong> These prices are used as buy prices for tokens. Stored in the database.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

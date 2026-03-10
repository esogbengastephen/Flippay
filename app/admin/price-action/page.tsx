"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import FSpinner from "@/components/FSpinner";

type Tab = "buy" | "sell";

export default function PriceActionPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("buy");
  const [livePrices, setLivePrices] = useState<{
    SEND: number | null;
    USDC: number | null;
    USDT: number | null;
    pricesNGN?: Record<string, number | null>;
    pricesNGNSell?: Record<string, number | null>;
    source?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CoinGecko, Transaction Status, Minimum Purchase (shared for BUY & SELL)
  const [coingeckoPrice, setCoingeckoPrice] = useState<{
    usd: number;
    ngn: number | null;
    USDC?: { usd: number; ngn: number | null } | null;
    USDT?: { usd: number; ngn: number | null } | null;
  } | null>(null);
  const [loadingCoingecko, setLoadingCoingecko] = useState(false);
  const [coingeckoError, setCoingeckoError] = useState<string | null>(null);
  const [onrampEnabled, setOnrampEnabled] = useState(true);
  const [offrampEnabled, setOfframpEnabled] = useState(true);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [minimumOfframpSEND, setMinimumOfframpSEND] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [savingOnrampStatus, setSavingOnrampStatus] = useState(false);
  const [savingOfframpStatus, setSavingOfframpStatus] = useState(false);
  const [savingMinimumOfframp, setSavingMinimumOfframp] = useState(false);
  const [profitNgnSend, setProfitNgnSend] = useState<string>("0");
  const [profitNgnUsdc, setProfitNgnUsdc] = useState<string>("0");
  const [profitNgnUsdt, setProfitNgnUsdt] = useState<string>("0");
  const [profitNgnSendSell, setProfitNgnSendSell] = useState<string>("0");
  const [profitNgnUsdcSell, setProfitNgnUsdcSell] = useState<string>("0");
  const [profitNgnUsdtSell, setProfitNgnUsdtSell] = useState<string>("0");
  const [coingeckoAutoPublish, setCoingeckoAutoPublish] = useState(false);
  const [coingeckoAutoPublishSell, setCoingeckoAutoPublishSell] = useState(false);
  const [savingProfit, setSavingProfit] = useState(false);
  const [savingMinimumPurchase, setSavingMinimumPurchase] = useState(false);
  const [success, setSuccess] = useState(false);
  const profitSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profitSellSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoPublishRef = useRef<number>(0);
  const lastAutoPublishSellRef = useRef<number>(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Exchange rates (admin-set) – BUY (onramp)
  const [exchangeRate, setExchangeRate] = useState<string>(""); // 1 NGN = X $SEND
  const [sendToNgnRate, setSendToNgnRate] = useState<string>(""); // 1 $SEND = Y NGN
  const [usdcNgnRate, setUsdcNgnRate] = useState<string>(""); // 1 USDC = X NGN
  const [usdtNgnRate, setUsdtNgnRate] = useState<string>(""); // 1 USDT = X NGN
  const [savingExchangeRates, setSavingExchangeRates] = useState(false);
  // Exchange rates (admin-set) – SELL (offramp)
  const [sendToNgnSellRate, setSendToNgnSellRate] = useState<string>(""); // 1 $SEND = X NGN (sell)
  const [usdcSellNgnRate, setUsdcSellNgnRate] = useState<string>(""); // 1 USDC = X NGN (sell)
  const [usdtSellNgnRate, setUsdtSellNgnRate] = useState<string>(""); // 1 USDT = X NGN (sell)
  const [savingSellRates, setSavingSellRates] = useState(false);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(getApiUrl("/api/token-prices"));
        const data = await response.json();
        if (data.success) {
          setLivePrices({
            SEND: data.prices?.SEND ?? null,
            USDC: data.prices?.USDC ?? null,
            USDT: data.prices?.USDT ?? null,
            pricesNGN: data.pricesNGN,
            pricesNGNSell: data.pricesNGNSell,
            source: data.source,
          });
        } else {
          setError(data.error || "Failed to fetch prices");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch prices");
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    if (!address) return;
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.settings) {
        setOnrampEnabled(data.settings.onrampEnabled !== false);
        setOfframpEnabled(data.settings.offrampEnabled !== false);
        setMinimumPurchase(data.settings.minimumPurchase ?? 3000);
        setMinimumOfframpSEND(data.settings.minimumOfframpSEND ?? 1);
        setProfitNgnSend(String(data.settings.profitNgnSend ?? 0));
        setProfitNgnUsdc(String(data.settings.profitNgnUsdc ?? 0));
        setProfitNgnUsdt(String(data.settings.profitNgnUsdt ?? 0));
        setProfitNgnSendSell(String(data.settings.profitNgnSendSell ?? 0));
        setProfitNgnUsdcSell(String(data.settings.profitNgnUsdcSell ?? 0));
        setProfitNgnUsdtSell(String(data.settings.profitNgnUsdtSell ?? 0));
        setCoingeckoAutoPublish(data.settings.coingeckoAutoPublish === true);
        setCoingeckoAutoPublishSell(data.settings.coingeckoAutoPublishSell === true);
        const ngnToSend = data.settings.exchangeRate;
        if (ngnToSend != null && Number(ngnToSend) > 0) {
          setExchangeRate(Number(ngnToSend).toFixed(5));
          setSendToNgnRate((1 / Number(ngnToSend)).toFixed(2));
        }
        if (data.settings.sendToNgnSell != null && Number(data.settings.sendToNgnSell) > 0) {
          setSendToNgnSellRate(Number(data.settings.sendToNgnSell).toFixed(2));
        }
        setSettingsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const fetchCoingeckoPrice = async () => {
    if (!address) return;
    setLoadingCoingecko(true);
    setCoingeckoError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/coingecko-price"), {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.price) {
        setCoingeckoPrice({
          usd: data.price.usd,
          ngn: data.price.ngn,
          USDC: data.price.USDC ?? null,
          USDT: data.price.USDT ?? null,
        });
      } else {
        setCoingeckoError(data.error || "Failed to fetch CoinGecko price");
      }
    } catch (err) {
      setCoingeckoError("Failed to load CoinGecko price");
    } finally {
      setLoadingCoingecko(false);
    }
  };

  const fetchAdminTokenPrices = async () => {
    if (!address) return;
    try {
      const response = await fetch(getApiUrl("/api/admin/token-prices"), {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.prices) {
        if (data.prices.USDC != null) setUsdcNgnRate(String(data.prices.USDC));
        if (data.prices.USDT != null) setUsdtNgnRate(String(data.prices.USDT));
      }
    } catch (err) {
      console.error("Failed to fetch admin token prices:", err);
    }
  };

  const fetchSellTokenPrices = async () => {
    if (!address) return;
    try {
      const response = await fetch(getApiUrl("/api/admin/token-sell-prices"), {
        headers: { Authorization: `Bearer ${address}` },
      });
      const data = await response.json();
      if (data.success && data.prices) {
        if (data.prices.USDC != null) setUsdcSellNgnRate(Number(data.prices.USDC).toFixed(2));
        if (data.prices.USDT != null) setUsdtSellNgnRate(Number(data.prices.USDT).toFixed(2));
      }
    } catch (err) {
      console.error("Failed to fetch sell token prices:", err);
    }
  };

  useEffect(() => {
    if (address) {
      fetchSettings();
      fetchCoingeckoPrice();
      fetchAdminTokenPrices();
      fetchSellTokenPrices();
    }
  }, [address]);

  // Auto-refresh CoinGecko prices every 30 seconds
  useEffect(() => {
    if (!address) return;
    const interval = setInterval(() => fetchCoingeckoPrice(), 30000);
    return () => clearInterval(interval);
  }, [address]);

  // Debounced save of profit margins to DB (1s after last change); only after settings loaded so we don't overwrite with 0,0,0
  useEffect(() => {
    if (!address || !settingsLoaded) return;
    if (profitSaveTimeoutRef.current) clearTimeout(profitSaveTimeoutRef.current);
    profitSaveTimeoutRef.current = setTimeout(async () => {
      profitSaveTimeoutRef.current = null;
      const send = parseFloat(profitNgnSend) || 0;
      const usdc = parseFloat(profitNgnUsdc) || 0;
      const usdt = parseFloat(profitNgnUsdt) || 0;
      setSavingProfit(true);
      try {
        await fetch(getApiUrl("/api/admin/settings"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profitNgnSend: send,
            profitNgnUsdc: usdc,
            profitNgnUsdt: usdt,
            walletAddress: address,
          }),
        });
      } catch (err) {
        console.error("Failed to save profit margins:", err);
      } finally {
        setSavingProfit(false);
      }
    }, 1000);
    return () => {
      if (profitSaveTimeoutRef.current) clearTimeout(profitSaveTimeoutRef.current);
    };
  }, [address, settingsLoaded, profitNgnSend, profitNgnUsdc, profitNgnUsdt]);

  /** Persist sell profit margins to DB (call on blur or from debounce) */
  const saveProfitMarginsSell = async () => {
    if (!address) return;
    const send = parseFloat(profitNgnSendSell) || 0;
    const usdc = parseFloat(profitNgnUsdcSell) || 0;
    const usdt = parseFloat(profitNgnUsdtSell) || 0;
    setSavingProfit(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profitNgnSendSell: send,
          profitNgnUsdcSell: usdc,
          profitNgnUsdtSell: usdt,
          walletAddress: address,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(data.error || "Failed to save sell profit");
      }
    } catch (err) {
      console.error("Failed to save sell profit margins:", err);
      setError("Failed to save sell profit");
    } finally {
      setSavingProfit(false);
    }
  };

  // Debounced save of sell profit margins to DB (500ms after last change)
  useEffect(() => {
    if (!address || !settingsLoaded) return;
    if (profitSellSaveTimeoutRef.current) clearTimeout(profitSellSaveTimeoutRef.current);
    const send = parseFloat(profitNgnSendSell) || 0;
    const usdc = parseFloat(profitNgnUsdcSell) || 0;
    const usdt = parseFloat(profitNgnUsdtSell) || 0;
    profitSellSaveTimeoutRef.current = setTimeout(async () => {
      profitSellSaveTimeoutRef.current = null;
      setSavingProfit(true);
      setError(null);
      try {
        const res = await fetch(getApiUrl("/api/admin/settings"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profitNgnSendSell: send, profitNgnUsdcSell: usdc, profitNgnUsdtSell: usdt, walletAddress: address }),
        });
        const data = await res.json();
        if (data.success) {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else {
          setError(data.error || "Failed to save sell profit");
        }
      } catch (err) {
        console.error("Failed to save sell profit margins:", err);
        setError("Failed to save sell profit");
      } finally {
        setSavingProfit(false);
      }
    }, 500);
    return () => {
      if (profitSellSaveTimeoutRef.current) clearTimeout(profitSellSaveTimeoutRef.current);
    };
  }, [address, settingsLoaded, profitNgnSendSell, profitNgnUsdcSell, profitNgnUsdtSell]);

  // Auto-publish buy: every 30s when coingeckoAutoPublish is on
  useEffect(() => {
    if (!address || !coingeckoAutoPublish) return;
    const interval = setInterval(async () => {
      if (!coingeckoPrice || saving) return;
      const now = Date.now();
      if (now - lastAutoPublishRef.current < 25000) return;
      lastAutoPublishRef.current = now;
      await publishCoingeckoPrice();
    }, 30000);
    return () => clearInterval(interval);
  }, [address, coingeckoAutoPublish, coingeckoPrice, saving, profitNgnSend, profitNgnUsdc, profitNgnUsdt]);

  // Auto-publish sell (offramp): every 30s when coingeckoAutoPublishSell is on – offramp has its own toggle
  useEffect(() => {
    if (!address || !coingeckoAutoPublishSell) return;
    const interval = setInterval(async () => {
      if (!coingeckoPrice || saving) return;
      const now = Date.now();
      if (now - lastAutoPublishSellRef.current < 25000) return;
      lastAutoPublishSellRef.current = now;
      await publishCoingeckoPriceSell();
    }, 30000);
    return () => clearInterval(interval);
  }, [address, coingeckoAutoPublishSell, coingeckoPrice, saving, profitNgnSendSell, profitNgnUsdcSell, profitNgnUsdtSell]);

  const publishCoingeckoPrice = async () => {
    if (!address || !coingeckoPrice) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const profitSend = parseFloat(profitNgnSend) || 0;
      const baseSendToNgn = coingeckoPrice.ngn ?? coingeckoPrice.usd * 1500;
      const sendToNgn = baseSendToNgn + profitSend;
      const ngnToSend = 1 / sendToNgn;
      const settingsRes = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: ngnToSend, walletAddress: address }),
      });
      const settingsData = await settingsRes.json();
      if (!settingsData.success) {
        setError(settingsData.error || "Failed to publish SEND rate");
        setSaving(false);
        return;
      }
      setExchangeRate(ngnToSend.toFixed(5));
      setSendToNgnRate(sendToNgn.toFixed(2));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("exchangeRateUpdated", { detail: { rate: ngnToSend } }));
      }
      const prices: Record<string, number> = {};
      if (coingeckoPrice.USDC?.ngn != null) {
        const profitUsdc = parseFloat(profitNgnUsdc) || 0;
        prices.USDC = coingeckoPrice.USDC.ngn + profitUsdc;
      }
      if (coingeckoPrice.USDT?.ngn != null) {
        const profitUsdt = parseFloat(profitNgnUsdt) || 0;
        prices.USDT = coingeckoPrice.USDT.ngn + profitUsdt;
      }
      if (Object.keys(prices).length > 0) {
        const tokenRes = await fetch(getApiUrl("/api/admin/token-prices"), {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to publish USDC/USDT prices");
          setSaving(false);
          return;
        }
        setUsdcNgnRate(prices.USDC != null ? String(prices.USDC) : usdcNgnRate);
        setUsdtNgnRate(prices.USDT != null ? String(prices.USDT) : usdtNgnRate);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish CoinGecko price");
    } finally {
      setSaving(false);
    }
  };

  /** Publish CoinGecko + sell profit → update sell rates (SEND in settings, USDC/USDT in token_sell_prices). */
  const publishCoingeckoPriceSell = async () => {
    if (!address || !coingeckoPrice) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const profitSend = parseFloat(profitNgnSendSell) || 0;
      const baseSendToNgn = coingeckoPrice.ngn ?? coingeckoPrice.usd * 1500;
      const sendToNgnSell = baseSendToNgn + profitSend;
      const profitUsdc = parseFloat(profitNgnUsdcSell) || 0;
      const profitUsdt = parseFloat(profitNgnUsdtSell) || 0;
      const res = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendToNgnSell,
          profitNgnSendSell: profitSend,
          profitNgnUsdcSell: profitUsdc,
          profitNgnUsdtSell: profitUsdt,
          walletAddress: address,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to publish sell rates");
        setSaving(false);
        return;
      }
      setSendToNgnSellRate(sendToNgnSell.toFixed(2));
      const prices: Record<string, number> = {};
      if (coingeckoPrice.USDC?.ngn != null) prices.USDC = coingeckoPrice.USDC.ngn + profitUsdc;
      if (coingeckoPrice.USDT?.ngn != null) prices.USDT = coingeckoPrice.USDT.ngn + profitUsdt;
      if (Object.keys(prices).length > 0) {
        const tokenRes = await fetch(getApiUrl("/api/admin/token-sell-prices"), {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to publish USDC/USDT sell prices");
          setSaving(false);
          return;
        }
        setUsdcSellNgnRate(prices.USDC != null ? String(prices.USDC) : usdcSellNgnRate);
        setUsdtSellNgnRate(prices.USDT != null ? String(prices.USDT) : usdtSellNgnRate);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish sell rates");
    } finally {
      setSaving(false);
    }
  };

  const saveMinimumPurchase = async () => {
    if (!address) return;
    setSavingMinimumPurchase(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumPurchase: Number(minimumPurchase),
          walletAddress: address,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save minimum purchase");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save minimum purchase");
    } finally {
      setSavingMinimumPurchase(false);
    }
  };

  const saveMinimumOfframp = async () => {
    if (!address) return;
    setSavingMinimumOfframp(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumOfframpSEND: Number(minimumOfframpSEND),
          walletAddress: address,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save minimum sell");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save minimum sell");
    } finally {
      setSavingMinimumOfframp(false);
    }
  };

  const saveExchangeRates = async () => {
    if (!address) return;
    setSavingExchangeRates(true);
    setError(null);
    try {
      const ngnToSend = parseFloat(exchangeRate);
      if (isNaN(ngnToSend) || ngnToSend <= 0) {
        setError("Invalid NGN to SEND rate");
        setSavingExchangeRates(false);
        return;
      }
      const settingsRes = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeRate: ngnToSend, walletAddress: address }),
      });
      const settingsData = await settingsRes.json();
      if (!settingsData.success) {
        setError(settingsData.error || "Failed to save SEND exchange rate");
        setSavingExchangeRates(false);
        return;
      }
      const prices: Record<string, number> = {};
      const usdc = parseFloat(usdcNgnRate);
      const usdt = parseFloat(usdtNgnRate);
      if (!isNaN(usdc) && usdc > 0) prices.USDC = usdc;
      if (!isNaN(usdt) && usdt > 0) prices.USDT = usdt;
      if (Object.keys(prices).length > 0) {
        const tokenRes = await fetch(getApiUrl("/api/admin/token-prices"), {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to save USDC/USDT prices");
          setSavingExchangeRates(false);
          return;
        }
      }
      setSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("exchangeRateUpdated", { detail: { rate: ngnToSend } }));
      }
      fetchAdminTokenPrices();
      const pricesRes = await fetch(getApiUrl("/api/token-prices"));
      const pricesData = await pricesRes.json();
      if (pricesData.success) {
        setLivePrices({
          SEND: pricesData.prices?.SEND ?? null,
          USDC: pricesData.prices?.USDC ?? null,
          USDT: pricesData.prices?.USDT ?? null,
          pricesNGN: pricesData.pricesNGN,
          pricesNGNSell: pricesData.pricesNGNSell,
          source: pricesData.source,
        });
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save exchange rates");
    } finally {
      setSavingExchangeRates(false);
    }
  };

  const saveSellExchangeRates = async () => {
    if (!address) return;
    setSavingSellRates(true);
    setError(null);
    try {
      const sendToNgn = parseFloat(sendToNgnSellRate);
      const usdc = parseFloat(usdcSellNgnRate);
      const usdt = parseFloat(usdtSellNgnRate);
      if (isNaN(sendToNgn) || sendToNgn <= 0) {
        setError("Invalid SEND to NGN (sell) rate");
        setSavingSellRates(false);
        return;
      }
      const res = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToNgnSell: sendToNgn, walletAddress: address }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to save sell exchange rates");
        setSavingSellRates(false);
        return;
      }
      const sellPrices: Record<string, number> = {};
      if (!isNaN(usdc) && usdc > 0) sellPrices.USDC = usdc;
      if (!isNaN(usdt) && usdt > 0) sellPrices.USDT = usdt;
      if (Object.keys(sellPrices).length > 0) {
        const tokenRes = await fetch(getApiUrl("/api/admin/token-sell-prices"), {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${address}` },
          body: JSON.stringify({ prices: sellPrices, walletAddress: address }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.success) {
          setError(tokenData.error || "Failed to save USDC/USDT sell rates");
          setSavingSellRates(false);
          return;
        }
      }
      setSuccess(true);
      const pricesRes = await fetch(getApiUrl("/api/token-prices"));
      const pricesData = await pricesRes.json();
      if (pricesData.success) {
        setLivePrices((prev) => (prev ? { ...prev, pricesNGNSell: pricesData.pricesNGNSell } : null));
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save sell exchange rates");
    } finally {
      setSavingSellRates(false);
    }
  };

  const handleOnrampToggle = async (newValue: boolean) => {
    if (!address) return;
    setOnrampEnabled(newValue);
    setSavingOnrampStatus(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onrampEnabled: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to update onramp status");
        setOnrampEnabled(!newValue);
      }
    } catch (err) {
      setOnrampEnabled(!newValue);
      setError("Failed to update onramp status");
    } finally {
      setSavingOnrampStatus(false);
    }
  };

  const handleCoingeckoAutoPublishToggle = async (newValue: boolean) => {
    if (!address) return;
    setCoingeckoAutoPublish(newValue);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coingeckoAutoPublish: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Failed to update auto-publish");
        setCoingeckoAutoPublish(!newValue);
      }
    } catch (err) {
      setCoingeckoAutoPublish(!newValue);
      setError("Failed to update auto-publish");
    }
  };

  const handleCoingeckoAutoPublishSellToggle = async (newValue: boolean) => {
    if (!address) return;
    setCoingeckoAutoPublishSell(newValue);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coingeckoAutoPublishSell: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Failed to update offramp auto-publish");
        setCoingeckoAutoPublishSell(!newValue);
      }
    } catch (err) {
      setCoingeckoAutoPublishSell(!newValue);
      setError("Failed to update offramp auto-publish");
    }
  };

  const handleOfframpToggle = async (newValue: boolean) => {
    if (!address) return;
    setOfframpEnabled(newValue);
    setSavingOfframpStatus(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offrampEnabled: newValue, walletAddress: address }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to update offramp status");
        setOfframpEnabled(!newValue);
      }
    } catch (err) {
      setOfframpEnabled(!newValue);
      setError("Failed to update offramp status");
    } finally {
      setSavingOfframpStatus(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto pt-0 px-6 lg:px-8 pb-6 lg:pb-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:justify-end sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface/60 border border-accent/10 rounded-full text-xs font-medium text-accent/70">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            Market Feed: OK
          </div>
        </div>
      </header>

      {/* SELL / BUY Tabs (Offramp / Onramp) */}
      <div className="flex gap-0 rounded-xl border border-accent/10 p-1 bg-surface/40 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("buy")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "buy"
              ? "bg-secondary/20 text-secondary border border-secondary/30 shadow-[0_0_10px_rgba(19,236,90,0.1)]"
              : "text-accent/70 hover:text-white hover:bg-accent/5"
          }`}
        >
          <span className="material-icons-outlined text-lg text-white">arrow_downward</span>
          BUY (Onramp)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sell")}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "sell"
              ? "bg-secondary/20 text-secondary border border-secondary/30 shadow-[0_0_10px_rgba(19,236,90,0.1)]"
              : "text-accent/70 hover:text-white hover:bg-accent/5"
          }`}
        >
          <span className="material-icons-outlined text-lg text-white">arrow_upward</span>
          SELL (Offramp)
        </button>
      </div>

      {/* Tab description */}
      <p className="text-sm text-accent/70">
        {activeTab === "buy"
          ? "Onramp: users buy crypto (SEND, USDC, USDT) with NGN. Prices below apply to buy orders."
          : "Offramp: users sell crypto for NGN. Prices below apply to sell orders."}
      </p>

      {/* Success Message */}
      {success && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
          <p className="text-secondary text-sm font-medium flex items-center gap-2">
            <span className="material-icons-outlined text-lg">check_circle</span>
            Settings saved successfully.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium flex items-center gap-2">
            <span className="material-icons-outlined text-lg">error</span>
            {error}
          </p>
        </div>
      )}

      {/* CoinGecko Price – at top for BUY & SELL */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">show_chart</span>
          CoinGecko Price
        </h2>
        {/* Indicators: auto pricing, 30s refresh, profit stored, auto-publish */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-primary/40 border border-accent/10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary/10 text-secondary border border-secondary/20">
            <span className="material-icons-outlined text-sm text-white">schedule</span>
            Prices refresh every 30s
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent/80">
            <span className="material-icons-outlined text-sm text-white">savings</span>
            {activeTab === "buy" ? "Buy profit" : "Sell profit"} stored in DB, applied on publish
          </span>
          {coingeckoAutoPublish && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary/20 text-secondary border border-secondary/30">
              <span className="material-icons-outlined text-sm text-white">autorenew</span>
              Auto-publish (buy): every 30s
            </span>
          )}
          {coingeckoAutoPublishSell && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-secondary/20 text-secondary border border-secondary/30">
              <span className="material-icons-outlined text-sm text-white">autorenew</span>
              Auto-publish (sell): every 30s
            </span>
          )}
          {savingProfit && (
            <span className="text-xs text-accent/60">Saving profit…</span>
          )}
        </div>
        <div className="space-y-4">
          {loadingCoingecko ? (
            <div className="flex items-center gap-2 text-accent/70">
              <FSpinner size="xs" />
              <span className="text-sm">Fetching price from CoinGecko...</span>
            </div>
          ) : coingeckoError ? (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
              <p className="text-sm text-red-400">{coingeckoError}</p>
              <button
                onClick={fetchCoingeckoPrice}
                className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : coingeckoPrice ? (
            <div className="space-y-3">
              {/* SEND – own line + Profit (NGN) */}
              <div className="pt-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-accent/80">Current Price (SEND)</p>
                    <p className="text-lg font-bold text-white">
                      ${coingeckoPrice.usd.toFixed(6)} USD
                    </p>
                    {coingeckoPrice.ngn != null && (
                      <p className="text-sm text-accent/70">
                        ≈ ₦{coingeckoPrice.ngn.toFixed(2)} NGN
                      </p>
                    )}
                  </div>
                  <button
                    onClick={fetchCoingeckoPrice}
                    disabled={loadingCoingecko}
                    className="px-3 py-1.5 text-xs font-medium bg-primary border border-accent/10 text-accent/80 rounded-lg hover:bg-accent/10 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Profit (NGN) – {activeTab === "buy" ? "Buy" : "Sell"}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={activeTab === "buy" ? profitNgnSend : profitNgnSendSell}
                    onChange={(e) => (activeTab === "buy" ? setProfitNgnSend(e.target.value) : setProfitNgnSendSell(e.target.value))}
                    onBlur={activeTab === "sell" ? saveProfitMarginsSell : undefined}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-accent/60 mt-1">
                    {activeTab === "buy" ? "Added to SEND buy rate in NGN when publishing (1 $SEND = CoinGecko NGN + this profit)." : "Added to SEND sell rate in NGN when publishing (1 $SEND = CoinGecko NGN + this profit). Stored in DB."}
                  </p>
                </div>
              </div>

              {/* USDC – own line + Profit (NGN) */}
              <div className="pt-2 border-t border-accent/10">
                <div>
                  <p className="text-sm font-medium text-accent/80">Current Price (USDC)</p>
                  {coingeckoPrice.USDC ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        ${coingeckoPrice.USDC.usd.toFixed(4)} USD
                      </p>
                      {coingeckoPrice.USDC.ngn != null && (
                        <p className="text-sm text-accent/70">
                          ≈ ₦{coingeckoPrice.USDC.ngn.toFixed(2)} NGN
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-accent/60">—</p>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Profit (NGN) – {activeTab === "buy" ? "Buy" : "Sell"}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={activeTab === "buy" ? profitNgnUsdc : profitNgnUsdcSell}
                    onChange={(e) => (activeTab === "buy" ? setProfitNgnUsdc(e.target.value) : setProfitNgnUsdcSell(e.target.value))}
                    onBlur={activeTab === "sell" ? saveProfitMarginsSell : undefined}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-accent/60 mt-1">
                    {activeTab === "buy" ? "Added to USDC buy rate in NGN when publishing." : "Added to USDC sell rate in NGN when publishing. Stored in DB."}
                  </p>
                </div>
              </div>

              {/* USDT – own line + Profit (NGN) */}
              <div className="pt-2 border-t border-accent/10">
                <div>
                  <p className="text-sm font-medium text-accent/80">Current Price (USDT)</p>
                  {coingeckoPrice.USDT ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        ${coingeckoPrice.USDT.usd.toFixed(4)} USD
                      </p>
                      {coingeckoPrice.USDT.ngn != null && (
                        <p className="text-sm text-accent/70">
                          ≈ ₦{coingeckoPrice.USDT.ngn.toFixed(2)} NGN
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-accent/60">—</p>
                  )}
                </div>
                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Profit (NGN) – {activeTab === "buy" ? "Buy" : "Sell"}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={activeTab === "buy" ? profitNgnUsdt : profitNgnUsdtSell}
                    onChange={(e) => (activeTab === "buy" ? setProfitNgnUsdt(e.target.value) : setProfitNgnUsdtSell(e.target.value))}
                    onBlur={activeTab === "sell" ? saveProfitMarginsSell : undefined}
                    placeholder="0"
                    disabled={saving}
                    className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-xs text-accent/60 mt-1">
                    {activeTab === "buy" ? "Added to USDT buy rate in NGN when publishing." : "Added to USDT sell rate in NGN when publishing. Stored in DB."}
                  </p>
                </div>
              </div>

              {/* Auto-publish toggle – Buy tab: buy only; Sell tab: offramp (sell) has its own */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-accent/10 bg-primary/40">
                <div>
                  <p className="text-sm font-medium text-white">
                    {activeTab === "buy" ? "Auto-publish CoinGecko + buy profit every 30s" : "Auto-publish CoinGecko + sell profit every 30s"}
                  </p>
                  <p className="text-xs text-accent/60 mt-0.5">
                    {activeTab === "buy"
                      ? "When on, buy rates are published automatically every 30s."
                      : "When on, sell (offramp) rates are published automatically every 30s."}
                  </p>
                </div>
                <label className="cursor-pointer">
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeTab === "buy" ? (coingeckoAutoPublish ? "bg-secondary" : "bg-accent/20") : (coingeckoAutoPublishSell ? "bg-secondary" : "bg-accent/20")}`}>
                    <input
                      type="checkbox"
                      checked={activeTab === "buy" ? coingeckoAutoPublish : coingeckoAutoPublishSell}
                      onChange={(e) => (activeTab === "buy" ? handleCoingeckoAutoPublishToggle(e.target.checked) : handleCoingeckoAutoPublishSellToggle(e.target.checked))}
                      disabled={!address}
                      className="sr-only"
                      aria-label={activeTab === "buy" ? "Toggle buy auto-publish" : "Toggle sell (offramp) auto-publish"}
                    />
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(activeTab === "buy" ? coingeckoAutoPublish : coingeckoAutoPublishSell) ? "translate-x-6" : "translate-x-1"}`} />
                  </div>
                </label>
              </div>

              <button
                onClick={activeTab === "buy" ? publishCoingeckoPrice : publishCoingeckoPriceSell}
                disabled={saving || !coingeckoPrice}
                className="w-full bg-secondary text-primary font-bold px-4 py-2 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <FSpinner size="xs" />
                    Publishing...
                  </>
                ) : activeTab === "buy" ? (
                  "Publish CoinGecko with Profit (Buy)"
                ) : (
                  "Publish CoinGecko with Profit (Sell)"
                )}
              </button>
              <p className="text-xs text-accent/60">
                {activeTab === "buy"
                  ? "Overwrites buy exchange rate and token buy prices with CoinGecko + buy profit."
                  : "Overwrites sell rates (1 SEND = X NGN, etc.) with CoinGecko + sell profit."}
                {activeTab === "buy" && coingeckoAutoPublish && " Auto-publish is on: buy rates update every 30s."}
                {activeTab === "sell" && coingeckoAutoPublishSell && " Auto-publish is on: sell (offramp) rates update every 30s."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-accent/70">No price data available. Connect wallet and refresh.</p>
          )}
        </div>
      </div>

      {/* Live Token Prices – On Ramp only */}
      {activeTab === "buy" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">show_chart</span>
            Live Token Prices (On Ramp)
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FSpinner size="md" className="mb-4" />
                <p className="text-accent/70">Loading prices...</p>
              </div>
            </div>
          ) : livePrices ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">SEND (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.SEND != null ? `$${livePrices.SEND.toFixed(6)}` : "—"}
                  </p>
                  {livePrices.pricesNGN?.SEND != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGN.SEND.toFixed(2)} NGN</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">USDC (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.USDC != null ? `$${livePrices.USDC.toFixed(4)}` : "—"}
                  </p>
                  {livePrices.pricesNGN?.USDC != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGN.USDC.toFixed(2)} NGN</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">USDT (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.USDT != null ? `$${livePrices.USDT.toFixed(4)}` : "—"}
                  </p>
                  {livePrices.pricesNGN?.USDT != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGN.USDT.toFixed(2)} NGN</p>
                  )}
                </div>
              </div>
              {livePrices?.source && (
                <p className="text-xs text-accent/60 mt-4">
                  Source: {livePrices.source}. Used for buy (onramp: NGN → crypto).
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Live Token Prices – Off Ramp only */}
      {activeTab === "sell" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">show_chart</span>
            Live Token Prices (Off Ramp)
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FSpinner size="md" className="mb-4" />
                <p className="text-accent/70">Loading prices...</p>
              </div>
            </div>
          ) : livePrices ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">SEND (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.SEND != null ? `$${livePrices.SEND.toFixed(6)}` : "—"}
                  </p>
                  {livePrices.pricesNGNSell?.SEND != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGNSell.SEND.toFixed(2)} NGN (sell)</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">USDC (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.USDC != null ? `$${livePrices.USDC.toFixed(4)}` : "—"}
                  </p>
                  {livePrices.pricesNGNSell?.USDC != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGNSell.USDC.toFixed(2)} NGN (sell)</p>
                  )}
                </div>
                <div className="p-4 rounded-xl bg-primary/40 border border-accent/10">
                  <p className="text-[10px] font-bold text-accent/60 uppercase tracking-wider mb-1">USDT (USD)</p>
                  <p className="text-xl font-bold text-white">
                    {livePrices.USDT != null ? `$${livePrices.USDT.toFixed(4)}` : "—"}
                  </p>
                  {livePrices.pricesNGNSell?.USDT != null && (
                    <p className="text-sm text-accent/70 mt-1">≈ ₦{livePrices.pricesNGNSell.USDT.toFixed(2)} NGN (sell)</p>
                  )}
                </div>
              </div>
              {livePrices?.source && (
                <p className="text-xs text-accent/60 mt-4">
                  Source: {livePrices.source}. Used for sell (offramp: crypto → NGN).
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Exchange Rate (On Ramp only) – Admin set buy rates */}
      {activeTab === "buy" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">swap_horiz</span>
            Exchange Rate (On Ramp)
          </h2>
          <p className="text-sm text-accent/70 mb-4">
            Set token exchange rates for BUY (Onramp). Used for NGN ↔ SEND, USDC, and USDT.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">NGN to SEND Exchange Rate</label>
              <input
                type="number"
                step="0.00001"
                min="0.00001"
                value={exchangeRate}
                onChange={(e) => {
                  const value = e.target.value;
                  setExchangeRate(value);
                  setError(null);
                  const ngnToSend = parseFloat(value);
                  if (!isNaN(ngnToSend) && ngnToSend > 0) setSendToNgnRate((1 / ngnToSend).toFixed(2));
                }}
                placeholder="0.01754"
                disabled={savingExchangeRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 NGN = {exchangeRate || "0"} $SEND</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">$SEND to NGN Exchange Rate</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sendToNgnRate}
                onChange={(e) => {
                  const value = e.target.value;
                  setSendToNgnRate(value);
                  setError(null);
                  const sendToNgn = parseFloat(value);
                  if (!isNaN(sendToNgn) && sendToNgn > 0) setExchangeRate((1 / sendToNgn).toFixed(5));
                }}
                placeholder="57.01"
                disabled={savingExchangeRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 $SEND = {sendToNgnRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">USDC to NGN Exchange Rate</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdcNgnRate}
                onChange={(e) => { setUsdcNgnRate(e.target.value); setError(null); }}
                placeholder="1500"
                disabled={savingExchangeRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 USDC = {usdcNgnRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">USDT to NGN Exchange Rate</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdtNgnRate}
                onChange={(e) => { setUsdtNgnRate(e.target.value); setError(null); }}
                placeholder="1500"
                disabled={savingExchangeRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 USDT = {usdtNgnRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <button
                type="button"
                onClick={saveExchangeRates}
                disabled={savingExchangeRates || !address || !exchangeRate || parseFloat(exchangeRate) <= 0}
                className="bg-secondary text-primary font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingExchangeRates ? (<><FSpinner size="xs" /> Saving...</>) : "Save Exchange Rates"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off Ramp only – Admin set sell rates */}
      {activeTab === "sell" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">swap_horiz</span>
            Exchange Rate (Off Ramp)
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">$SEND to NGN (Sell)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={sendToNgnSellRate}
                onChange={(e) => { setSendToNgnSellRate(e.target.value); setError(null); }}
                placeholder="46.71"
                disabled={savingSellRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 $SEND = {sendToNgnSellRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">USDC to NGN (Sell)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdcSellNgnRate}
                onChange={(e) => { setUsdcSellNgnRate(e.target.value); setError(null); }}
                placeholder="1470"
                disabled={savingSellRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 USDC = {usdcSellNgnRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">USDT to NGN (Sell)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={usdtSellNgnRate}
                onChange={(e) => { setUsdtSellNgnRate(e.target.value); setError(null); }}
                placeholder="1470"
                disabled={savingSellRates}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-accent/60 mt-1">1 USDT = {usdtSellNgnRate || "0"} NGN</p>
            </div>
            <div className="border-t border-accent/10 pt-4">
              <button
                type="button"
                onClick={saveSellExchangeRates}
                disabled={savingSellRates || !address || !sendToNgnSellRate || parseFloat(sendToNgnSellRate) <= 0}
                className="bg-secondary text-primary font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingSellRates ? (<><FSpinner size="xs" /> Saving...</>) : "Save Sell Exchange Rates"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onramp / Offramp transaction status (tab-specific) */}
      {activeTab === "buy" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">toggle_on</span>
            Onramp transaction status
          </h2>
          <p className="text-sm text-accent/70 mb-6">
            Enable or disable buy (onramp) only. When disabled, users cannot buy crypto with NGN. The global toggle in Settings affects all; this one affects only onramp.
          </p>
          <label
            className={`flex flex-wrap items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none ${
              onrampEnabled
                ? "bg-secondary/5 border-secondary/30 hover:border-secondary/50"
                : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
            } ${savingOnrampStatus || !address ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <input
              type="checkbox"
              checked={onrampEnabled}
              onChange={(e) => handleOnrampToggle(e.target.checked)}
              disabled={savingOnrampStatus || !address}
              className="sr-only"
              aria-label="Toggle onramp on or off"
            />
            <div
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                onrampEnabled ? "bg-secondary" : "bg-accent/30"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  onrampEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-bold ${onrampEnabled ? "text-secondary" : "text-red-400"}`}>
                {onrampEnabled ? "Onramp enabled" : "Onramp disabled"}
              </span>
              {savingOnrampStatus && (
                <span className="text-xs text-accent/60">Saving...</span>
              )}
            </div>
            <span
              className={`ml-auto px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                onrampEnabled ? "bg-secondary/20 text-secondary" : "bg-red-500/20 text-red-400"
              }`}
            >
              {onrampEnabled ? "Active" : "Inactive"}
            </span>
          </label>
          {!onrampEnabled && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">
                Buy (onramp) is disabled. Users cannot buy crypto with NGN until this is enabled (and global transactions in Settings are enabled).
              </p>
            </div>
          )}
        </div>
      )}
      {activeTab === "sell" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">toggle_on</span>
            Offramp transaction status
          </h2>
          <p className="text-sm text-accent/70 mb-6">
            Enable or disable sell (offramp) only. When disabled, users cannot sell crypto for NGN. The global toggle in Settings affects all; this one affects only offramp.
          </p>
          <label
            className={`flex flex-wrap items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none ${
              offrampEnabled
                ? "bg-secondary/5 border-secondary/30 hover:border-secondary/50"
                : "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
            } ${savingOfframpStatus || !address ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            <input
              type="checkbox"
              checked={offrampEnabled}
              onChange={(e) => handleOfframpToggle(e.target.checked)}
              disabled={savingOfframpStatus || !address}
              className="sr-only"
              aria-label="Toggle offramp on or off"
            />
            <div
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                offrampEnabled ? "bg-secondary" : "bg-accent/30"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  offrampEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-bold ${offrampEnabled ? "text-secondary" : "text-red-400"}`}>
                {offrampEnabled ? "Offramp enabled" : "Offramp disabled"}
              </span>
              {savingOfframpStatus && (
                <span className="text-xs text-accent/60">Saving...</span>
              )}
            </div>
            <span
              className={`ml-auto px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                offrampEnabled ? "bg-secondary/20 text-secondary" : "bg-red-500/20 text-red-400"
              }`}
            >
              {offrampEnabled ? "Active" : "Inactive"}
            </span>
          </label>
          {!offrampEnabled && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">
                Sell (offramp) is disabled. Users cannot sell crypto for NGN until this is enabled (and global transactions in Settings are enabled).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Minimum Purchase (Onramp) - shown on Buy tab only; Minimum Sell (Offramp) - shown on Sell tab only */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === "buy" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">shopping_cart</span>
            Minimum Purchase (Onramp)
          </h2>
          <p className="text-sm text-accent/70 mb-4">
            Set the minimum NGN amount users must spend when buying crypto (Naira to Crypto).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Minimum Purchase (NGN)</label>
              <input
                type="number"
                value={minimumPurchase}
                onChange={(e) => setMinimumPurchase(parseFloat(e.target.value) || 3000)}
                min={1}
                step={1}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                placeholder="3000"
              />
              <p className="mt-2 text-xs text-accent/60">
                Users must purchase at least ₦{minimumPurchase.toLocaleString()} to proceed with a buy transaction.
              </p>
            </div>
            <button
              onClick={saveMinimumPurchase}
              disabled={savingMinimumPurchase || !address || minimumPurchase <= 0}
              className="bg-secondary text-primary font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingMinimumPurchase ? (
                <>
                  <FSpinner size="xs" />
                  Saving...
                </>
              ) : (
                "Save Minimum Purchase"
              )}
            </button>
          </div>
        </div>
        )}
        {activeTab === "sell" && (
        <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="material-icons-outlined text-secondary">sell</span>
            Minimum Sell (Offramp)
          </h2>
          <p className="text-sm text-accent/70 mb-4">
            Set the minimum $SEND amount users must sell when converting crypto to Naira (Crypto to Naira).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-accent/60 uppercase mb-2">Minimum Sell ($SEND)</label>
              <input
                type="number"
                value={minimumOfframpSEND}
                onChange={(e) => setMinimumOfframpSEND(parseFloat(e.target.value) || 1)}
                min={0.01}
                step={0.1}
                className="w-full rounded-xl border border-accent/10 bg-primary text-white px-4 py-2 focus:ring-1 focus:ring-secondary focus:border-secondary focus:outline-none"
                placeholder="1"
              />
              <p className="mt-2 text-xs text-accent/60">
                Users must sell at least {minimumOfframpSEND} $SEND to proceed with a sell transaction.
              </p>
            </div>
            <button
              onClick={saveMinimumOfframp}
              disabled={savingMinimumOfframp || !address || minimumOfframpSEND <= 0}
              className="bg-secondary text-primary font-bold px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-[0_0_15px_rgba(19,236,90,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingMinimumOfframp ? (
                <>
                  <FSpinner size="xs" />
                  Saving...
                </>
              ) : (
                "Save Minimum Sell"
              )}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Quick Links (tab-specific) */}
      <div className="bg-surface/60 backdrop-blur-[16px] p-6 rounded-2xl border border-accent/10">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="material-icons-outlined text-secondary">link</span>
          Related
        </h2>
        <div className="flex flex-wrap gap-3">
          {activeTab === "buy" ? (
            <Link
              href="/admin/onramp"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/40 border border-accent/10 hover:bg-accent/10 hover:border-secondary/30 text-white text-sm font-medium transition-colors"
            >
              <span className="material-icons-outlined text-lg text-white">arrow_downward</span>
              Onramp Transactions
            </Link>
          ) : (
            <Link
              href="/admin/offramp"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/40 border border-accent/10 hover:bg-accent/10 hover:border-secondary/30 text-white text-sm font-medium transition-colors"
            >
              <span className="material-icons-outlined text-lg text-white">arrow_upward</span>
              Offramp Transactions
            </Link>
          )}
          <Link
            href="/admin/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/40 border border-accent/10 hover:bg-accent/10 hover:border-secondary/30 text-white text-sm font-medium transition-colors"
          >
            <span className="material-icons-outlined text-lg text-white">settings</span>
            Settings (SEND/NGN rate)
          </Link>
        </div>
      </div>
    </div>
  );
}

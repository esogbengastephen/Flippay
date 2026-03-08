"use client";

import { getApiUrl } from "@/lib/apiBase";
import { getTokenLogo, getChainLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import PoweredBySEND from "@/components/PoweredBySEND";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import { QRCodeSVG } from "qrcode.react";
import { NIGERIAN_BANKS } from "@/lib/nigerian-banks";

interface BankOption {
  code: string;
  name: string;
}

function OffRampPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [verifiedAccountName, setVerifiedAccountName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<"send" | "base" | "solana">("send");
  const [network, setNetwork] = useState<"base" | "solana">("base");
  const [networkType, setNetworkType] = useState<"send" | "base" | "solana">("send");
  const [showNetworkSelectionCard, setShowNetworkSelectionCard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const bankDropdownRef = useRef<HTMLDivElement>(null);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [payoutTakingLong, setPayoutTakingLong] = useState(false);
  const [sendDetected, setSendDetected] = useState<{ balance: string } | null>(null);
  const [payoutError, setPayoutError] = useState("");
  const [payoutSuccess, setPayoutSuccess] = useState<{ message: string; ngnAmount?: number; sendAmount?: string } | null>(null);
  const [cancellingPending, setCancellingPending] = useState(false);
  const [refreshingAddress, setRefreshingAddress] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sellRate, setSellRate] = useState<number | null>(null);
  const [pricesNGNSell, setPricesNGNSell] = useState<Record<string, number>>({});
  const [minimumOfframpSEND, setMinimumOfframpSEND] = useState<number>(1);
  const [selectedCrypto, setSelectedCrypto] = useState<"SEND" | "USDC" | "USDT">("SEND");
  const [cryptoDropdownOpen, setCryptoDropdownOpen] = useState(false);
  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const [banksList, setBanksList] = useState<BankOption[]>(NIGERIAN_BANKS);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const isSendFlow = selectedNetwork === "send";
  const minimumAmount = isSendFlow ? minimumOfframpSEND : 1;
  const sendAmountNum = parseFloat(sendAmount) || 0;
  const ngnAmount = sellRate != null && sellRate > 0 ? sendAmountNum * sellRate : 0;
  const meetsMinimumSell = sendAmountNum >= minimumAmount;
  const filteredBanks = bankSearchQuery.trim()
    ? banksList.filter(
        (b) =>
          b.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
          b.code.includes(bankSearchQuery)
      )
    : banksList;
  const selectedBankName = selectedBankCode
    ? banksList.find((b) => b.code === selectedBankCode)?.name ?? ""
    : "";

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }
    const u = getUserFromStorage();
    setUser(u);

    // Pre-fill pending off-ramp from server (unless startNew=1 — user chose "start fresh" from dashboard)
    const startNew = searchParams.get("startNew") === "1";
    if (u?.email && !startNew) {
      fetch(getApiUrl(`/api/offramp/pending?userEmail=${encodeURIComponent(u.email)}`))
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.hasPending && data?.depositAddress && data?.transactionId) {
            setWalletAddress(data.depositAddress);
            setTransactionId(data.transactionId);
            if (data.accountName) setVerifiedAccountName(data.accountName);
          }
        })
        .catch(() => {});
    }

    // Read network and type from URL. Network first: ?network=send|base|solana, ?type=send|usdc|usdt
    const networkParam = (searchParams.get("network") || "").toLowerCase();
    const typeParam = (searchParams.get("type") || "").toLowerCase();
    
    if (networkParam === "base" || networkParam === "solana") {
      setSelectedNetwork(networkParam);
      setShowNetworkSelectionCard(false);
    } else if (networkParam === "send" || typeParam === "send") {
      setSelectedNetwork("send");
      setShowNetworkSelectionCard(false);
    }
    
    if (typeParam === "usdc") setSelectedCrypto("USDC");
    else if (typeParam === "usdt") setSelectedCrypto("USDT");
    else if (networkParam !== "base" && networkParam !== "solana" && typeParam !== "usdc" && typeParam !== "usdt") {
      setSelectedCrypto("SEND");
    }

    // Check dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    
    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [router, searchParams]);

  // Fetch sell rates (1 token = X NGN) and minimum offramp
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(getApiUrl("/api/token-prices")).then((res) => res.json()),
      fetch(getApiUrl("/api/rate")).then((res) => res.json()),
    ])
      .then(([priceData, rateData]) => {
        if (cancelled) return;
        if (priceData?.success && priceData.pricesNGNSell) {
          const prices: Record<string, number> = {};
          for (const [k, v] of Object.entries(priceData.pricesNGNSell)) {
            if (typeof v === "number" && v > 0) prices[k] = v;
          }
          setPricesNGNSell(prices);
        }
        if (rateData?.success && rateData.minimumOfframpSEND != null) {
          setMinimumOfframpSEND(Number(rateData.minimumOfframpSEND) || 1);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Fetch bank list from Flutterwave so codes match API (verification + payout)
  useEffect(() => {
    setLoadingBanks(true);
    fetch(getApiUrl("/api/flutterwave/banks"))
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data?.data?.banks) && data.data.banks.length > 0) {
          setBanksList(data.data.banks);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBanks(false));
  }, []);

  // Sync network, networkType, and crypto from selectedNetwork (network first, then crypto)
  useEffect(() => {
    if (selectedNetwork === "send") {
      setNetworkType("send");
      setNetwork("base");
      setSelectedCrypto("SEND");
    } else if (selectedNetwork === "base") {
      setNetworkType("base");
      setNetwork("base");
      setSelectedCrypto((prev) => (prev === "SEND" ? "USDC" : prev));
    } else {
      setNetworkType("solana");
      setNetwork("solana");
      setSelectedCrypto((prev) => (prev === "SEND" ? "USDC" : prev));
    }
  }, [selectedNetwork]);

  // Update sell rate when selectedCrypto changes
  useEffect(() => {
    const rate = pricesNGNSell[selectedCrypto];
    setSellRate(rate != null ? rate : null);
  }, [selectedCrypto, pricesNGNSell]);

  // Close bank dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close crypto dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cryptoDropdownRef.current && !cryptoDropdownRef.current.contains(e.target as Node)) {
        setCryptoDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Watch for SEND at deposit address: poll balance every 4s when pending SEND off-ramp
  useEffect(() => {
    if (!walletAddress || !transactionId || !user?.email || network !== "base" || !isSendFlow) return;
    if (payoutSuccess || processingPayout) return;

    const checkBalance = async () => {
      try {
        const res = await fetch(
          getApiUrl(`/api/offramp/check-balance?transactionId=${encodeURIComponent(transactionId)}&userEmail=${encodeURIComponent(user.email)}`)
        );
        const data = await res.json();
        if (data?.success && data?.hasTokens) {
          setSendDetected({ balance: data.sendBalance });
          // Auto-trigger sweep + payout
          setProcessingPayout(true);
          setPayoutError("");
          const triggerRes = await fetch(getApiUrl("/api/offramp/trigger-payout"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId, userEmail: user.email }),
          });
          const triggerData = await triggerRes.json();
          setProcessingPayout(false);
          if (triggerData.success) {
            setPayoutSuccess({
              message: triggerData.message || "Processing complete. Naira has been sent to your bank account.",
              ngnAmount: triggerData.ngnAmount,
            });
          } else {
            setPayoutError(triggerData.error || "Processing failed. Try again or wait for automatic payout.");
          }
        }
      } catch {
        // Ignore poll errors (network, etc.)
      }
    };

    const interval = setInterval(checkBalance, 4000);
    checkBalance(); // Run once immediately
    return () => clearInterval(interval);
  }, [walletAddress, transactionId, user?.email, network, isSendFlow, payoutSuccess, processingPayout]);

  const handleVerifyAccount = async () => {
    if (!accountNumber || accountNumber.replace(/\D/g, "").length !== 10 || !selectedBankCode) {
      setError("Enter account number and select bank first");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const res = await fetch(getApiUrl("/api/flutterwave/verify-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
          bankCode: selectedBankCode,
          bankName: selectedBankName || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.accountName) {
        setVerifiedAccountName(data.data.accountName);
      } else {
        setError(data.error || "Could not verify account");
        setVerifiedAccountName("");
      }
    } catch (e) {
      setError("Verification failed. Try again.");
      setVerifiedAccountName("");
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = async () => {
    if (!accountNumber || accountNumber.replace(/\D/g, "").length !== 10) {
      setError("Please enter a valid 10-digit account number");
      return;
    }
    if (!selectedBankCode) {
      setError("Please select your bank");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (isSendFlow) {
        const response = await fetch(getApiUrl("/api/offramp/verify-and-create"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
            bankCode: selectedBankCode,
            bankName: selectedBankName || undefined,
            accountName: verifiedAccountName || undefined,
            userEmail: user?.email,
            network: "base",
            token: selectedCrypto,
          }),
        });
        const data = await response.json();
        if (data.success) {
          setVerifiedAccountName(data.accountName ?? "");
          setWalletAddress(data.depositAddress ?? "");
          setTransactionId(data.transactionId ?? "");
          setError("");
        } else {
          const errMsg = (data.error && String(data.error).trim()) || (data.message && String(data.message).trim());
          setError(errMsg && errMsg !== "No message available" ? errMsg : "Could not verify account. Check number and bank.");
        }
        return;
      }

      const networkForApi = network;
      const response = await fetch(getApiUrl("/api/offramp/generate-address"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: accountNumber.trim().replace(/\D/g, "").slice(0, 10),
          accountName: undefined,
          bankCode: selectedBankCode || undefined,
          bankName: selectedBankName || undefined,
          userEmail: user?.email,
          network: networkForApi,
          token: selectedCrypto,
        }),
      });
      const data = await response.json();
      if (data.success) {
        let address = data.walletAddress;
        if (typeof address === "string" && networkForApi === "base" && address.includes("addressId:")) {
          const match = address.match(/(0x[a-fA-F0-9]{40})/);
          if (match) address = match[1];
        }
        if (address && address.length >= 10) {
          setWalletAddress(address);
          setTransactionId(data.transactionId);
        } else {
          setError("Invalid wallet address received. Please try again.");
        }
      } else {
        setError(data.error || data.message || "Failed to generate wallet address");
      }
    } catch (err: any) {
      setError(isSendFlow ? "Verification failed. Please try again." : "Failed to generate wallet address. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract clean address for display
  const getCleanAddress = (address: string) => {
    if (!address) return "";
    if (network === "base") {
      const match = address.match(/(0x[a-fA-F0-9]{40})/);
      return match ? match[1] : address;
    }
    return address;
  };

  const handleIHaveTransferred = async () => {
    if (!transactionId || !user?.email) {
      setPayoutError("Session missing. Please refresh and try again.");
      return;
    }
    setPayoutError("");
    setPayoutSuccess(null);
    setProcessingPayout(true);
    const controller = new AbortController();
    // Sweep + Paymaster + RPC retries can take 2+ min; allow up to 2.5 min before client abort
    const timeoutMs = 150_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    setPayoutTakingLong(false);
    const slowMessageId = setTimeout(() => setPayoutTakingLong(true), 45_000);
    try {
      const res = await fetch(getApiUrl("/api/offramp/trigger-payout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, userEmail: user.email }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      clearTimeout(slowMessageId);
      const data = await res.json();
      if (data.success) {
        setPayoutSuccess({
          message: data.message || "Processing complete. Naira has been sent to your bank account.",
          ngnAmount: data.ngnAmount,
          sendAmount: data.sendAmount,
        });
      } else {
        setPayoutError(data.error || "Processing failed. Try again or wait for automatic payout.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      clearTimeout(slowMessageId);
      if (err?.name === "AbortError") {
        setPayoutError("Request took too long. The sweep may still complete in the background—check your bank in a few minutes or try again.");
      } else {
        setPayoutError(err?.message || "Request failed. Try again.");
      }
    } finally {
      setProcessingPayout(false);
      setPayoutTakingLong(false);
    }
  };

  const cleanAddress = getCleanAddress(walletAddress);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show a better notification with dark mode support
    const notification = document.createElement("div");
    notification.className = "fixed top-4 right-4 bg-green-500 dark:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
    notification.textContent = "✓ Copied to clipboard!";
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background-dark relative flex flex-col items-center p-4 pb-24 lg:pb-8">
      {/* Background blur orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="w-full max-w-lg mt-4 lg:mt-6 relative flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-4 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="hidden lg:flex absolute left-0 top-0 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold mb-1 tracking-tight text-white font-display">Crypto to Naira</h1>
          <p className="text-accent/70">Withdraw to your bank account instantly</p>
        </div>

        {/* Network Selection Card - centered overlay (same position as Naira to Crypto modal) */}
        {!walletAddress && showNetworkSelectionCard && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm"
            onClick={() => router.back()}
          >
            <div
              className="w-full max-w-sm bg-surface/95 backdrop-blur-[24px] rounded-xl border border-secondary/10 shadow-xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white font-display">Select Crypto Network</h2>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="p-1.5 rounded-lg hover:bg-primary/40 text-accent/70 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <span className="material-icons-outlined text-lg">close</span>
                </button>
              </div>
              <p className="text-xs text-accent/70 mb-3">Choose the network you want to withdraw from</p>
              <div className="space-y-2">
                {(["send", "base", "solana"] as const).map((net) => {
                  const isComingSoon = net === "base" || net === "solana";
                  const content = (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/60 flex items-center justify-center overflow-hidden flex-shrink-0 border border-accent/10">
                        {net === "send" ? (
                          getTokenLogo("SEND") ? (
                            <img src={getTokenLogo("SEND")!} alt="SEND" className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="text-secondary font-bold text-sm">S</span>
                          )
                        ) : getChainLogo(net) ? (
                          <img src={getChainLogo(net)} alt={net} className={`w-5 h-5 object-contain ${isComingSoon ? "opacity-70" : ""}`} />
                        ) : (
                          <span className="text-secondary font-bold text-xs">{net === "base" ? "B" : "S"}</span>
                        )}
                      </div>
                      <span className={`font-semibold text-sm uppercase tracking-wide ${isComingSoon ? "text-accent/80" : "text-white"}`}>
                        {net === "send" ? "SEND" : net === "base" ? "BASE" : "SOLANA"}
                      </span>
                    </div>
                  );
                  if (isComingSoon) {
                    return (
                      <div
                        key={net}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/40 border border-accent/10 opacity-60 cursor-not-allowed"
                        aria-disabled="true"
                      >
                        {content}
                        <span className="text-[10px] font-semibold text-accent/60 uppercase tracking-wider">Coming soon</span>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={net}
                      type="button"
                      onClick={() => {
                        setSelectedNetwork(net);
                        setShowNetworkSelectionCard(false);
                        setCryptoDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/40 border border-accent/10 hover:border-secondary/30 hover:bg-surface-highlight transition-all text-left group cursor-pointer"
                    >
                      {content}
                      <span className="material-icons-outlined text-accent/60 text-lg group-hover:text-secondary transition-colors">arrow_forward</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Form Card - shown when network selected or when deposit address exists (centered like selector) */}
        {(walletAddress || !showNetworkSelectionCard) && (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-full bg-surface/60 backdrop-blur-[24px] rounded-xl p-3 sm:p-4 border border-secondary/10 shadow-2xl relative">
          <div className="absolute inset-0 overflow-hidden rounded-xl -z-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl" />
          </div>
          {!walletAddress ? (
            <>
              {error && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                  <p>{error}</p>
                  {error.includes("pending off-ramp") && user?.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        setCancellingPending(true);
                        setLoading(false);
                        try {
                          const res = await fetch(getApiUrl("/api/offramp/cancel-pending"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userEmail: user.email }),
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            setError("");
                            setCancellingPending(false);
                            setLoading(true);
                            await handleContinue();
                          } else {
                            setError(data?.error || "Could not cancel. Try again.");
                          }
                        } catch (e) {
                          setError("Could not cancel. Try again.");
                        } finally {
                          setCancellingPending(false);
                        }
                      }}
                      disabled={cancellingPending}
                      className="mt-2 w-full py-2.5 rounded-lg bg-primary/40 border border-accent/10 text-accent text-sm font-medium hover:bg-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingPending ? "Cancelling…" : "Cancel pending and start new"}
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {/* You Send */}
                <div className="space-y-1.5 mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">You Send</label>
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all flex-wrap">
                    <div className="flex flex-col flex-1 min-w-0">
                      <input
                        id="send_amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\.\d*)\./g, "$1");
                          setSendAmount(v);
                        }}
                        className="bg-transparent border-none p-0 text-xl font-bold focus:ring-0 w-full outline-none text-white placeholder-white/20"
                      />
                      <span className="text-xs text-accent/60">Min: {minimumAmount} {selectedCrypto}</span>
                    </div>
                    {/* Crypto dropdown (network already selected from card) */}
                    <div ref={cryptoDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => selectedNetwork !== "send" && setCryptoDropdownOpen(!cryptoDropdownOpen)}
                        className={`flex items-center gap-2 bg-primary px-3 py-2 rounded-xl border border-accent/5 hover:border-accent/20 transition-colors ${selectedNetwork === "send" ? "cursor-default" : ""}`}
                      >
                        {getTokenLogo(selectedCrypto) ? (
                          <img src={getTokenLogo(selectedCrypto)!} alt={selectedCrypto} className="w-5 h-5 rounded-full object-cover" />
                        ) : null}
                        <span className="font-bold text-white text-sm">{selectedCrypto}</span>
                        {selectedNetwork !== "send" && (
                          <span className="material-icons-outlined text-accent/60 text-sm">{cryptoDropdownOpen ? "expand_less" : "expand_more"}</span>
                        )}
                      </button>
                      {cryptoDropdownOpen && selectedNetwork !== "send" && (
                        <div className="absolute top-full right-0 mt-1 z-20 rounded-xl border border-secondary/20 bg-surface/95 backdrop-blur-xl shadow-xl overflow-hidden min-w-[140px]">
                          {(["USDC", "USDT"] as const).map((token) => (
                            <button
                              key={token}
                              type="button"
                              onClick={() => {
                                setSelectedCrypto(token);
                                setCryptoDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-primary/60 transition-colors ${selectedCrypto === token ? "bg-primary/40 text-secondary" : "text-white"}`}
                            >
                              {getTokenLogo(token) ? (
                                <img src={getTokenLogo(token)!} alt={token} className="w-5 h-5 rounded-full object-cover" />
                              ) : null}
                              <span className="font-medium">{token}</span>
                              {selectedCrypto === token && (
                                <span className="material-icons-outlined text-secondary text-sm ml-auto">check</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-0.5">
                  <div className="bg-primary border border-accent/10 rounded-full p-1.5 z-10">
                    <span className="material-icons-outlined text-secondary">arrow_downward</span>
                  </div>
                </div>

                {/* You Receive */}
                <div className="space-y-1.5 mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">You Receive</label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-primary/40 border border-accent/10">
                    <div className="flex flex-col">
                      <div className="text-xl font-bold text-white">
                        {sendAmountNum > 0 && sellRate != null && sellRate > 0
                          ? `₦${ngnAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "0.00"}
                      </div>
                      {sellRate != null && sellRate > 0 ? (
                        <span className="text-xs text-accent/60">
                          Rate: 1 {selectedCrypto} = <span className="text-secondary font-semibold">{sellRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN</span>
                        </span>
                      ) : (
                        <span className="text-xs text-accent/60">Loading sell rate…</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-primary px-3 py-2 rounded-xl border border-accent/5">
                      <span className="text-sm font-bold text-white">🇳🇬 NGN</span>
                    </div>
                  </div>
                </div>

                {/* Destination Bank Account */}
                <div className="space-y-1.5 mb-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">Destination Bank Account</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                      <span className="material-icons-outlined text-accent/40">account_balance</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setAccountNumber(value);
                          setVerifiedAccountName("");
                        }}
                        placeholder="10-digit NUBAN"
                        className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/20 focus:ring-0 outline-none"
                        maxLength={10}
                      />
                    </div>
                    <div ref={bankDropdownRef} className="relative min-w-0">
                      <button
                          type="button"
                          onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-icons-outlined text-secondary">account_balance</span>
                            <div className="text-left">
                              <div className="text-sm font-medium text-white">{selectedBankName || "Select bank"}</div>
                              {verifiedAccountName && (
                                <div className="text-xs text-accent/60">{verifiedAccountName} • {accountNumber ? `${accountNumber.slice(0, 3)}****${accountNumber.slice(-3)}` : ""}</div>
                              )}
                            </div>
                          </div>
                          <span className="material-icons-outlined text-accent/60">expand_more</span>
                        </button>
                        {bankDropdownOpen && (
                          <div className="absolute z-20 left-0 right-0 mt-2 min-w-0 w-full rounded-2xl border border-secondary/20 bg-surface/95 backdrop-blur-xl shadow-xl max-h-56 overflow-hidden">
                            <input
                              type="text"
                              value={bankSearchQuery}
                              onChange={(e) => setBankSearchQuery(e.target.value)}
                              placeholder="Search banks..."
                              className="w-full px-4 py-3 border-b border-white/10 bg-surface text-white placeholder-white/40 text-sm focus:outline-none focus:ring-0"
                            />
                            <div className="overflow-y-auto overflow-x-hidden max-h-44 custom-scrollbar">
                              {filteredBanks.map((bank, index) => (
                                <button
                                  key={`${bank.code}-${bank.name}-${index}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBankCode(bank.code);
                                    setBankDropdownOpen(false);
                                    setBankSearchQuery("");
                                    setVerifiedAccountName("");
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-primary/50"
                                >
                                  {bank.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                  </div>
                </div>

                {/* Verify account (SEND flow) */}
                {isSendFlow && (
                  <>
                    <button
                      type="button"
                      onClick={handleVerifyAccount}
                      disabled={verifying || accountNumber.replace(/\D/g, "").length !== 10 || !selectedBankCode}
                      className="w-full py-2.5 rounded-lg border-2 border-secondary/40 text-secondary font-semibold hover:bg-secondary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      <span className="material-icons-outlined text-lg">verified_user</span>
                      {verifying ? "Verifying…" : "Verify account"}
                    </button>
                    {verifiedAccountName && (
                      <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/30">
                        <p className="text-sm text-secondary font-medium flex items-center gap-2">
                          <span className="material-icons-outlined text-lg">check_circle</span>
                          {verifiedAccountName} • {selectedBankName}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Continue */}
                {isSendFlow && sendAmountNum > 0 && !meetsMinimumSell && (
                  <p className="text-sm text-amber-400">
                    Minimum sell amount is {minimumAmount} {selectedCrypto}.
                  </p>
                )}
                <button
                  onClick={handleContinue}
                  disabled={
                    loading ||
                    accountNumber.replace(/\D/g, "").length !== 10 ||
                    !selectedBankCode ||
                    (isSendFlow && !verifiedAccountName) ||
                    !meetsMinimumSell
                  }
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <span className="material-icons-outlined font-bold">account_balance</span>
                  {loading ? (isSendFlow ? "Verifying…" : "Generating…") : isSendFlow ? "Withdraw to Bank" : "Generate Wallet Address"}
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 text-accent/60">
                  <span className="material-icons-outlined text-sm text-secondary">bolt</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Instant Processing</span>
                </div>
                <div className="flex items-center gap-1.5 text-accent/60">
                  <span className="material-icons-outlined text-sm text-secondary">lock</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold">End-to-End Secure</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-white mb-3">
                Send Crypto to This Address
              </h2>

              {verifiedAccountName && (
                <div className="mb-3 p-3 rounded-xl bg-secondary/10 border border-secondary/30">
                  <p className="text-xs font-medium text-secondary mb-1">Payout account name</p>
                  <p className="text-base font-semibold text-white">{verifiedAccountName}</p>
                </div>
              )}

              <div className="space-y-3">
                {/* Network Badge */}
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 border border-secondary/30 rounded-full text-sm">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                    <span className="font-semibold text-secondary">
                      {networkType === "send" ? "Send Token" : networkType === "base" ? "Base Network" : "Solana Network"}
                    </span>
                  </div>
                </div>

                {/* QR Code Section */}
                {cleanAddress && (
                  <div className="rounded-lg p-2.5 bg-primary/40 border border-accent/10">
                    <div className="flex flex-col items-center space-y-2">
                      <div className="bg-white p-1.5 rounded-md">
                        <QRCodeSVG
                          value={cleanAddress}
                          size={120}
                          level="H"
                          includeMargin={true}
                          fgColor="#1a1a1a"
                          bgColor="#ffffff"
                        />
                      </div>
                      <p className="text-xs text-accent/60 text-center">
                        Scan to send crypto to this address
                      </p>
                    </div>
                  </div>
                )}

                {/* Wallet Address Section */}
                <div className="rounded-lg p-2.5 bg-primary/40 border border-accent/10">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-accent">Wallet Address</p>
                    <button
                      onClick={() => copyToClipboard(cleanAddress)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-primary rounded-lg text-xs font-semibold hover:bg-secondary/90 transition-colors"
                    >
                      <span className="material-icons-outlined text-sm">content_copy</span>
                      Copy
                    </button>
                  </div>
                  <div className="bg-primary/50 rounded-lg p-2.5 border border-white/5">
                    <p className="font-mono text-sm break-all text-white leading-relaxed">
                      {cleanAddress}
                    </p>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user?.email || refreshingAddress) return;
                        setRefreshingAddress(true);
                        try {
                          const res = await fetch(getApiUrl(`/api/offramp/pending?userEmail=${encodeURIComponent(user.email)}`));
                          const data = await res.json();
                          if (data?.success && data?.hasPending && data?.depositAddress) {
                            setWalletAddress(data.depositAddress);
                            setTransactionId(data.transactionId ?? transactionId);
                            if (data.accountName) setVerifiedAccountName(data.accountName);
                          }
                        } finally {
                          setRefreshingAddress(false);
                        }
                      }}
                      disabled={refreshingAddress}
                      className="flex items-center gap-2 text-xs text-accent/60 hover:text-secondary underline disabled:opacity-50"
                    >
                      <svg
                        className={`w-4 h-4 ${refreshingAddress ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {refreshingAddress ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                </div>

                {/* Instructions: automatic sweep + payout */}
                <div className="bg-secondary/10 border border-secondary/30 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-icons-outlined text-secondary">info</span>
                    <p className="text-sm font-bold text-secondary">Automatic payout</p>
                  </div>
                  <ol className="text-xs text-accent space-y-2 list-decimal list-inside">
                    <li className="leading-relaxed">
                      {networkType === "send" ? (
                        <>Send only <span className="font-semibold">{selectedCrypto === "SEND" ? "$SEND" : selectedCrypto}</span> to the wallet address above (Base network)</>
                      ) : (
                        <>
                          Send <span className="font-semibold">
                            {networkType === "base" ? "BASE TOKENS" : "SOLANA TOKENS"}
                          </span> to the wallet address above
                          {network === "base" && " (Base network)"}
                          {network === "solana" && " (Solana network)"}
                        </>
                      )}
                    </li>
                    <li className="leading-relaxed">
                      We automatically detect your transfer and send Naira to your bank. This is usually within a few minutes. No need to click anything after sending.
                    </li>
                  </ol>
                </div>

                {sendDetected && !payoutSuccess && (
                  <div className="rounded-2xl bg-secondary/10 border border-secondary/30 p-4">
                    <p className="text-sm font-semibold text-secondary">
                      Your {sendDetected.balance} SEND payment detected — processing payout…
                    </p>
                    {sellRate != null && sellRate > 0 && (
                      <p className="text-xs text-accent/80 mt-1">
                        ≈ ₦{(parseFloat(sendDetected.balance || "0") * sellRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be sent to your bank
                      </p>
                    )}
                  </div>
                )}
                {payoutError && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4">
                    <p className="text-sm text-red-400">{payoutError}</p>
                  </div>
                )}
                {payoutSuccess && (
                  <div className="rounded-2xl bg-secondary/10 border border-secondary/30 p-4">
                    <p className="text-sm font-semibold text-secondary">{payoutSuccess.message}</p>
                    {(payoutSuccess.sendAmount != null || payoutSuccess.ngnAmount != null) && (
                      <p className="text-sm text-accent mt-1">
                        {payoutSuccess.sendAmount != null && (
                          <span>{payoutSuccess.sendAmount} SEND</span>
                        )}
                        {payoutSuccess.sendAmount != null && payoutSuccess.ngnAmount != null && " → "}
                        {payoutSuccess.ngnAmount != null && (
                          <span>₦{payoutSuccess.ngnAmount.toLocaleString()} sent to your bank</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-accent/60 text-center">
                  Watching for SEND… We check every few seconds. Or trigger manually:
                </p>
                <button
                  onClick={handleIHaveTransferred}
                  disabled={processingPayout || !transactionId}
                  className="w-full py-4 rounded-2xl border-2 border-secondary/40 text-secondary font-semibold hover:bg-secondary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                >
                  {processingPayout ? "Processing…" : `I've sent ${selectedCrypto} — process now`}
                </button>
                {payoutTakingLong && (
                  <p className="text-sm text-amber-400 text-center mt-2">
                    Still processing… This can take up to 2 minutes. Don&apos;t close the page.
                  </p>
                )}

                <button
                  onClick={() => {
                    setWalletAddress("");
                    setTransactionId("");
                    setVerifiedAccountName("");
                    setAccountNumber("");
                    setSelectedBankCode("");
                    setSelectedNetwork("send");
                    setShowNetworkSelectionCard(true);
                    setNetwork("base");
                    setPayoutError("");
                    setPayoutSuccess(null);
                    setSendDetected(null);
                  }}
                  className="w-full py-3 rounded-2xl border border-accent/30 text-accent font-semibold hover:bg-accent/10 transition-colors"
                >
                  Start New Transaction
                </button>
              </div>
            </>
          )}
          </div>
        </div>
        )}

        <PoweredBySEND />
      </div>
    </div>
  );
}

export default function OffRampPage() {
  return (
    <DashboardLayout>
    <Suspense
      fallback={
        <PageLoadingSpinner message="Loading..." bgClass="bg-background-light dark:bg-background-dark" />
      }
    >
      <OffRampPageContent />
    </Suspense>
    </DashboardLayout>
  );
}

"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { isValidWalletOrTag, isValidAmount, isValidSolanaAddress } from "@/utils/validation";
import Modal from "./Modal";
import Toast from "./Toast";
import PoweredBySEND from "./PoweredBySEND";
import { calculateSendAmount } from "@/lib/transactions";
import { getUserFromStorage } from "@/lib/session";
import { getTokenLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";

// Helper function to safely access localStorage (for mobile browser compatibility)
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`Error getting localStorage item ${key}:`, e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`Error setting localStorage item ${key}:`, e);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing localStorage item ${key}:`, e);
    }
  },
};


interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  hasVirtualAccount: boolean;
}

export type PaymentNetwork = "send" | "base" | "solana";

interface PaymentFormProps {
  network?: PaymentNetwork;
}

export default function PaymentForm({ network = "send" }: PaymentFormProps) {
  const [ngnAmount, setNgnAmount] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("0.00");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTransactionCompleted, setIsTransactionCompleted] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(50);
  const [minimumPurchase, setMinimumPurchase] = useState<number>(3000);
  const [selectedStablecoin, setSelectedStablecoin] = useState<"USDC" | "USDT">("USDC");
  /** 1 SEND = buyRateNGN NGN (onramp buy price). Same shape as offramp's sellRate. Null = not loaded yet. */
  const [buyRateNGN, setBuyRateNGN] = useState<number | null>(null);
  const [stablecoinPricesNGN, setStablecoinPricesNGN] = useState<{ USDC: number | null; USDT: number | null }>({ USDC: null, USDT: null });
  const [isStablecoinDropdownOpen, setIsStablecoinDropdownOpen] = useState(false);
  const stablecoinDropdownRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<{
    ngnAmount?: string;
    walletAddress?: string;
  }>({});
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [isLoadingVirtualAccount, setIsLoadingVirtualAccount] = useState(false);
  const [paymentGenerated, setPaymentGenerated] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [isCheckingNow, setIsCheckingNow] = useState(false);
  const [transactionsEnabled, setTransactionsEnabled] = useState(true);
  const [rateFromApi, setRateFromApi] = useState(false); // true when rate/min were loaded from backend API
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ZainPay dynamic virtual account state
  const [zainpayAccount, setZainpayAccount] = useState<{
    accountNumber: string;
    bankName: string;
    accountName: string;
    amount: number;
    transactionId: string;
  } | null>(null);
  const [isWaitingForTransfer, setIsWaitingForTransfer] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Note: Virtual account is now only fetched/created when "Generate Payment" is clicked
  // This ensures account details are only shown after user initiates payment

  // Auto-claim pending transactions on mount
  useEffect(() => {
    const checkForPendingTransactions = async () => {
      // Get stored transaction ID from localStorage
      const storedTxId = safeLocalStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = safeLocalStorage.getItem("walletAddress");
      const storedAmount = safeLocalStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is completed (webhook should have processed it)
        const response = await fetch(getApiUrl(`/api/transactions/create-id?transactionId=${storedTxId}`));
        const data = await response.json();
        if (data.success && data.exists && data.status === "completed" && data.txHash) {
          // Transaction was completed by webhook!
          setModalData({
            title: "Tokens Received! 🎉",
            message: "Your payment was processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.txHash ? `https://basescan.org/tx/${data.txHash}` : undefined,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          safeLocalStorage.removeItem("transactionId");
          safeLocalStorage.removeItem("walletAddress");
          safeLocalStorage.removeItem("ngnAmount");
          
          // Refresh page after 3 seconds
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (error) {
        console.error("Error checking for pending transactions:", error);
        // Silent fail - don't show error to user
      }
    };
    
    // Only check if we have a stored transaction ID and form is not being used
    const storedId = safeLocalStorage.getItem("transactionId");
    if (storedId && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Check for existing transaction ID in localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = safeLocalStorage.getItem("transactionId");
      if (storedId) {
        // Check if transaction ID exists in database
        fetch(getApiUrl(`/api/transactions/create-id?transactionId=${storedId}`))
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.exists) {
              setTransactionId(storedId);
              console.log("[PaymentForm] Restored transaction ID from localStorage:", storedId);
            } else {
              // Transaction ID doesn't exist in database, generate new one
              generateNewTransactionId();
            }
          })
          .catch(() => {
            // On error, generate new ID
            generateNewTransactionId();
          });
      } else {
        // No stored ID, will generate when user inputs amount
      }
    }
  }, []);

  // Generate new transaction ID and store in database
  const generateNewTransactionId = async () => {
    try {
      const response = await fetch(getApiUrl("/api/transactions/create-id"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success && data.transactionId) {
        const id = data.transactionId;
        setTransactionId(id);
        if (typeof window !== "undefined") {
          safeLocalStorage.setItem("transactionId", id);
        }
        console.log("[PaymentForm] Generated new transaction ID:", id);
      }
    } catch (error) {
      console.error("Failed to generate transaction ID:", error);
      // Fallback: generate locally
      const id = nanoid();
      setTransactionId(id);
      if (typeof window !== "undefined") {
        localStorage.setItem("transactionId", id);
      }
    }
  };

  // Load minimum purchase, rate, and transactions from DB via same-origin proxy.
  // Proxy (app/api/payment-rate) runs on frontend server and fetches backend → no CORS; Min always from DB.
  useEffect(() => {
    let cancelled = false;

    const syncFromAdmin = () => {
      const t = Date.now();

      // Same-origin: frontend server fetches backend and returns rate + minimumPurchase (from DB)
      fetch(`/api/payment-rate?t=${t}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          // Minimum purchase – from DB via proxy; always apply
          const minVal = data.minimumPurchase ?? data.minimum_purchase;
          if (minVal !== undefined && minVal !== null) {
            const m = Number(minVal);
            setMinimumPurchase(Number.isNaN(m) || m < 0 ? 3000 : m);
          }
          if (data.transactionsEnabled !== undefined) {
            setTransactionsEnabled(data.transactionsEnabled !== false);
          }
          if (data.rate != null) {
            const r = Number(data.rate);
            if (!Number.isNaN(r) && r > 0) {
              setExchangeRate(r);
              setBuyRateNGN((prev) => (prev != null ? prev : 1 / r));
            }
          }
          setRateFromApi(Boolean(data.rateFromApi));
        })
        .catch(() => { if (!cancelled) setRateFromApi(false); });

      // Token prices for buy rate display (optional; proxy already gives rate fallback)
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "").trim() || (typeof window !== "undefined" && window.location.port === "3000" ? "http://localhost:3001" : "");
      const pricesUrl = base ? `${base}/api/token-prices?t=${t}` : `/api/token-prices?t=${t}`;
      fetch(pricesUrl, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data?.success || !data.pricesNGN) return;
          const sendNgn = Number(data.pricesNGN.SEND);
          if (!Number.isNaN(sendNgn) && sendNgn > 0) {
            setBuyRateNGN(sendNgn);
            setExchangeRate(1 / sendNgn);
          }
          setStablecoinPricesNGN({
            USDC: data.pricesNGN.USDC ?? null,
            USDT: data.pricesNGN.USDT ?? null,
          });
        })
        .catch(() => {});
    };

    // Fetch immediately on mount, then every 10 s
    syncFromAdmin();
    const interval = setInterval(syncFromAdmin, 10000);

    // Re-sync on tab focus / visibility
    const onFocus = () => syncFromAdmin();
    const onVisible = () => { if (!document.hidden) syncFromAdmin(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // Re-sync immediately when admin saves any setting (same-tab event)
    const onAdminSave = () => syncFromAdmin();
    window.addEventListener("exchangeRateUpdated" as any, onAdminSave);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("exchangeRateUpdated" as any, onAdminSave);
    };
  }, []);

  // effectiveExchangeRate: tokens received per 1 NGN (used for calculation: sendAmount = ngnAmount * effectiveExchangeRate)
  // SEND:  1/buyRateNGN  (e.g. 1/38.51 ≈ 0.026 SEND per NGN)
  // USDC/USDT: 1/priceNGN
  const effectiveExchangeRate =
    network === "send"
      ? (buyRateNGN != null && buyRateNGN > 0 ? 1 / buyRateNGN : exchangeRate)
      : (() => {
          const priceNGN = selectedStablecoin === "USDC" ? stablecoinPricesNGN.USDC : stablecoinPricesNGN.USDT;
          return priceNGN && priceNGN > 0 ? 1 / priceNGN : 0;
        })();

  // Close stablecoin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stablecoinDropdownRef.current && !stablecoinDropdownRef.current.contains(e.target as Node)) {
        setIsStablecoinDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate crypto amount based on NGN amount and effective rate
  useEffect(() => {
    if (ngnAmount && parseFloat(ngnAmount) > 0 && effectiveExchangeRate > 0) {
      const calculated = (parseFloat(ngnAmount) * effectiveExchangeRate).toFixed(
        network === "send" ? 2 : 6
      );
      setSendAmount(calculated);

      // Always ensure transaction ID exists when amount is entered
      // Check both state and localStorage
      const storedId = safeLocalStorage.getItem("transactionId");
      const currentId = transactionId || storedId;
      
      if (!currentId || currentId.trim() === "") {
        console.log(`[PaymentForm] Generating transaction ID for amount: ${ngnAmount}`);
        generateNewTransactionId();
      } else {
        // Ensure state is synced with localStorage
        if (currentId !== transactionId) {
          setTransactionId(currentId);
        }
        // Update existing transaction ID with amount and exchange rate
        updateTransactionIdWithAmount(parseFloat(ngnAmount), calculated);
      }
    } else {
      setSendAmount("0.00");
    }
  }, [ngnAmount, effectiveExchangeRate, network]);

  // Update transaction ID in database with amount and exchange rate
  const updateTransactionIdWithAmount = async (amount: number, sendAmt: string) => {
    if (!transactionId) return;

    try {
      const body: Record<string, unknown> = {
        transactionId,
        ngnAmount: amount,
        sendAmount: sendAmt,
      };
      if (network === "base" || network === "solana") {
        body.exchangeRate = effectiveExchangeRate;
        body.network = network;
        body.token = selectedStablecoin;
      }
      const response = await fetch(getApiUrl("/api/transactions/create-id"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        console.log("[PaymentForm] Updated transaction ID with amount:", transactionId);
      }
    } catch (error) {
      console.error("Failed to update transaction ID:", error);
    }
  };

  // Auto-claim pending transactions on mount
  useEffect(() => {
    const checkForPendingTransactions = async () => {
      // Get stored transaction ID from localStorage
      const storedTxId = safeLocalStorage.getItem("transactionId");
      if (!storedTxId) return;
      
      // Get stored wallet address and amount if available
      const storedWallet = safeLocalStorage.getItem("walletAddress");
      const storedAmount = safeLocalStorage.getItem("ngnAmount");
      
      if (!storedWallet || !storedAmount) return;
      
      // Only check if form is not being used
      if (ngnAmount || walletAddress) return;
      
      try {
        // Check if this transaction is completed (webhook should have processed it)
        const response = await fetch(getApiUrl(`/api/transactions/create-id?transactionId=${storedTxId}`));
        const data = await response.json();
        if (data.success && data.exists && data.status === "completed" && data.txHash) {
          // Transaction was completed by webhook!
          setModalData({
            title: "Tokens Received! 🎉",
            message: "Your payment was processed and tokens have been sent to your wallet.",
            type: "success",
            txHash: data.txHash,
            explorerUrl: data.txHash ? `https://basescan.org/tx/${data.txHash}` : undefined,
          });
          setShowModal(true);
          
          // Clear stored transaction ID
          safeLocalStorage.removeItem("transactionId");
          safeLocalStorage.removeItem("walletAddress");
          safeLocalStorage.removeItem("ngnAmount");
          
          // Refresh page after 3 seconds
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (error) {
        console.error("Error checking for pending transactions:", error);
        // Silent fail - don't show error to user
      }
    };
    
    // Only check if we have a stored transaction ID and form is not being used
    const storedId = safeLocalStorage.getItem("transactionId");
    if (storedId && !ngnAmount && !walletAddress) {
      checkForPendingTransactions();
    }
  }, []); // Run once on mount

  // Validate form fields (wallet validation depends on network)
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!ngnAmount || !isValidAmount(ngnAmount, minimumPurchase)) {
      newErrors.ngnAmount = `Minimum purchase amount is ₦${minimumPurchase.toLocaleString()}`;
    }

    const trimmedWallet = walletAddress.trim();
    if (network === "solana") {
      if (!trimmedWallet || !isValidSolanaAddress(trimmedWallet)) {
        newErrors.walletAddress = "Please enter a valid Solana wallet address";
      }
    } else {
      if (!trimmedWallet || !isValidWalletOrTag(trimmedWallet)) {
        newErrors.walletAddress = "Please enter a valid Base wallet address (0x...) or SendTag";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Poll every 8 s — calls ZainPay verify API directly so tokens distribute even if webhook fails */
  const startPollingForZainpayPayment = (txId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    setIsPollingPayment(true);

    const handleSuccess = (txHash: string) => {
      clearInterval(pollingIntervalRef.current!);
      pollingIntervalRef.current = null;
      setIsPollingPayment(false);
      setIsWaitingForTransfer(false);
      setZainpayAccount(null);
      safeLocalStorage.removeItem("transactionId");
      safeLocalStorage.removeItem("walletAddress");
      safeLocalStorage.removeItem("ngnAmount");
      setModalData({
        title: "Tokens Received!",
        message: "Your transfer was confirmed and tokens have been sent to your wallet.",
        type: "success",
        txHash,
        explorerUrl: txHash ? `https://basescan.org/tx/${txHash}` : undefined,
      });
      setShowModal(true);
    };

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Primary: ask ZainPay directly if payment was received (triggers distribution)
        const verifyRes = await fetch(getApiUrl(`/api/zainpay/verify-payment?transactionId=${txId}`));
        const verifyData = await verifyRes.json();

        if (verifyData.paid && verifyData.status === "completed" && verifyData.txHash) {
          handleSuccess(verifyData.txHash);
          return;
        }

        // Fallback: check DB in case webhook already processed it
        const dbRes = await fetch(getApiUrl(`/api/transactions/create-id?transactionId=${txId}`));
        const dbData = await dbRes.json();
        if (dbData.success && dbData.status === "completed" && dbData.txHash) {
          handleSuccess(dbData.txHash);
        }
      } catch {
        // silent — keep polling
      }
    }, 8000);
  };

  /** Triggered when user clicks "I have made payment" — immediate single check */
  const handleCheckPaymentNow = async () => {
    if (!zainpayAccount?.transactionId || isCheckingNow) return;
    setIsCheckingNow(true);
    try {
      const verifyRes = await fetch(getApiUrl(`/api/zainpay/verify-payment?transactionId=${zainpayAccount.transactionId}`));
      const verifyData = await verifyRes.json();
      if (verifyData.paid && verifyData.status === "completed" && verifyData.txHash) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsPollingPayment(false);
        setIsWaitingForTransfer(false);
        setZainpayAccount(null);
        safeLocalStorage.removeItem("transactionId");
        safeLocalStorage.removeItem("walletAddress");
        safeLocalStorage.removeItem("ngnAmount");
        setModalData({
          title: "Tokens Received!",
          message: "Your transfer was confirmed and tokens have been sent to your wallet.",
          type: "success",
          txHash: verifyData.txHash,
          explorerUrl: `https://basescan.org/tx/${verifyData.txHash}`,
        });
        setShowModal(true);
        return;
      }
      // Fallback: check DB
      const dbRes = await fetch(getApiUrl(`/api/transactions/create-id?transactionId=${zainpayAccount.transactionId}`));
      const dbData = await dbRes.json();
      if (dbData.success && dbData.status === "completed" && dbData.txHash) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsPollingPayment(false);
        setIsWaitingForTransfer(false);
        setZainpayAccount(null);
        safeLocalStorage.removeItem("transactionId");
        safeLocalStorage.removeItem("walletAddress");
        safeLocalStorage.removeItem("ngnAmount");
        setModalData({
          title: "Tokens Received!",
          message: "Your transfer was confirmed and tokens have been sent to your wallet.",
          type: "success",
          txHash: dbData.txHash,
          explorerUrl: `https://basescan.org/tx/${dbData.txHash}`,
        });
        setShowModal(true);
        return;
      }
      // Payment not found yet
      setModalData({
        title: "Payment Not Confirmed Yet",
        message: "We haven't received your transfer yet. Please wait a moment and try again, or keep waiting — we'll detect it automatically.",
        type: "info",
      });
      setShowModal(true);
    } catch {
      setModalData({
        title: "Check Failed",
        message: "Could not verify your payment right now. Please wait — we're still checking automatically.",
        type: "error",
      });
      setShowModal(true);
    } finally {
      setIsCheckingNow(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission if transaction is already completed
    if (isTransactionCompleted) {
      setToast({
        message: "Transaction already completed. Refreshing page...",
        type: "info",
        isVisible: true,
      });
      setTimeout(() => window.location.reload(), 1000);
      return;
    }

    if (isLoading) return;

    // Validate form
    if (!validateForm()) {
      setToast({
        message: "Please fix the errors in the form",
        type: "error",
        isVisible: true,
      });
      return;
    }

    // Ensure transaction ID exists before proceeding
    const currentTxId = transactionId || safeLocalStorage.getItem("transactionId");
    if (!currentTxId || currentTxId.trim() === "") {
      console.log(`[PaymentForm] Transaction ID missing at submit, generating...`);
      // Generate transaction ID before proceeding
      try {
        const txIdResponse = await fetch(getApiUrl("/api/transactions/create-id"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const txIdData = await txIdResponse.json();
        if (txIdData.success && txIdData.transactionId) {
          setTransactionId(txIdData.transactionId);
          localStorage.setItem("transactionId", txIdData.transactionId);
          console.log(`[PaymentForm] Generated transaction ID: ${txIdData.transactionId}`);
        } else {
          // Fallback: generate locally
          const fallbackId = nanoid();
          setTransactionId(fallbackId);
          localStorage.setItem("transactionId", fallbackId);
          console.log(`[PaymentForm] Generated local transaction ID: ${fallbackId}`);
        }
      } catch (error) {
        console.error(`[PaymentForm] Failed to generate transaction ID:`, error);
        // Fallback: generate locally
        const fallbackId = nanoid();
        setTransactionId(fallbackId);
        localStorage.setItem("transactionId", fallbackId);
      }
    } else {
      // Ensure state is synced
      if (currentTxId !== transactionId) {
        setTransactionId(currentTxId);
      }
    }

    setIsLoading(true);

    try {
      const finalWalletAddress = walletAddress.trim();

      // Require login
      const user = getUserFromStorage();
      if (!user) {
        setModalData({
          title: "Authentication Required",
          message: "Please log in to continue with your payment.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        setTimeout(() => { window.location.href = "/auth"; }, 2000);
        return;
      }

      if (!user.email || user.email.trim() === "") {
        setModalData({
          title: "Account Error",
          message: "Your account email is missing. Please log out and log back in.",
          type: "error",
        });
        setShowModal(true);
        setIsLoading(false);
        return;
      }

      // Always request a fresh transaction ID from the API — never reuse old ones.
      // This guarantees every "Pay now" click generates a brand new DVA with a unique txnRef.
      safeLocalStorage.setItem("walletAddress", finalWalletAddress);
      safeLocalStorage.setItem("ngnAmount", ngnAmount);

      console.log(`[ZainPay] Generating new DVA for ₦${ngnAmount}`);

      // Call ZainPay dynamic account endpoint — no transactionId passed, API generates fresh one
      const res = await fetch(getApiUrl("/api/zainpay/create-dynamic-account"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ngnAmount: parseFloat(ngnAmount),
          walletAddress: finalWalletAddress,
          userId: user.id,
          userEmail: user.email,
          network,
          token: (network === "base" || network === "solana") ? selectedStablecoin : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || "Failed to generate payment account. Please try again.";
        const code = data.details?.code ?? data.code;
        const isZainpayConfig = String(code) === "20" || /Invalid Source Account|ZainboxCode/i.test(String(errMsg));
        const userMsg = isZainpayConfig
          ? "Payment provider is not fully configured. Please ensure Zainpay (Zainbox code and source account) is set up correctly in the backend, or contact support."
          : errMsg;
        throw new Error(userMsg);
      }

      // Always store the fresh transaction ID returned by the API
      setTransactionId(data.transactionId);
      safeLocalStorage.setItem("transactionId", data.transactionId);

      // Show the virtual account UI
      setZainpayAccount({
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        accountName: data.accountName,
        amount: data.amount,
        transactionId: data.transactionId,
      });
      setIsWaitingForTransfer(true);

      // Start polling for payment confirmation
      startPollingForZainpayPayment(data.transactionId);

    } catch (error: any) {
      console.warn("[ZainPay] Payment error:", error?.message || error);
      setModalData({
        title: "Payment Error",
        message: error?.message || "An error occurred. Please try again.",
        type: "error",
      });
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    field: "ngnAmount" | "walletAddress",
    value: string
  ) => {
    if (field === "ngnAmount") {
      setNgnAmount(value);
      // Clear error when user starts typing
      if (errors.ngnAmount) {
        setErrors((prev) => ({ ...prev, ngnAmount: undefined }));
      }
    } else if (field === "walletAddress") {
      setWalletAddress(value);
      // Clear error when user starts typing
      if (errors.walletAddress) {
        setErrors((prev) => ({ ...prev, walletAddress: undefined }));
      }
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Note: Payment checking is now handled by Flutterwave webhook
  // Users will be redirected back after payment completion

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center">
        {/* Header - centered */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-white mb-1">Buy Crypto</h1>
          <p className="text-sm text-accent/80">Convert your NGN to crypto instantly</p>
        </div>

        {/* Form Card - compact */}
        <div className="bg-surface/60 backdrop-blur-[24px] p-4 sm:p-5 rounded-xl border border-secondary/10 w-full space-y-4">
          {/* ZainPay Virtual Account — shown after "Pay Now" is clicked */}
          {isWaitingForTransfer && zainpayAccount && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-base font-semibold text-white">
                  Complete Your Transfer
                </p>
                <p className="text-sm text-accent/80 mt-1">
                  Transfer exactly{" "}
                  <span className="font-bold text-secondary">
                    ₦{zainpayAccount.amount.toLocaleString()}
                  </span>{" "}
                  to the account below
                </p>
              </div>

              <div className="bg-primary/40 border border-accent/10 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-accent/80">Bank</span>
                  <span className="text-sm font-semibold text-white">{zainpayAccount.bankName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-accent/80">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tracking-widest text-white">
                      {zainpayAccount.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(zainpayAccount.accountNumber).then(() => {
                          setCopiedAccount(true);
                          setTimeout(() => setCopiedAccount(false), 2000);
                        });
                      }}
                      className="text-secondary hover:opacity-80 transition-opacity p-1 rounded"
                      title="Copy account number"
                    >
                      {copiedAccount ? (
                        <span className="text-secondary text-xs font-medium">Copied!</span>
                      ) : (
                        <span className="material-icons-outlined text-sm">content_copy</span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-accent/80">Account Name</span>
                  <span className="text-sm font-semibold text-white">{zainpayAccount.accountName}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-accent/10">
                  <span className="text-sm text-accent/80">Amount to transfer</span>
                  <span className="text-base font-bold text-secondary">₦{zainpayAccount.amount.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckPaymentNow}
                disabled={isCheckingNow}
                className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(19,236,90,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isCheckingNow ? (
                  <>
                    <FSpinner size="sm" />
                    Checking payment…
                  </>
                ) : (
                  "I have made payment"
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-accent/60">
                <FSpinner size="xs" className="shrink-0" />
                <span>Also detecting automatically — tokens sent once confirmed.</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                  setIsWaitingForTransfer(false);
                  setZainpayAccount(null);
                  setIsPollingPayment(false);
                }}
                className="w-full py-2 text-sm text-accent/60 hover:text-accent underline transition-colors"
              >
                Cancel — start over
              </button>
            </div>
          )}

          <form className={`space-y-4${isWaitingForTransfer ? " hidden" : ""}`} onSubmit={handleSubmit}>
            {/* You Pay */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">You Pay</label>
              <div className={`flex items-center justify-between p-3 rounded-xl transition-all ${errors.ngnAmount ? "border-2 border-red-500/50 bg-primary/40" : "bg-primary/40 border border-accent/10 focus-within:border-secondary/30"}`}>
                <div className="flex flex-col">
                  <input
                    id="ngn_amount"
                    name="ngn_amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={ngnAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\.\d*)\./g, "$1");
                      handleInputChange("ngnAmount", v);
                    }}
                    className="bg-transparent border-none p-0 text-xl font-bold focus:ring-0 w-full outline-none text-white placeholder-white/20"
                  />
                  <span className="text-xs text-accent/60">Min: ₦{minimumPurchase.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 bg-primary px-3 py-2 rounded-xl border border-accent/5">
                  <span className="font-bold text-white text-sm">🇳🇬 NGN</span>
                </div>
              </div>
              {errors.ngnAmount && (
                <p className="text-sm text-red-400 px-1">{errors.ngnAmount}</p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center -my-1">
              <div className="bg-primary border border-accent/10 rounded-full p-1.5 z-10">
                <span className="material-icons-outlined text-secondary text-lg">arrow_downward</span>
              </div>
            </div>

            {/* You Receive */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">You Receive</label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/40 border border-accent/10">
                <div className="flex flex-col">
                  <div className="text-xl font-bold text-white">{sendAmount}</div>
                  {network === "send" ? (
                    buyRateNGN != null && buyRateNGN > 0 ? (
                      <span className="text-xs text-accent/60">
                        Rate: 1 SEND = <span className="text-secondary font-semibold">{buyRateNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN</span>
                      </span>
                    ) : (
                      <span className="text-xs text-accent/60">Loading buy rate…</span>
                    )
                  ) : effectiveExchangeRate > 0 ? (
                    (() => {
                      const priceNGN = selectedStablecoin === "USDC" ? stablecoinPricesNGN.USDC : stablecoinPricesNGN.USDT;
                      return priceNGN ? (
                        <span className="text-xs text-accent/60">
                          Rate: 1 {selectedStablecoin} = <span className="text-secondary font-semibold">{priceNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN</span>
                        </span>
                      ) : null;
                    })()
                  ) : (
                    <span className="text-xs text-accent/60">Loading rate for {selectedStablecoin}…</span>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-primary px-3 py-2 rounded-xl border border-accent/5">
                  {network === "send" ? (
                    getTokenLogo("SEND") ? (
                      <img src={getTokenLogo("SEND")!} alt="SEND" className="w-5 h-5 rounded-full object-cover" />
                    ) : null
                  ) : getTokenLogo(selectedStablecoin) ? (
                    <img src={getTokenLogo(selectedStablecoin)!} alt={selectedStablecoin} className="w-5 h-5 rounded-full object-cover" />
                  ) : null}
                  <span className="font-bold text-white text-sm">{network === "send" ? "SEND" : selectedStablecoin}</span>
                </div>
              </div>
            </div>

            {/* USDC / USDT dropdown - only for Base and Solana */}
            {(network === "base" || network === "solana") && (
              <div ref={stablecoinDropdownRef} className="relative space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">Select stablecoin</label>
                <button
                  type="button"
                  onClick={() => setIsStablecoinDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-primary/40 border border-accent/10 cursor-pointer hover:border-secondary/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    {getTokenLogo(selectedStablecoin) ? (
                      <img src={getTokenLogo(selectedStablecoin)!} alt={selectedStablecoin} className="w-6 h-6 rounded-full object-cover" />
                    ) : null}
                    <span className="font-medium text-white">{selectedStablecoin}</span>
                  </div>
                  <span className="material-icons-outlined text-accent/60">{isStablecoinDropdownOpen ? "expand_less" : "expand_more"}</span>
                </button>
                {isStablecoinDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-2xl border border-secondary/20 bg-surface/95 backdrop-blur-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {(["USDC", "USDT"] as const).map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => {
                          setSelectedStablecoin(token);
                          setIsStablecoinDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-primary/50 text-left text-white"
                      >
                        {getTokenLogo(token) ? (
                          <img src={getTokenLogo(token)!} alt={token} className="w-6 h-6 rounded-full object-cover" />
                        ) : null}
                        <span className="font-medium">{token}</span>
                        {selectedStablecoin === token && (
                          <span className="material-icons-outlined text-secondary text-sm ml-auto">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wallet Address */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">
                {network === "solana" ? "Solana Wallet Address" : "Send App or Base Wallet Address"}
              </label>
              <div className={`p-3 rounded-xl transition-all ${errors.walletAddress ? "border-2 border-red-500/50 bg-primary/40" : "bg-primary/40 border border-accent/10 focus-within:border-secondary/30"}`}>
                <input
                  id="wallet_address"
                  name="wallet_address"
                  type="text"
                  placeholder={network === "solana" ? "Solana address..." : "0x..."}
                  value={walletAddress}
                  onChange={(e) => handleInputChange("walletAddress", e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                  required
                />
              </div>
              {errors.walletAddress && (
                <p className="text-sm text-red-400 px-1">{errors.walletAddress}</p>
              )}
            </div>

            {/* Submit */}
            <div>
              {!transactionsEnabled && (
                <div className="mb-3 p-3 rounded-xl bg-red-500/20 border border-red-500/30">
                  <p className="text-sm font-semibold text-red-400 mb-1">Transactions Currently Disabled</p>
                  <p className="text-xs text-red-400/80">Transactions are temporarily disabled. Please check back later.</p>
                </div>
              )}
              <button
                type="submit"
                disabled={
                  !transactionsEnabled ||
                  isLoading ||
                  !ngnAmount ||
                  !walletAddress ||
                  ((network === "base" || network === "solana") && effectiveExchangeRate <= 0)
                }
                className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(19,236,90,0.2)] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isLoading ? "Processing..." : (network === "base" || network === "solana") && effectiveExchangeRate <= 0 ? "Loading rate..." : transactionsEnabled ? "Pay now" : "Transactions Disabled"}
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
          </form>
        </div>
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setModalData(null);
          }}
          title={modalData.title}
          message={modalData.message}
          type={modalData.type}
          txHash={modalData.txHash}
          explorerUrl={modalData.explorerUrl}
        />
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      
      <div className="w-full mt-5">
        <PoweredBySEND />
      </div>
      
      {/* Create Send App Account Link */}
      <div className="mt-3 text-center px-4 w-full">
        <a
          href="https://send.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-3 px-4 text-xs sm:text-sm text-accent/60 hover:text-secondary transition-colors underline rounded"
        >
          Click to Create a Send App account
        </a>
      </div>
    </div>
  );
}


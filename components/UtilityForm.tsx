"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";
import { authenticateWithPasskey } from "@/lib/passkey";
import { SEND_TOKEN_ADDRESS, BASE_RPC_URL } from "@/lib/constants";
import { createJsonRpcProviderWith429Retry } from "@/lib/ethers-json-rpc-provider";
import { parseEther, parseUnits } from "ethers";
import { getBettingNetworkLogo, getTelecomNetworkLogo, getTVNetworkLogo, getGiftCardNetworkLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import PoweredBySEND from "@/components/PoweredBySEND";
import TransactionSuccess, { type TransactionSuccessProps, type TransactionDetailRow } from "@/components/TransactionSuccess";

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOLANA_PUBLIC_RPC_URL = "https://api.mainnet-beta.solana.com";

function isDirectSolanaPayToken(tokenKey: string): boolean {
  const k = (tokenKey || "").toLowerCase();
  return k === "native" || k === SOLANA_USDC_MINT.toLowerCase() || k === SOLANA_USDT_MINT.toLowerCase();
}

function isForbiddenSolanaRpcError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  return lower.includes("403") || lower.includes("api key is not allowed to access blockchain");
}

async function waitForSolanaSignatureConfirmation(
  connection: {
    getSignatureStatuses: (
      signatures: string[],
      config: { searchTransactionHistory: boolean }
    ) => Promise<{ value: Array<{ err: unknown; confirmationStatus?: string | null } | null> }>;
  },
  signature: string,
  timeoutMs = 90000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statusResp = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statusResp.value[0];
    if (status?.err) {
      throw new Error(`Solana transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status &&
      (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    `Transaction was not confirmed in 90 seconds. Check the signature in Solana Explorer: ${signature}`
  );
}

function utilityQuoteAmountHuman(
  amountsHuman: Record<string, string>,
  tokenKey: string
): string | null {
  if (amountsHuman[tokenKey] != null && amountsHuman[tokenKey] !== "") {
    return amountsHuman[tokenKey];
  }
  if (tokenKey === "native") {
    return amountsHuman["native"] ?? null;
  }
  const lower = tokenKey.toLowerCase();
  for (const k of Object.keys(amountsHuman)) {
    if (k !== "native" && k.toLowerCase() === lower) return amountsHuman[k];
  }
  for (const k of Object.keys(amountsHuman)) {
    if (k === tokenKey) return amountsHuman[k];
  }
  return null;
}

function readChainTokenBalance(
  chainBal: Record<string, { balance: string }> | undefined,
  tokenKey: string
): number {
  const raw = readChainTokenBalanceRaw(chainBal, tokenKey);
  if (raw == null) return 0;
  return parseFloat(raw) || 0;
}

/** Exact balance string from `/api/wallet/balances` (avoid parseFloat-only checks for ERC-20). */
function readChainTokenBalanceRaw(
  chainBal: Record<string, { balance: string }> | undefined,
  tokenKey: string
): string | null {
  if (!chainBal) return null;
  if (tokenKey === "native") {
    const b = chainBal["native"]?.balance;
    return b != null && b !== "" ? b : null;
  }
  const lower = tokenKey.toLowerCase();
  for (const [addr, t] of Object.entries(chainBal)) {
    if (addr === "native") continue;
    if (addr.toLowerCase() === lower) {
      const b = t.balance;
      return b != null && b !== "" ? b : null;
    }
  }
  for (const [addr, t] of Object.entries(chainBal)) {
    if (addr === tokenKey) {
      const b = t.balance;
      return b != null && b !== "" ? b : null;
    }
  }
  return null;
}

function formatPayBalanceAmount(n: number, maxFrac = 8): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(maxFrac).replace(/\.?0+$/, "");
  return s || "0";
}

/** Rounded amounts for pay UI (need vs have use different precision). */
function formatPayTokenUi(n: number, maxFrac: number): string {
  if (!Number.isFinite(n)) return "0";
  const s = n.toFixed(maxFrac).replace(/\.?0+$/, "");
  return s || "0";
}

function PaymentMethodBadge({ type }: { type: "send" | "solana" | "base" }) {
  const logoSrc =
    type === "send"
      ? "https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979129/71a616bbd4464dfc8c7a5dcb4b3ee043_fe2oeg.png"
      : type === "solana"
        ? "https://res.cloudinary.com/dshqnkjqb/image/upload/v1775000708/Solana-Logo_dqbrfk.png"
        : "https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979509/108554348_rdxd9x.png";
  const imageClass =
    type === "send"
      ? "h-[18px] w-[18px] scale-[3] rounded-full object-cover"
      : type === "solana"
        ? "h-[16px] w-[16px] scale-[6] object-contain"
        : "h-[14px] w-[14px] scale-[3.5] object-contain";

  if (type === "send") {
    return (
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary/15">
        <Image src={logoSrc} alt="Send" width={38} height={38} className={imageClass} unoptimized />
      </span>
    );
  }
  if (type === "solana") {
    return (
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/5">
        <Image src={logoSrc} alt="Solana" width={20} height={20} className={imageClass} unoptimized />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#0052FF]/15">
      <Image src={logoSrc} alt="Base" width={20} height={20} className={imageClass} unoptimized />
    </span>
  );
}

interface GiftCardProduct {
  id: number;
  name: string;
  brandName: string;
  logoUrl?: string;
}

interface UtilityFormProps {
  serviceId: string;
  serviceName: string;
  icon: string;
  networks?: string[];
  placeholder?: string;
  showPackageDropdown?: boolean; // For TV subscriptions
  productMap?: Record<string, GiftCardProduct>; // For gift card products from Reloadly
  allowMultipleNumbers?: boolean; // For airtime/data: comma/space separated, auto-detect network per number
}

export default function UtilityForm({
  serviceId,
  serviceName,
  icon,
  networks = [],
  placeholder = "Enter phone number",
  showPackageDropdown = false,
  productMap = {},
  allowMultipleNumbers = false,
}: UtilityFormProps) {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0] || "");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [packages, setPackages] = useState<any[]>([]);
  const [durations, setDurations] = useState<Array<{ days: number; label: string }>>([]);
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utilitySuccess, setUtilitySuccess] = useState<TransactionSuccessProps | null>(null);
  const [serviceSettings, setServiceSettings] = useState<any>(null);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const networkDropdownRef = useRef<HTMLDivElement>(null);
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponValid, setCouponValid] = useState<{ code: string; amount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const couponTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [quoteRail, setQuoteRail] = useState<"base" | "solana" | "send" | null>(null);
  const [quoteData, setQuoteData] = useState<{
    quoteId: string;
    expiresAt: string;
    ngnTotal: number;
    ngnSubtotal?: number;
    treasury: { base: string | null; solana: string | null };
    crypto: {
      amountsHuman: Record<string, string>;
      solanaNote?: string;
      solanaInputTokenKey?: string;
      solanaInputMint?: string;
      solanaUsdcNotionalHuman?: string;
      gasSponsored?: boolean;
      solanaGaslessEnabled?: boolean;
      solanaGaslessFeeNgn?: number;
      solanaUtilityBaseNgn?: number;
    };
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [basePayToken, setBasePayToken] = useState<string>("");
  const [solanaPayToken, setSolanaPayToken] = useState<string>(SOLANA_USDC_MINT);
  const [solanaGaslessEnabled, setSolanaGaslessEnabled] = useState(false);
  const [payBalanceOk, setPayBalanceOk] = useState<boolean | null>(null);
  const [payBalanceMessage, setPayBalanceMessage] = useState<string | null>(null);
  const [payBalanceGap, setPayBalanceGap] = useState<{
    need: number;
    available: number;
    symbol: string;
  } | null>(null);
  const [payBalanceLoading, setPayBalanceLoading] = useState(false);
  const [payBalanceAvailable, setPayBalanceAvailable] = useState<number | null>(null);
  const [payGasWarning, setPayGasWarning] = useState<string | null>(null);
  const [payBalanceRefreshNonce, setPayBalanceRefreshNonce] = useState(0);
  const [payWalletBalances, setPayWalletBalances] = useState<
    Record<string, Record<string, { balance: string; symbol: string; usdValue?: number }>>
  >({});

  const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const BASE_USDT = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";
  const BASE_WETH = "0x4200000000000000000000000000000000000006";
  const SOL_USDC = SOLANA_USDC_MINT;

  const payQuoteDisplay = useMemo(() => {
    const empty = {
      humanDisplayShort: null as string | null,
      symbol: "token" as string,
      balanceLineSymbol: "token" as string,
      settlementHumanShort: null as string | null,
      settlementSymbol: null as string | null,
    };
    if (!quoteData || !quoteRail) return empty;

    const tokenKeyForQuote =
      quoteRail === "send"
        ? SEND_TOKEN_ADDRESS.toLowerCase()
        : quoteRail === "solana"
          ? quoteData.crypto.solanaInputTokenKey || solanaPayToken || SOL_USDC
          : basePayToken === "native"
            ? "native"
            : basePayToken
              ? basePayToken.toLowerCase()
              : null;

    if (!tokenKeyForQuote) return empty;

    const paymentSymbol =
      quoteRail === "send"
        ? "SEND"
        : quoteRail === "solana"
          ? payWalletBalances.solana?.[tokenKeyForQuote]?.symbol ||
            (tokenKeyForQuote === "native" ? "SOL" : "token")
          : basePayToken === "native"
            ? "ETH"
            : basePayToken.toLowerCase() === BASE_USDC.toLowerCase()
              ? "USDC"
              : basePayToken.toLowerCase() === BASE_USDT.toLowerCase()
                ? "USDT"
                : basePayToken.toLowerCase() === BASE_WETH.toLowerCase()
                  ? "WETH"
                  : basePayToken.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase()
                    ? "SEND"
                    : "token";

    if (
      quoteRail === "solana" &&
      quoteData.crypto.solanaUsdcNotionalHuman != null &&
      quoteData.crypto.solanaUsdcNotionalHuman !== ""
    ) {
      const u = quoteData.crypto.solanaUsdcNotionalHuman;
      const headlineHuman =
        Number.isFinite(parseFloat(u)) ? formatPayTokenUi(parseFloat(u), 2) : null;
      const settlementRaw = utilityQuoteAmountHuman(quoteData.crypto.amountsHuman, tokenKeyForQuote);
      const settlementHumanShort =
        settlementRaw != null && settlementRaw !== "" && Number.isFinite(parseFloat(settlementRaw))
          ? formatPayTokenUi(parseFloat(settlementRaw), 2)
          : null;
      const keyLower = tokenKeyForQuote === "native" ? "native" : tokenKeyForQuote.toLowerCase();
      const showSettlement =
        settlementHumanShort != null &&
        (keyLower === "native" || keyLower === SOLANA_USDT_MINT.toLowerCase());
      return {
        humanDisplayShort: headlineHuman,
        symbol: "USDC",
        balanceLineSymbol: paymentSymbol,
        settlementHumanShort: showSettlement ? settlementHumanShort : null,
        settlementSymbol: showSettlement ? paymentSymbol : null,
      };
    }

    const humanRaw = utilityQuoteAmountHuman(quoteData.crypto.amountsHuman, tokenKeyForQuote);
    const humanDisplayShort =
      humanRaw != null && humanRaw !== "" && Number.isFinite(parseFloat(humanRaw))
        ? formatPayTokenUi(parseFloat(humanRaw), 2)
        : null;

    return {
      humanDisplayShort,
      symbol: paymentSymbol,
      balanceLineSymbol: paymentSymbol,
      settlementHumanShort: null,
      settlementSymbol: null,
    };
  }, [quoteData, quoteRail, basePayToken, solanaPayToken, payWalletBalances]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    const handleClickOutside = (event: MouseEvent) => {
      try {
        if (networkDropdownRef.current && !networkDropdownRef.current.contains(event.target as Node)) {
          setIsNetworkDropdownOpen(false);
        }
      } catch (e) {
        console.warn("Error in click outside handler:", e);
      }
    };

    try {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        try {
          if (typeof document !== "undefined") {
            document.removeEventListener("mousedown", handleClickOutside);
          }
        } catch (e) {
          console.warn("Error removing click outside listener:", e);
        }
      };
    } catch (e) {
      console.warn("Error adding click outside listener:", e);
      return () => {}; // Return empty cleanup function
    }
  }, []);

  useEffect(() => {
    fetchServiceSettings();
  }, [serviceId]);

  // Live coupon validation — debounced 600ms after user stops typing
  useEffect(() => {
    if (couponTimerRef.current) clearTimeout(couponTimerRef.current);
    const trimmed = couponCode.trim();
    if (!trimmed) {
      setCouponValid(null);
      setCouponError(null);
      return;
    }
    couponTimerRef.current = setTimeout(async () => {
      setCouponLoading(true);
      setCouponValid(null);
      setCouponError(null);
      try {
        const res = await fetch(getApiUrl(`/api/coupons/validate?code=${encodeURIComponent(trimmed)}`));
        const data = await res.json();
        if (data.valid) {
          setCouponValid({ code: data.code, amount: data.amount });
        } else {
          setCouponError(data.error || "Invalid coupon");
        }
      } catch {
        setCouponError("Could not validate coupon");
      } finally {
        setCouponLoading(false);
      }
    }, 600);
    return () => { if (couponTimerRef.current) clearTimeout(couponTimerRef.current); };
  }, [couponCode]);

  // For data multi-number: default to MTN for package list (backend maps mtn-1gb -> glo-1gb etc.)
  useEffect(() => {
    if (allowMultipleNumbers && serviceId === "data" && networks.includes("MTN")) {
      setSelectedNetwork("MTN");
    }
  }, [allowMultipleNumbers, serviceId]);

  // Fetch packages when network is selected (for TV, Data, or Betting)
  useEffect(() => {
    const effectiveNetwork = allowMultipleNumbers && serviceId === "data" ? (selectedNetwork || "MTN") : selectedNetwork;
    if (showPackageDropdown && effectiveNetwork && (serviceId === "tv" || serviceId === "data" || serviceId === "betting")) {
      if (serviceId === "tv") {
        fetchTVPackages(effectiveNetwork);
      } else if (serviceId === "data") {
        fetchDataPackages(effectiveNetwork);
      } else if (serviceId === "betting") {
        fetchBettingPackages(effectiveNetwork);
      }
    }
  }, [selectedNetwork, showPackageDropdown, serviceId, allowMultipleNumbers]);

  // Update amount when package is selected
  useEffect(() => {
    if (selectedPackage && packages.length > 0) {
      const pkg = packages.find(p => p.id === selectedPackage || p.name === selectedPackage);
      if (pkg && pkg.amount) {
        setAmount(pkg.amount.toString());
      }
    }
  }, [selectedPackage, packages]);

  // When duration tab changes, clear selection if current package is not in filtered list (data only)
  useEffect(() => {
    if (serviceId !== "data" || !selectedPackage || selectedDurationDays == null) return;
    const filtered = packages.filter((p: any) => p.durationDays === selectedDurationDays);
    const stillInList = filtered.some((p: any) => p.id === selectedPackage || p.name === selectedPackage);
    if (!stillInList) {
      setSelectedPackage("");
      setAmount("");
    }
  }, [selectedDurationDays, serviceId, packages, selectedPackage]);

  useEffect(() => {
    if (amount && serviceSettings) {
      const amountNum = parseFloat(amount);
      if (!isNaN(amountNum) && amountNum > 0) {
        const markup = serviceSettings.markup || 0;
        let count = 1;
        if (allowMultipleNumbers && phoneNumber.trim()) {
          const parts = phoneNumber.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
          const valid = parts.filter((p) => {
            const d = p.replace(/\D/g, "");
            const n = d.startsWith("234") ? "0" + d.slice(3) : (d.length === 10 ? "0" + d : d);
            return /^0[789][01]\d{8}$/.test(n);
          });
          count = Math.max(1, valid.length);
        }
        const total = (amountNum + (amountNum * markup / 100)) * count;
        setCalculatedTotal(total);
      } else {
        setCalculatedTotal(0);
      }
    } else {
      setCalculatedTotal(0);
    }
  }, [amount, serviceSettings, allowMultipleNumbers, phoneNumber]);

  const fetchServiceSettings = async () => {
    setLoadingSettings(true);
    setError(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/service/${serviceId}`));
      const data = await response.json();
      
      if (data.success && data.service) {
        setServiceSettings(data.service);
        if (data.service.status !== "active") {
          setError(`${serviceName} service is currently unavailable`);
        }
      } else {
        // Use default settings if API fails
        const defaultSettings: Record<string, any> = {
          airtime: {
            id: "airtime",
            name: "Airtime",
            status: "active",
            markup: 2.5,
            minAmount: 50,
            maxAmount: 10000,
          },
          data: {
            id: "data",
            name: "Data Bundle",
            status: "active",
            markup: 3.0,
            minAmount: 100,
            maxAmount: 50000,
          },
          tv: {
            id: "tv",
            name: "Cable TV Subscription",
            status: "active",
            markup: 2.0,
            minAmount: 1000,
            maxAmount: 50000,
          },
          betting: {
            id: "betting",
            name: "Betting Wallet Funding",
            status: "active",
            markup: 2.5,
            minAmount: 100,
            maxAmount: 100000,
          },
          "gift-card-redeem": {
            id: "gift-card-redeem",
            name: "Gift Card Redeem",
            status: "active",
            markup: 5.0,
            minAmount: 500,
            maxAmount: 50000,
          },
        };
        
        const defaultService = defaultSettings[serviceId] || {
          id: serviceId,
          status: "active",
          markup: 0,
          minAmount: 0,
          maxAmount: 0,
        };
        
        setServiceSettings(defaultService);
      }
    } catch (error) {
      console.error("Error fetching service settings:", error);
      // Use default settings on error
      const defaultSettings: Record<string, any> = {
        airtime: {
          id: "airtime",
          name: "Airtime",
          status: "active",
          markup: 2.5,
          minAmount: 50,
          maxAmount: 10000,
        },
        data: {
          id: "data",
          name: "Data Bundle",
          status: "active",
          markup: 3.0,
          minAmount: 100,
          maxAmount: 50000,
        },
        tv: {
          id: "tv",
          name: "Cable TV Subscription",
          status: "active",
          markup: 2.0,
          minAmount: 1000,
          maxAmount: 50000,
        },
        betting: {
          id: "betting",
          name: "Betting Wallet Funding",
          status: "active",
          markup: 2.5,
          minAmount: 100,
          maxAmount: 100000,
        },
      };
      
      const defaultService = defaultSettings[serviceId] || {
        id: serviceId,
        status: "active",
        markup: 0,
        minAmount: 0,
        maxAmount: 0,
      };
      
      setServiceSettings(defaultService);
    } finally {
      setLoadingSettings(false);
    }
  };

  const validateForm = () => {
    if (!phoneNumber.trim()) {
      if (serviceId === "gift-card-redeem") {
        setError("Please enter a gift card code");
      } else if (serviceId === "electricity") {
        setError("Please enter a meter number");
      } else {
        setError("Please enter a phone number");
      }
      return false;
    }

    // Gift card code validation (different from phone number)
    if (serviceId === "gift-card-redeem") {
      // Basic gift card code validation (alphanumeric, 10-50 characters)
      const codeRegex = /^[A-Za-z0-9]{10,50}$/;
      const cleanedCode = phoneNumber.trim().replace(/\s/g, "");
      if (!codeRegex.test(cleanedCode)) {
        setError("Please enter a valid gift card code (10-50 alphanumeric characters)");
        return false;
      }
      // For gift card redemption, amount is not required (will be determined from code)
      return true;
    } else if (serviceId === "electricity") {
      // Meter number validation (alphanumeric, typically 10-15 characters)
      const meterRegex = /^[A-Za-z0-9]{10,15}$/;
      const cleanedMeter = phoneNumber.trim().replace(/\s/g, "");
      if (!meterRegex.test(cleanedMeter)) {
        setError("Please enter a valid meter number (10-15 alphanumeric characters)");
        return false;
      }
    } else if (allowMultipleNumbers) {
      const parts = phoneNumber.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        setError("Please enter at least one phone number");
        return false;
      }
      const phoneRegex = /^(0|\+234)?[789][01]\d{8}$/;
      for (const p of parts) {
        const cleaned = p.replace(/\D/g, "");
        const normalized = cleaned.startsWith("234") ? "0" + cleaned.slice(3) : (cleaned.length === 10 ? "0" + cleaned : cleaned);
        if (!/^0[789][01]\d{8}$/.test(normalized)) {
          setError(`Invalid number: ${p}. Use Nigerian format (e.g. 08012345678)`);
          return false;
        }
      }
    } else {
      const phoneRegex = /^(0|\+234)[789][01]\d{8}$/;
      const cleanedPhone = phoneNumber.replace(/\s/g, "");
      if (!phoneRegex.test(cleanedPhone)) {
        setError("Please enter a valid Nigerian phone number");
        return false;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (serviceSettings) {
      const amountNum = parseFloat(amount);
      if (serviceSettings.minAmount && amountNum < serviceSettings.minAmount) {
        setError(`Minimum amount is ₦${serviceSettings.minAmount.toLocaleString()}`);
        return false;
      }
      if (serviceSettings.maxAmount && amountNum > serviceSettings.maxAmount) {
        setError(`Maximum amount is ₦${serviceSettings.maxAmount.toLocaleString()}`);
        return false;
      }
    }

    if (networks.length > 0 && !allowMultipleNumbers && !selectedNetwork) {
      setError("Please select a network");
      return false;
    }

    if (showPackageDropdown && !selectedPackage && !amount) {
      setError("Please select a package or enter an amount");
      return false;
    }

    return true;
  };

  const buildPurchasePayload = (userId: string) => ({
    serviceId,
    phoneNumber: allowMultipleNumbers ? undefined : phoneNumber.replace(/\s/g, ""),
    phoneNumbers: allowMultipleNumbers ? phoneNumber.trim() : undefined,
    network: allowMultipleNumbers ? undefined : (selectedNetwork || null),
    packageId: selectedPackage || null,
    amount: serviceId === "gift-card-redeem" ? 0 : parseFloat(amount),
    userId,
    couponCode: couponCode.trim() || undefined,
  });

  const executePurchaseRequest = async (
    userId: string,
    extraBody: Record<string, unknown> = {}
  ) => {
    setLoading(true);
    setError(null);
    setUtilitySuccess(null);
    try {
      const response = await fetch(getApiUrl("/api/utility/purchase"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPurchasePayload(userId), ...extraBody }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        setError(errorMessage);
        return;
      }

      const data = JSON.parse(responseText);

      if (data.success) {
        const snapPhone = phoneNumber.trim();
        const snapNetwork = selectedNetwork;
        const snapPackageId = selectedPackage;
        const snapCoupon = couponCode.trim();
        const tx = data.transaction as
          | {
              reference?: string;
              total?: number;
              amount?: number;
              failedCount?: number;
            }
          | undefined;

        const paidTotal =
          tx && typeof tx.total === "number" && !Number.isNaN(tx.total)
            ? tx.total
            : calculatedTotal;

        const recipientLabel =
          serviceId === "electricity"
            ? "Meter"
            : serviceId === "tv"
              ? "Smart card"
              : serviceId === "betting"
                ? "User ID"
                : serviceId === "gift-card-redeem"
                  ? "Gift card code"
                  : allowMultipleNumbers
                    ? "Numbers"
                    : "Phone";

        const rows: TransactionDetailRow[] = [{ label: "Service", value: serviceName }];

        if (snapNetwork) {
          const networkHeading =
            serviceId === "electricity"
              ? "Disco"
              : serviceId === "tv"
                ? "TV"
                : serviceId === "betting"
                  ? "Platform"
                  : "Network";
          rows.push({ label: networkHeading, value: snapNetwork });
        }

        if (snapPhone) {
          rows.push({
            label: recipientLabel,
            value: snapPhone,
            mono: serviceId === "gift-card-redeem" || serviceId === "electricity",
          });
        }

        if (snapPackageId) {
          const pkg = packages.find(
            (p: { id?: string; name?: string }) => (p.id || p.name) === snapPackageId
          );
          const pkgLabel = pkg
            ? String(
                pkg.name ||
                  `${(pkg as { data?: string }).data ?? ""} ${(pkg as { validity?: string }).validity ?? ""}`.trim() ||
                  snapPackageId
              )
            : snapPackageId;
          rows.push({ label: "Package", value: pkgLabel });
        }

        if (snapCoupon) {
          rows.push({ label: "Coupon applied", value: snapCoupon.toUpperCase(), mono: true });
        }

        if (tx?.reference) {
          rows.push({ label: "Reference", value: String(tx.reference), mono: true });
        }

        const partialFail = (tx?.failedCount ?? 0) > 0;

        setUtilitySuccess({
          sendType: "ngn",
          amount: String(paidTotal),
          subtitle: partialFail
            ? (typeof data.message === "string" ? data.message : "Some items could not be completed.")
            : "Your purchase has been processed",
          customRows: rows,
          againButtonLabel: "Buy Again",
          onSendAgain: () => setUtilitySuccess(null),
        });

        setPhoneNumber("");
        setAmount("");
        setCouponCode("");
        setCouponValid(null);
        setCouponError(null);
        setSelectedPackage("");
        if (durations.length > 0) {
          setSelectedDurationDays(durations[0].days);
        }
      } else {
        setError(data.error || "Purchase failed. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Error processing purchase:", error);
      const err = error as { message?: string; name?: string };
      if (err.message) {
        setError(err.message);
      } else if (err.name === "TypeError" && err.message?.includes("fetch")) {
        setError("Network error. Server may be down. Please check your connection and try again.");
      } else if (err.name === "SyntaxError") {
        setError("Invalid response from server. Please try again.");
      } else {
        setError(`An error occurred: ${err.message || "Unknown error"}`);
      }
    } finally {
      setLoading(false);
      setPayModalOpen(false);
      setQuoteData(null);
      setQuoteRail(null);
      setPayBalanceOk(null);
      setPayBalanceMessage(null);
      setPayBalanceGap(null);
      setPayBalanceLoading(false);
      setPayBalanceAvailable(null);
      setPayGasWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUtilitySuccess(null);
    if (!validateForm()) return;
    const user = getUserFromStorage();
    if (!user) {
      router.push("/auth");
      return;
    }
    if (serviceId === "gift-card-redeem") {
      await executePurchaseRequest(user.id);
      return;
    }
    setPayModalOpen(true);
  };

  const fetchUtilityQuote = async (
    rail: "base" | "solana" | "send",
    solanaTokenOverride?: string,
    solanaGaslessOverride?: boolean
  ) => {
    const user = getUserFromStorage();
    if (!user) return;
    const solanaToken =
      rail === "solana" ? solanaTokenOverride || solanaPayToken || SOL_USDC : undefined;
    const solanaGasless =
      rail === "solana" ? (typeof solanaGaslessOverride === "boolean" ? solanaGaslessOverride : solanaGaslessEnabled) : undefined;
    setQuoteLoading(true);
    setError(null);
    setQuoteRail(rail);
    setPayBalanceOk(null);
    setPayBalanceMessage(null);
    setPayBalanceGap(null);
    setPayBalanceLoading(false);
    setPayBalanceAvailable(null);
    setPayGasWarning(null);
    try {
      const res = await fetch(getApiUrl("/api/utility/quote"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPurchasePayload(user.id),
          paymentRail: rail,
          ...(rail === "solana" ? { payToken: solanaToken } : {}),
          ...(rail === "solana" ? { sponsorGas: solanaGasless } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Could not get quote");
        setQuoteData(null);
        return;
      }
      setQuoteData({
        quoteId: data.quoteId,
        expiresAt: data.expiresAt,
        ngnTotal: data.ngnTotal,
        ngnSubtotal: data.ngnSubtotal,
        treasury: data.treasury,
        crypto: data.crypto,
      });
      if (rail === "send") {
        setBasePayToken(SEND_TOKEN_ADDRESS.toLowerCase());
      } else if (rail === "base" && !basePayToken) {
        setBasePayToken(BASE_USDC);
      } else if (rail === "solana") {
        setSolanaPayToken(data.crypto?.solanaInputTokenKey || solanaToken || SOL_USDC);
        setSolanaGaslessEnabled(Boolean(data.crypto?.solanaGaslessEnabled));
      }
    } catch {
      setError("Failed to load quote");
      setQuoteData(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  useEffect(() => {
    if (!payModalOpen || !quoteData || !quoteRail || quoteLoading) return;
    if (quoteRail === "base" && !basePayToken) return;

    const user = getUserFromStorage();
    if (!user?.id) return;

    const tokenKeyForQuote =
      quoteRail === "send"
        ? SEND_TOKEN_ADDRESS.toLowerCase()
        : quoteRail === "solana"
          ? quoteData.crypto.solanaInputTokenKey || solanaPayToken || SOL_USDC
          : basePayToken === "native"
            ? "native"
            : basePayToken.toLowerCase();

    const symbol =
      quoteRail === "send"
        ? "SEND"
        : quoteRail === "solana"
          ? payWalletBalances.solana?.[tokenKeyForQuote]?.symbol || (tokenKeyForQuote === "native" ? "SOL" : "token")
          : basePayToken === "native"
            ? "ETH"
            : basePayToken.toLowerCase() === BASE_USDC.toLowerCase()
              ? "USDC"
              : basePayToken.toLowerCase() === BASE_USDT.toLowerCase()
                ? "USDT"
                : basePayToken.toLowerCase() === BASE_WETH.toLowerCase()
                  ? "WETH"
                  : basePayToken.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase()
                    ? "SEND"
                    : "token";

    let cancelled = false;
    setPayBalanceLoading(true);
    setPayBalanceOk(null);
    setPayBalanceMessage(null);
    setPayBalanceGap(null);
    setPayBalanceAvailable(null);
    setPayGasWarning(null);

    void (async () => {
      try {
        const humanRequired = utilityQuoteAmountHuman(
          quoteData.crypto.amountsHuman,
          tokenKeyForQuote
        );
        if (!humanRequired) {
          if (!cancelled) {
            setPayBalanceOk(false);
            setPayBalanceGap(null);
            setPayBalanceMessage("Could not read the required amount from this quote.");
          }
          return;
        }
        const required = parseFloat(humanRequired);
        if (!Number.isFinite(required) || required < 0) {
          if (!cancelled) {
            setPayBalanceOk(false);
            setPayBalanceGap(null);
            setPayBalanceMessage("Invalid amount in quote.");
          }
          return;
        }

        const chain = quoteRail === "solana" ? "solana" : "base";
        type BalSnap = { num: number; raw: string | null };
        const pickRicherSnap = (a: BalSnap, b: BalSnap): BalSnap => {
          if (b.num > a.num + 1e-15) return { num: b.num, raw: b.raw ?? a.raw };
          if (a.num > b.num + 1e-15) return { num: a.num, raw: a.raw ?? b.raw };
          return { num: a.num, raw: b.raw ?? a.raw };
        };
        const getAvailableFromApi = async (fresh: boolean): Promise<BalSnap | null> => {
          const res = await fetch(
            getApiUrl(
              `/api/wallet/balances?userId=${encodeURIComponent(user.id)}${fresh ? "&fresh=true" : ""}`
            )
          );
          const data = await res.json();
          if (!data.success || data.balances == null) return null;
          setPayWalletBalances(data.balances || {});
          const chainBal = data.balances[chain] as
            | Record<string, { balance: string }>
            | undefined;
          const raw = readChainTokenBalanceRaw(chainBal, tokenKeyForQuote);
          const num = readChainTokenBalance(chainBal, tokenKeyForQuote);
          return { num, raw };
        };

        // Use cache-first to avoid false "0 balance" from transient full-sync issues.
        // If cache is insufficient, run fresh sync and use the higher of both values.
        const firstSnap = await getAvailableFromApi(false);
        if (cancelled) return;

        let snap = firstSnap;
        const snapNum = (s: BalSnap | null) => s?.num ?? 0;
        if (required > 0 && snapNum(snap) + 1e-12 < required) {
          const freshSnap = await getAvailableFromApi(true);
          if (cancelled) return;
          if (freshSnap) {
            snap = snap ? pickRicherSnap(snap, freshSnap) : freshSnap;
          }
        }

        if (firstSnap == null && snap == null) {
          setPayBalanceOk(null);
          setPayBalanceGap(null);
          setPayBalanceMessage(
            "Could not load wallet balances. Try Refresh or pay with Naira."
          );
          return;
        }

        const available = snapNum(snap);
        if (!cancelled) setPayBalanceAvailable(available);

        let coversQuote = false;
        if (quoteRail === "solana") {
          coversQuote = !(required > 0 && available + 1e-12 < required);
        } else {
          try {
            if (tokenKeyForQuote === "native") {
              const needW = parseEther(humanRequired.trim() || "0");
              const rawStr = (snap?.raw ?? "").trim() || "0";
              const haveW = parseEther(rawStr);
              coversQuote = haveW >= needW;
            } else {
              const dec = baseTokenDecimals(tokenKeyForQuote);
              const needW = parseUnits(humanRequired.trim() || "0", dec);
              const rawStr = snap?.raw?.trim();
              if (rawStr) {
                const haveW = parseUnits(rawStr || "0", dec);
                coversQuote = haveW >= needW;
              } else {
                coversQuote = !(required > 0 && available + 1e-12 < required);
              }
            }
          } catch {
            coversQuote = !(required > 0 && available + 1e-12 < required);
          }
        }

        if (required > 0 && !coversQuote) {
          setPayBalanceOk(false);
          setPayBalanceMessage(null);
          setPayBalanceGap({ need: required, available, symbol });
          setPayGasWarning(null);
          return;
        }

        setPayBalanceOk(true);
        setPayBalanceMessage(null);
        setPayBalanceGap(null);

        if (
          quoteRail !== "solana" &&
          tokenKeyForQuote === "native" &&
          available - required < 0.00005
        ) {
          setPayGasWarning(
            "Keep a little extra ETH on Base for network fees in addition to this payment."
          );
        } else {
          setPayGasWarning(null);
        }
      } catch {
        if (!cancelled) {
          setPayBalanceOk(null);
          setPayBalanceGap(null);
          setPayBalanceMessage(
            "Balance check failed. Tap Refresh balances to try again."
          );
          setPayBalanceAvailable(null);
          setPayGasWarning(null);
        }
      } finally {
        if (!cancelled) setPayBalanceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payModalOpen, quoteData, quoteRail, basePayToken, solanaPayToken, quoteLoading, payBalanceRefreshNonce]);

  const signAndSendCrypto = async (): Promise<string | null> => {
    const user = getUserFromStorage();
    if (!user || !quoteData) return null;
    const auth = await authenticateWithPasskey(user.id);
    if (!auth.success) {
      setError("Passkey authentication failed");
      return null;
    }
    const seedRes = await fetch(getApiUrl("/api/passkey/seed-phrase"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, passkeyVerified: true }),
    });
    const seedData = await seedRes.json();
    if (!seedData.success || !seedData.encryptedSeed) {
      setError("Could not retrieve wallet");
      return null;
    }
    const { decryptSeedPhrase, generateWalletFromSeed, alignWalletDataEvmWithStoredAddress } =
      await import("@/lib/wallet");
    let seedPhrase: string;
    try {
      seedPhrase = await decryptSeedPhrase(seedData.encryptedSeed, seedData.publicKey);
    } catch {
      setError("Failed to decrypt wallet");
      return null;
    }
    let walletData = generateWalletFromSeed(seedPhrase);
    const sessionUser = getUserFromStorage();
    const storedEvmForAlign =
      sessionUser?.walletAddresses?.base ||
      sessionUser?.walletAddresses?.ethereum ||
      sessionUser?.walletAddresses?.polygon ||
      sessionUser?.walletAddresses?.monad;
    walletData = alignWalletDataEvmWithStoredAddress(walletData, seedPhrase, storedEvmForAlign);

    if (quoteRail === "solana") {
      const treasury = quoteData.treasury.solana;
      if (!treasury) {
        setError("Solana treasury not configured");
        return null;
      }
      const solPk = walletData.privateKeys.solana ?? walletData.privateKeys["solana"];
      const solAddr = walletData.addresses.solana ?? walletData.addresses["solana"];
      if (!solPk || !solAddr) {
        setError("No Solana key in wallet");
        return null;
      }
      const {
        Connection,
        PublicKey,
        Transaction,
        SystemProgram,
        Keypair: SolanaKeypair,
      } = await import("@solana/web3.js");
      const { getOrCreateAssociatedTokenAccount, createTransferInstruction, getMint } = await import("@solana/spl-token");
      const keypair = SolanaKeypair.fromSecretKey(Buffer.from(solPk, "hex"));
      if (keypair.publicKey.toBase58() !== solAddr) {
        setError("Wallet address mismatch");
        return null;
      }
      const tokenKey = quoteData.crypto.solanaInputTokenKey || solanaPayToken || SOL_USDC;
      const configuredSolanaRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || SOLANA_PUBLIC_RPC_URL;
      const makeConnection = (rpcUrl: string) => new Connection(rpcUrl, "confirmed");
      let connection = makeConnection(configuredSolanaRpcUrl);
      if (isDirectSolanaPayToken(tokenKey)) {
        const human = utilityQuoteAmountHuman(quoteData.crypto.amountsHuman, tokenKey);
        if (!human) {
          setError("Invalid quote for Solana token");
          return null;
        }
        const sendDirectSolanaPayment = async () => {
          if (tokenKey === "native") {
            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(treasury),
                lamports: BigInt(Math.round(parseFloat(human) * 1e9)),
              })
            );
            const sig = await connection.sendTransaction(tx, [keypair]);
            await waitForSolanaSignatureConfirmation(connection, sig);
            return sig;
          }
          const mintPk = new PublicKey(tokenKey);
          const recipient = new PublicKey(treasury);
          const mintInfo = await getMint(connection, mintPk);
          const fromAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mintPk, keypair.publicKey);
          const toAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mintPk, recipient);
          const parsedAmount = BigInt(Math.round(parseFloat(human) * 10 ** mintInfo.decimals));
          const tx = new Transaction().add(
            createTransferInstruction(fromAta.address, toAta.address, keypair.publicKey, parsedAmount)
          );
          const sig = await connection.sendTransaction(tx, [keypair]);
          await waitForSolanaSignatureConfirmation(connection, sig);
          return sig;
        };
        try {
          return await sendDirectSolanaPayment();
        } catch (e) {
          if (!isForbiddenSolanaRpcError(e) || configuredSolanaRpcUrl === SOLANA_PUBLIC_RPC_URL) {
            throw e;
          }
          connection = makeConnection(SOLANA_PUBLIC_RPC_URL);
          return await sendDirectSolanaPayment();
        }
      }

      setError("Jupiter swaps are disabled. Use SOL, USDC, or USDT for Solana utility payments.");
      return null;
    }

    const treasury = quoteData.treasury.base;
    if (!treasury) {
      setError("Base treasury not configured");
      return null;
    }
    const basePk = walletData.privateKeys.base ?? walletData.privateKeys["base"];
    const baseAddr = walletData.addresses.base ?? walletData.addresses["base"];
    if (!basePk || !baseAddr) {
      setError("No Base key in wallet");
      return null;
    }
    const tokenKey = basePayToken === "native" ? "native" : basePayToken.toLowerCase();
    const human = quoteData.crypto.amountsHuman[tokenKey];
    if (!human) {
      setError("Select a token listed on the quote");
      return null;
    }
    const { ethers } = await import("ethers");
    const provider = createJsonRpcProviderWith429Retry(BASE_RPC_URL, 8453, { staticNetwork: true });
    const signer = new ethers.Wallet(basePk.startsWith("0x") ? basePk : `0x${basePk}`, provider);
    if (signer.address.toLowerCase() !== baseAddr.toLowerCase()) {
      setError("Wallet address mismatch");
      return null;
    }
    let txHash: string;
    if (tokenKey === "native") {
      const tx = await signer.sendTransaction({
        to: treasury,
        value: ethers.parseEther(human),
      });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        setError("ETH transfer failed");
        return null;
      }
      txHash = receipt.hash;
    } else {
      const ERC20_ABI = [
        "function transfer(address to, uint256 value) returns (bool)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address account) view returns (uint256)",
      ];
      const c = new ethers.Contract(tokenKey, ERC20_ABI, signer);
      const dec = await c.decimals();
      const parsed = ethers.parseUnits(human, dec);
      const onChainBal = (await c.balanceOf(signer.address)) as bigint;
      if (onChainBal < parsed) {
        setError(
          `Not enough tokens on Base to complete this payment. Required ${human} (wallet has less on-chain). Refresh balances or add SEND, then try again.`
        );
        return null;
      }
      const tx = await c.transfer(treasury, parsed);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        setError("Token transfer failed");
        return null;
      }
      txHash = receipt.hash;
    }
    return txHash;
  };

  const confirmCryptoPay = async () => {
    const user = getUserFromStorage();
    if (!user || !quoteData || !quoteRail) return;
    if (payBalanceOk !== true) {
      setError(
        "Your in-app wallet balance does not cover this quote yet. Refresh balances, add funds, or pay with Naira."
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const txHash = await signAndSendCrypto();
      if (!txHash) return;
      const tokenAddr =
        quoteRail === "solana"
          ? quoteData.crypto.solanaInputTokenKey || solanaPayToken || SOL_USDC
          : basePayToken === "native"
            ? "native"
            : basePayToken;
      await fetch(getApiUrl("/api/wallet/balances/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {});
      await executePurchaseRequest(user.id, {
        paymentMethod: quoteRail === "solana" ? "solana_crypto" : "base_crypto",
        quoteId: quoteData.quoteId,
        cryptoTxHash: txHash,
        cryptoTokenAddress: tokenAddr,
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const lower = raw.toLowerCase();
      if (
        lower.includes("e450d38c") ||
        lower.includes("erc20insufficientbalance") ||
        (lower.includes("call_exception") && lower.includes("estimateGas") && lower.includes("0xa9059cbb"))
      ) {
        setError(
          "This payment needs more SEND on your Base wallet than you currently have. Tap Refresh balances, top up SEND on Base, then try again."
        );
      } else {
        setError(raw || "Payment failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const payWithNaira = async () => {
    const user = getUserFromStorage();
    if (!user) {
      router.push("/auth");
      return;
    }
    await executePurchaseRequest(user.id);
  };

  const fetchTVPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/tv-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load TV packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching TV packages:", error);
      setError("Failed to load TV packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchDataPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    setDurations([]);
    setSelectedDurationDays(null);
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/data-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
        const dur = data.durations || [];
        setDurations(dur);
        setSelectedDurationDays(dur.length > 0 ? dur[0].days : null);
      } else {
        setError("Failed to load data packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching data packages:", error);
      setError("Failed to load data packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchBettingPackages = async (network: string) => {
    if (!network) return;
    
    setLoadingPackages(true);
    setSelectedPackage("");
    setAmount("");
    
    try {
      const response = await fetch(getApiUrl(`/api/utility/betting-packages?network=${encodeURIComponent(network)}`));
      const data = await response.json();
      
      if (data.success && data.packages) {
        setPackages(data.packages);
      } else {
        setError("Failed to load betting packages. Please try again.");
        setPackages([]);
      }
    } catch (error) {
      console.error("Error fetching betting packages:", error);
      setError("Failed to load betting packages. Please try again.");
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as Nigerian number
    if (digits.startsWith("234")) {
      return `+${digits}`;
    } else if (digits.startsWith("0")) {
      return digits;
    } else if (digits.length > 0) {
      return `0${digits}`;
    }
    return digits;
  };

  // Function to detect network from phone number
  const detectNetwork = (phone: string): string | null => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // Extract the first 4 digits (or first 5 for some special cases)
    let prefix = "";
    if (digits.startsWith("234")) {
      // International format: +2348012345678 -> extract 8012
      prefix = digits.substring(3, 7);
    } else if (digits.startsWith("0")) {
      // Local format: 08012345678 -> extract 0801
      prefix = digits.substring(0, 4);
    } else if (digits.length >= 4) {
      // No leading 0: 8012345678 -> extract 8012
      prefix = digits.substring(0, 4);
    }
    
    // Network prefix mapping (Nigerian networks)
    const networkPrefixes: Record<string, string[]> = {
      MTN: [
        "0803", "0806", "0703", "0706", "0813", "0816", "0810", "0814",
        "0903", "0906", "0913", "0916", "07025", "07026", "0704"
      ],
      Airtel: [
        "0802", "0808", "0708", "0812", "0901", "0902", "0904", "0907", "0912"
      ],
      Glo: [
        "0805", "0807", "0705", "0815", "0811", "0905", "0915"
      ],
      "9mobile": [
        "0809", "0817", "0818", "0908", "0909"
      ],
    };
    
    // Check for 5-digit prefix first (MTN special cases)
    if (digits.length >= 5) {
      const fiveDigitPrefix = digits.startsWith("234") 
        ? digits.substring(3, 8) 
        : digits.substring(0, 5);
      
      if (networkPrefixes.MTN.includes(fiveDigitPrefix)) {
        return "MTN";
      }
    }
    
    // Check 4-digit prefix
    for (const [network, prefixes] of Object.entries(networkPrefixes)) {
      if (prefixes.includes(prefix)) {
        return network;
      }
    }
    
    return null;
  };

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phoneNumber && networks.length > 0) {
      const detectedNetwork = detectNetwork(phoneNumber);
      if (detectedNetwork && networks.includes(detectedNetwork)) {
        // Only auto-select if network is available for this service and different from current selection
        setSelectedNetwork((prev) => {
          if (prev !== detectedNetwork) {
            return detectedNetwork;
          }
          return prev;
        });
      }
    }
  }, [phoneNumber, networks]);

  if (loadingSettings || !serviceSettings) {
    return <PageLoadingSpinner message="Loading service..." bgClass="bg-background-dark" />;
  }

  if (serviceSettings.status !== "active") {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface/60 backdrop-blur-[24px] p-8 rounded-2xl border border-secondary/10 text-center">
          <span className="material-icons-outlined text-6xl text-red-400 mb-4">error_outline</span>
          <h2 className="text-xl font-bold text-white mb-2">Service Unavailable</h2>
          <p className="text-accent/70">
            {serviceName} is currently disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const subtitle =
    serviceId === "gift-card-redeem"
      ? "Enter your gift card code to redeem its value"
      : serviceId === "electricity"
      ? "Pay your electricity bills quickly and securely"
      : "Quick and secure transactions";

  return (
    <div className="min-h-screen bg-background-dark relative flex flex-col items-center p-4 pb-24 lg:pb-8">
      {/* Background blur orbs - Flippay branding */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="w-full max-w-lg mt-8 lg:mt-16 relative">
        {/* Header - match offramp */}
        <div className="text-center mb-10 relative">
          <button
            onClick={() => router.back()}
            className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="text-3xl font-bold mb-2 tracking-tight text-white font-display">{serviceName}</h1>
          <p className="text-accent/70">{subtitle}</p>
        </div>

        {/* Form Card - glass style like offramp */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] p-6 sm:p-8 border border-secondary/10 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Network Selection - hidden when allowMultipleNumbers (auto-detect per number) */}
            {networks.length > 0 && !allowMultipleNumbers && (
              <div ref={networkDropdownRef} className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Select Network
                  {phoneNumber && detectNetwork(phoneNumber) && (
                    <span className="ml-2 text-secondary font-normal normal-case">
                      (Auto-detected: {detectNetwork(phoneNumber)})
                    </span>
                  )}
                </label>
                {(serviceId === "betting" || serviceId === "airtime" || serviceId === "data" || serviceId === "tv" || serviceId === "gift-card-redeem") ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                      className={`w-full rounded-3xl border px-5 py-4 flex items-center justify-between transition-all ${
                        phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                          ? "bg-primary/60 border-secondary/30"
                          : "bg-primary/40 border-accent/10 hover:border-secondary/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedNetwork && (
                          <div className="relative w-6 h-6">
                            {(() => {
                              let logoUrl = "";
                              if (serviceId === "betting") {
                                logoUrl = getBettingNetworkLogo(selectedNetwork);
                              } else if (serviceId === "airtime" || serviceId === "data") {
                                logoUrl = getTelecomNetworkLogo(selectedNetwork);
                              } else if (serviceId === "tv") {
                                logoUrl = getTVNetworkLogo(selectedNetwork);
                              } else if (serviceId === "gift-card-redeem") {
                                // Use Reloadly product logo if available, otherwise fallback to local logo
                                const product = productMap[selectedNetwork];
                                logoUrl = product?.logoUrl || getGiftCardNetworkLogo(selectedNetwork);
                              }
                              
                              const logoKey = `${serviceId}-${selectedNetwork}`;
                              const hasFailed = failedLogos.has(logoKey);
                              
                              return (
                                <>
                                  {logoUrl && !hasFailed ? (
                                    // Show actual logo if available
                                    <Image
                                      src={logoUrl}
                                      alt={selectedNetwork}
                                      width={24}
                                      height={24}
                                      className="rounded object-contain"
                                      unoptimized
                                      onError={() => {
                                        setFailedLogos(prev => new Set(prev).add(logoKey));
                                      }}
                                    />
                                  ) : (
                                    // Fallback - show letter only if logo failed or unavailable
                                    <div className="w-6 h-6 rounded bg-primary/60 flex items-center justify-center">
                                      <span className="text-xs text-white font-bold">{selectedNetwork.charAt(0)}</span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <span className="font-medium text-white">{selectedNetwork || "Select a network"}</span>
                      </div>
                      <span className="material-icons-outlined text-accent/60">
                        {isNetworkDropdownOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {isNetworkDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                        {networks.map((network) => (
                          <button
                            key={network}
                            type="button"
                            onClick={() => {
                              setSelectedNetwork(network);
                              setIsNetworkDropdownOpen(false);
                            }}
                            className={`w-full p-4 flex items-center gap-3 transition-colors text-left ${
                              selectedNetwork === network
                                ? "bg-secondary/10 text-secondary"
                                : "text-white hover:bg-primary/50"
                            }`}
                          >
                            <div className="relative w-6 h-6">
                              {(() => {
                                let logoUrl = "";
                                // Note: This block only renders when serviceId is NOT "electricity" (see line 617 condition)
                                if (serviceId === "betting") {
                                  logoUrl = getBettingNetworkLogo(network);
                                } else if (serviceId === "airtime" || serviceId === "data") {
                                  logoUrl = getTelecomNetworkLogo(network);
                                } else if (serviceId === "tv") {
                                  logoUrl = getTVNetworkLogo(network);
                                } else if (serviceId === "gift-card-redeem") {
                                  // Use Reloadly product logo if available, otherwise fallback to local logo
                                  const product = productMap[network];
                                  logoUrl = product?.logoUrl || getGiftCardNetworkLogo(network);
                                }
                                
                                const logoKey = `${serviceId}-${network}`;
                                const hasFailed = failedLogos.has(logoKey);
                                
                                return (
                                  <>
                                    {logoUrl && !hasFailed ? (
                                      // Show actual logo if available
                                      <Image
                                        src={logoUrl}
                                        alt={network}
                                        width={24}
                                        height={24}
                                        className="rounded object-contain"
                                        unoptimized
                                        onError={() => {
                                          setFailedLogos(prev => new Set(prev).add(logoKey));
                                        }}
                                      />
                                    ) : (
                                      // Fallback - show letter only if logo failed or unavailable
                                      <div className="w-6 h-6 rounded bg-primary/60 flex items-center justify-center">
                                        <span className="text-xs text-white font-bold">{network.charAt(0)}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <span className="font-medium">{network}</span>
                            {selectedNetwork === network && (
                              <span className="material-icons-outlined text-secondary ml-auto text-sm">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <select
                    aria-label="Select network"
                    title="Select network"
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className={`w-full rounded-3xl border px-5 py-4 bg-primary/40 text-white placeholder-white/30 focus:border-secondary/30 focus:ring-0 outline-none ${
                      phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber)
                        ? "border-secondary/30"
                        : "border-accent/10"
                    }`}
                    required
                  >
                    <option value="">Select a network</option>
                    {networks.map((network) => (
                      <option key={network} value={network} className="bg-primary text-white">
                        {network}
                      </option>
                    ))}
                  </select>
                )}
                {phoneNumber && detectNetwork(phoneNumber) && selectedNetwork === detectNetwork(phoneNumber) && (
                  <p className="text-xs text-secondary mt-1 flex items-center gap-1">
                    <span className="material-icons-outlined text-sm">check_circle</span>
                    Network automatically detected
                  </p>
                )}
              </div>
            )}

            {/* Phone Number / Gift Card Code - above Data Plans when data service */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                {allowMultipleNumbers ? "Phone numbers (comma or space separated)" : placeholder}
              </label>
              <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                <span className="material-icons-outlined text-accent/40">
                  {serviceId === "gift-card-redeem" ? "card_giftcard" : serviceId === "electricity" ? "bolt" : "phone"}
                </span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => {
                    if (serviceId === "gift-card-redeem" || serviceId === "electricity" || allowMultipleNumbers) {
                      setPhoneNumber(e.target.value);
                    } else {
                      setPhoneNumber(formatPhoneNumber(e.target.value));
                    }
                  }}
                  placeholder={
                    serviceId === "gift-card-redeem"
                      ? "Enter gift card code"
                      : serviceId === "electricity"
                      ? "Enter meter number"
                      : allowMultipleNumbers
                      ? "08012345678, 08087654321, 08123456789"
                      : (placeholder || "08012345678 or +2348012345678")
                  }
                  maxLength={serviceId === "gift-card-redeem" ? 50 : serviceId === "electricity" ? 15 : (allowMultipleNumbers ? 500 : 14)}
                  className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                  required
                />
              </div>
            </div>

            {/* Package Selection - after phone number (data plans in app colors, no cashback) */}
            {showPackageDropdown && selectedNetwork && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  {serviceId === "data" ? "Data Plans" : "Select Package"}
                </label>
                {loadingPackages ? (
                  <div className="w-full rounded-3xl border border-accent/10 bg-primary/40 px-5 py-4 flex items-center gap-2">
                    <FSpinner size="xs" />
                    <span className="text-sm text-accent/70">Loading packages...</span>
                  </div>
                ) : serviceId === "data" && packages.length > 0 ? (
                  <>
                    {durations.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 border-b border-surface-highlight/30 pb-3">
                        {durations.map((d) => {
                          const isActive = selectedDurationDays === d.days;
                          return (
                            <button
                              key={d.days}
                              type="button"
                              onClick={() => setSelectedDurationDays(d.days)}
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                isActive
                                  ? "bg-secondary text-primary border-b-2 border-secondary"
                                  : "bg-primary/40 text-accent/80 hover:bg-primary/60 border-b-2 border-transparent"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  <div className="grid grid-cols-2 gap-3">
                    {(selectedDurationDays != null
                      ? packages.filter((p: any) => p.durationDays === selectedDurationDays)
                      : packages
                    ).map((pkg) => {
                      const pkgId = pkg.id || pkg.name;
                      const isSelected = selectedPackage === pkgId;
                      return (
                        <button
                          key={pkgId}
                          type="button"
                          onClick={() => setSelectedPackage(pkgId)}
                          className={`text-left rounded-2xl overflow-hidden bg-primary/80 border-2 transition-all shadow-md hover:shadow-lg border-surface-highlight hover:border-secondary/40 ${
                            isSelected ? "border-secondary ring-2 ring-secondary/30" : "border-accent/10"
                          }`}
                        >
                          <div className="p-3 pb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg font-bold text-white">
                                {pkg.data || pkg.name?.split(" ")[0] || "—"}
                              </span>
                            </div>
                            <p className="text-xs text-accent/80 mt-1 line-clamp-2">
                              {pkg.name || `${pkg.data || ""} valid for ${pkg.validity || ""}`}
                            </p>
                          </div>
                          <div className="flex bg-secondary/20 border-t border-secondary/20 px-3 py-2">
                            <div className="flex-1">
                              <p className="text-[10px] uppercase tracking-wide text-accent/70">Price</p>
                              <p className="text-sm font-bold text-white">
                                ₦{pkg.amount != null ? Number(pkg.amount).toLocaleString() : "—"}
                              </p>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[10px] uppercase tracking-wide text-accent/70">Validity</p>
                              <p className="text-sm font-bold text-white">
                                {pkg.validity || "—"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  </>
                ) : serviceId !== "data" ? (
                  <select
                    aria-label="Select a package"
                    title="Select a package"
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full rounded-3xl border border-accent/10 bg-primary/40 text-white px-5 py-4 focus:border-secondary/30 focus:ring-0 outline-none"
                    required
                  >
                    <option value="" className="bg-primary text-white">Select a package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id || pkg.name} value={pkg.id || pkg.name} className="bg-primary text-white">
                        {pkg.name} {pkg.amount ? `- ₦${pkg.amount.toLocaleString()}` : ""} {pkg.data ? `(${pkg.data})` : ""} {pkg.validity ? `- ${pkg.validity}` : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
                {packages.length === 0 && !loadingPackages && selectedNetwork && (
                  <p className="text-xs text-accent/50 mt-1">
                    No packages available for {selectedNetwork}
                  </p>
                )}
              </div>
            )}

            {/* Coupon code — before amount so discount shows in breakdown below */}
            {serviceId !== "gift-card-redeem" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Coupon Code <span className="normal-case font-normal text-accent/40">(optional)</span>
                </label>
                <div className={`flex items-center gap-3 p-4 rounded-3xl border bg-primary/40 transition-all focus-within:bg-primary/60 ${
                  couponValid ? "border-secondary/60" : couponError ? "border-red-500/40" : "border-accent/10 focus-within:border-secondary/30"
                }`}>
                  <span className={`material-icons-outlined text-lg ${couponValid ? "text-secondary" : couponError ? "text-red-400" : "text-accent/40"}`}>
                    confirmation_number
                  </span>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FP-XXXX-XXXX"
                    className="flex-1 bg-transparent border-none p-0 text-white font-mono placeholder-white/30 focus:ring-0 outline-none text-sm"
                    aria-label="Coupon code"
                  />
                  {couponLoading && <FSpinner size="xs" />}
                  {couponValid && !couponLoading && (
                    <span className="material-icons-outlined text-secondary text-lg">check_circle</span>
                  )}
                </div>
                {couponValid && (
                  <p className="text-xs text-secondary mt-1 font-semibold">
                    ✓ Coupon applied — ₦{couponValid.amount.toLocaleString()} discount
                  </p>
                )}
                {couponError && !couponLoading && couponCode.trim() && (
                  <p className="text-xs text-red-400 mt-1">{couponError}</p>
                )}
              </div>
            )}

            {/* Airtime: preset amount cards (same style as data plans) */}
            {serviceId === "airtime" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Select amount
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[50, 100, 200, 500, 1000, 2000].map((preset) => {
                    const isSelected = amount === String(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className={`text-left rounded-2xl overflow-hidden bg-primary/80 border-2 transition-all shadow-md hover:shadow-lg border-surface-highlight hover:border-secondary/40 ${
                          isSelected ? "border-secondary ring-2 ring-secondary/30" : "border-accent/10"
                        }`}
                      >
                        <div className="p-3 pb-2">
                          <span className="text-lg font-bold text-white">₦{preset.toLocaleString()}</span>
                          <p className="text-xs text-accent/80 mt-1">Airtime top-up</p>
                        </div>
                        <div className="flex bg-secondary/20 border-t border-secondary/20 px-3 py-2">
                          <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wide text-accent/70">Price</p>
                            <p className="text-sm font-bold text-white">₦{preset.toLocaleString()}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amount — for non-airtime or custom amount on airtime */}
            {serviceId !== "gift-card-redeem" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  {serviceId === "airtime" ? "Or enter custom amount (₦)" : "Amount (₦)"}
                </label>
                <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                  <span className="material-icons-outlined text-accent/40">payments</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={serviceId === "airtime" ? "e.g. 250" : (showPackageDropdown ? "Select a package or enter amount" : "Enter amount")}
                    min={serviceSettings.minAmount || 1}
                    max={serviceSettings.maxAmount || 1000000}
                    step="1"
                    className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                    required={!showPackageDropdown || !selectedPackage}
                    disabled={showPackageDropdown && selectedPackage ? true : false}
                  />
                </div>
                {serviceSettings.minAmount && serviceSettings.maxAmount && (
                  <p className="text-xs text-accent/50 mt-1">
                    Min: ₦{serviceSettings.minAmount.toLocaleString()} - Max: ₦{serviceSettings.maxAmount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
            
            {/* Gift Card Info Message */}
            {serviceId === "gift-card-redeem" && (
              <div className="p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                <p className="text-sm text-accent/90 flex items-start gap-2">
                  <span className="material-icons-outlined text-secondary text-lg">info</span>
                  <span>
                    <strong className="text-white">Redeem your existing gift card:</strong> Enter the gift card code you already have.
                    The value will be automatically detected from the code and credited to your account.
                  </span>
                </p>
              </div>
            )}

            {/* Price Breakdown */}
            {calculatedTotal > 0 && (
              <div className="p-5 rounded-2xl bg-primary/40 border border-accent/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-accent/70">Amount:</span>
                  <span className="text-white font-medium">₦{parseFloat(amount).toLocaleString()}</span>
                </div>
                {serviceSettings.markup > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-accent/70">Service Fee ({serviceSettings.markup}%):</span>
                    <span className="text-white font-medium">
                      ₦{((parseFloat(amount) * serviceSettings.markup) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {couponValid && (
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary font-semibold">Coupon ({couponValid.code}):</span>
                    <span className="text-secondary font-semibold">
                      −₦{Math.min(couponValid.amount, calculatedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-accent/10">
                  <span className="text-white font-bold">You pay:</span>
                  <span className={`font-bold text-lg ${couponValid ? "text-secondary" : "text-secondary"}`}>
                    {couponValid
                      ? (Math.max(0, calculatedTotal - couponValid.amount) === 0
                        ? <span className="text-secondary">FREE 🎉</span>
                        : `₦${Math.max(0, calculatedTotal - couponValid.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                      : `₦${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/30">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button - match offramp */}
            <button
              type="submit"
              disabled={loading || !phoneNumber || (serviceId !== "gift-card-redeem" && (!amount || calculatedTotal === 0))}
              className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FSpinner size="sm" />
                  Processing...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined font-bold">{icon}</span>
                  {serviceId === "gift-card-redeem" ? "Redeem Gift Card" : `Purchase ${serviceName}`}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center text-accent/40 text-xs mt-10">
          <PoweredBySEND />
        </div>
      </div>

      {payModalOpen && serviceId !== "gift-card-redeem" && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/75"
          onClick={() => {
            if (!loading) {
              setPayModalOpen(false);
              setQuoteData(null);
              setQuoteRail(null);
              setPayBalanceOk(null);
              setPayBalanceMessage(null);
              setPayBalanceGap(null);
              setPayBalanceLoading(false);
              setPayBalanceAvailable(null);
              setPayGasWarning(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] bg-[#052010] border border-accent/15 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">Pay with</h3>
            <p className="text-xs text-accent/50 mb-5">Choose how you want to pay for this utility.</p>

            {!quoteData && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={loading || quoteLoading}
                  onClick={() => void payWithNaira()}
                  className="w-full flex items-center justify-between rounded-2xl px-4 py-4 bg-primary/50 border border-accent/10 text-white font-semibold hover:bg-primary/70 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/12">
                      <span className="material-icons-outlined text-secondary">account_balance</span>
                    </span>
                    Naira (NGN)
                  </span>
                </button>
                <button
                  type="button"
                  disabled={loading || quoteLoading}
                  onClick={() => void fetchUtilityQuote("send")}
                  className="w-full flex items-center justify-between rounded-2xl px-4 py-4 bg-primary/50 border border-accent/10 text-white font-semibold hover:bg-primary/70 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <PaymentMethodBadge type="send" />
                    Send (SEND on Base)
                  </span>
                </button>
                <button
                  type="button"
                  disabled={loading || quoteLoading}
                  onClick={() => void fetchUtilityQuote("solana")}
                  className="w-full flex items-center justify-between rounded-2xl px-4 py-4 bg-primary/50 border border-accent/10 text-white font-semibold hover:bg-primary/70 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <PaymentMethodBadge type="solana" />
                    Solana (SOL, USDC, USDT)
                  </span>
                </button>
                <button
                  type="button"
                  disabled={loading || quoteLoading}
                  onClick={() => void fetchUtilityQuote("base")}
                  className="w-full flex items-center justify-between rounded-2xl px-4 py-4 bg-primary/50 border border-accent/10 text-white font-semibold hover:bg-primary/70 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <PaymentMethodBadge type="base" />
                    Base (ETH, USDC, USDT, SEND…)
                  </span>
                </button>
              </div>
            )}

            {quoteLoading && (
              <div className="flex justify-center py-8">
                <FSpinner size="md" />
              </div>
            )}

            {quoteData && !quoteLoading && (
              <div className="space-y-4">
                <button
                  type="button"
                  className="text-sm text-accent/60 hover:text-accent mb-2"
                  onClick={() => {
                    setQuoteData(null);
                    setQuoteRail(null);
                    setPayBalanceOk(null);
                    setPayBalanceMessage(null);
                    setPayBalanceGap(null);
                    setPayBalanceLoading(false);
                    setPayBalanceAvailable(null);
                    setPayGasWarning(null);
                  }}
                >
                  ← Back
                </button>
                <div className="space-y-1">
                  <p className="text-sm text-white">
                    Pay <span className="text-secondary font-bold">₦{quoteData.ngnTotal.toLocaleString()}</span>
                  </p>
                  {payQuoteDisplay.humanDisplayShort != null && (
                    <p className="text-sm font-semibold text-white/90">
                      {payQuoteDisplay.symbol} {payQuoteDisplay.humanDisplayShort}
                      {quoteRail === "send" ? (
                        <span className="text-xs font-normal text-accent/50"> on Base</span>
                      ) : null}
                    </p>
                  )}
                  {payQuoteDisplay.settlementHumanShort != null && payQuoteDisplay.settlementSymbol && (
                    <p className="text-xs text-accent/55 leading-relaxed">
                      Settles from your wallet as ~{payQuoteDisplay.settlementHumanShort}{" "}
                      {payQuoteDisplay.settlementSymbol}.
                    </p>
                  )}
                </div>
                {quoteRail === "solana" && (
                  <div className="rounded-2xl border border-accent/10 bg-primary/40 p-4 space-y-2">
                    <div className="flex justify-between text-xs text-accent/70">
                      <span>Actual utility price</span>
                      <span className="text-white">₦{(quoteData.crypto.solanaUtilityBaseNgn ?? quoteData.ngnSubtotal ?? quoteData.ngnTotal).toLocaleString()}</span>
                    </div>
                    {quoteData.crypto.gasSponsored && (
                      <>
                        <label className="flex items-center justify-between gap-3 text-sm text-white">
                          <span>Use gasless on Solana</span>
                          <input
                            type="checkbox"
                            checked={solanaGaslessEnabled}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setSolanaGaslessEnabled(next);
                              void fetchUtilityQuote("solana", solanaPayToken, next);
                            }}
                          />
                        </label>
                        {solanaGaslessEnabled && (quoteData.crypto.solanaGaslessFeeNgn || 0) > 0 && (
                          <div className="flex justify-between text-xs text-accent/70">
                            <span>Gasless fee</span>
                            <span className="text-white">₦{Number(quoteData.crypto.solanaGaslessFeeNgn || 0).toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {quoteRail === "base" && (
                  <div>
                    <label className="block text-xs font-semibold text-accent/60 mb-2">Token</label>
                    <select
                      aria-label="Pay with token on Base"
                      title="Pay with token on Base"
                      value={basePayToken}
                      onChange={(e) => setBasePayToken(e.target.value)}
                      className="w-full rounded-xl bg-primary/60 border border-accent/15 text-white px-4 py-3"
                    >
                      <option value="native">ETH (native)</option>
                      <option value={SEND_TOKEN_ADDRESS.toLowerCase()}>SEND</option>
                      <option value={BASE_USDC}>USDC</option>
                      <option value={BASE_USDT}>USDT</option>
                      <option value={BASE_WETH}>WETH</option>
                    </select>
                  </div>
                )}
                {quoteRail === "solana" && (
                  <div>
                    <label className="block text-xs font-semibold text-accent/60 mb-2">Token</label>
                    <select
                      aria-label="Pay with token on Solana"
                      title="Pay with token on Solana"
                      value={solanaPayToken}
                      onChange={(e) => {
                        const nextToken = e.target.value;
                        setSolanaPayToken(nextToken);
                        void fetchUtilityQuote("solana", nextToken, solanaGaslessEnabled);
                      }}
                      className="w-full rounded-xl bg-primary/60 border border-accent/15 text-white px-4 py-3"
                    >
                      {Object.entries(payWalletBalances.solana || {})
                        .filter(([tokenKey, token]) => {
                          if (parseFloat(token.balance || "0") <= 0) return false;
                          const lower = tokenKey.toLowerCase();
                          return (
                            tokenKey === "native" ||
                            lower === SOLANA_USDC_MINT.toLowerCase() ||
                            lower === SOLANA_USDT_MINT.toLowerCase()
                          );
                        })
                        .map(([tokenKey, token]) => (
                          <option key={tokenKey} value={tokenKey}>
                            {token.symbol || (tokenKey === "native" ? "SOL" : tokenKey)} ({formatPayBalanceAmount(parseFloat(token.balance || "0"), 6)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                {quoteRail === "solana" && quoteData.crypto.solanaNote && (
                  <p className="text-xs text-accent/60">{quoteData.crypto.solanaNote}</p>
                )}
                {payBalanceLoading && (
                  <div className="flex items-center gap-2 text-xs text-accent/60">
                    <FSpinner size="sm" />
                    Checking your in-app wallet balance…
                  </div>
                )}
                {!payBalanceLoading && payBalanceOk === true && payBalanceAvailable != null && (
                  <p className="text-xs text-secondary/90">
                    Balance looks sufficient (~{formatPayTokenUi(payBalanceAvailable, 2)}{" "}
                    {payQuoteDisplay.balanceLineSymbol} in your wallet).
                  </p>
                )}
                {!payBalanceLoading && payBalanceGap && (
                  <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-100/95 leading-relaxed">
                      Insufficient balance. You need {formatPayTokenUi(payBalanceGap.need, 3)}{" "}
                      {payBalanceGap.symbol}; you have ~{formatPayTokenUi(payBalanceGap.available, 2)}{" "}
                      {payBalanceGap.symbol}.
                    </p>
                    <Link
                      href="/receive"
                      className="inline-block text-xs font-bold text-secondary hover:text-secondary/90 underline underline-offset-2"
                    >
                      {payBalanceGap.symbol === "SEND"
                        ? "Top up your SEND token"
                        : `Top up your ${payBalanceGap.symbol}`}
                    </Link>
                  </div>
                )}
                {!payBalanceLoading && payBalanceMessage && (
                  <p className="text-xs text-amber-200/90">{payBalanceMessage}</p>
                )}
                {payGasWarning && (
                  <p className="text-xs text-amber-300/80">{payGasWarning}</p>
                )}
                <button
                  type="button"
                  disabled={loading || payBalanceLoading || payBalanceOk !== true}
                  className="w-full text-xs text-accent/60 hover:text-accent py-2 disabled:opacity-40"
                  onClick={() => setPayBalanceRefreshNonce((n) => n + 1)}
                >
                  Refresh balances
                </button>
                <button
                  type="button"
                  disabled={loading || payBalanceLoading || payBalanceOk !== true}
                  onClick={() => void confirmCryptoPay()}
                  className="w-full bg-secondary hover:bg-secondary/90 disabled:opacity-50 disabled:pointer-events-none text-primary font-extrabold py-4 rounded-2xl"
                >
                  {loading ? "Working…" : "Sign & pay"}
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              className="w-full mt-4 text-sm text-accent/50 hover:text-accent"
              onClick={() => {
                setPayModalOpen(false);
                setQuoteData(null);
                setQuoteRail(null);
                setPayBalanceOk(null);
                setPayBalanceMessage(null);
                setPayBalanceGap(null);
                setPayBalanceLoading(false);
                setPayBalanceAvailable(null);
                setPayGasWarning(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {utilitySuccess && <TransactionSuccess {...utilitySuccess} />}
    </div>
  );
}


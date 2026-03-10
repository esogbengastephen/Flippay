"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { authenticateWithPasskey } from "@/lib/passkey";
import { SUPPORTED_CHAINS, ChainType } from "@/lib/chains";
import { getChainLogo, getTokenLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import DashboardLayout from "@/components/DashboardLayout";
import { NIGERIAN_BANKS, isValidBankAccountNumber } from "@/lib/nigerian-banks";
import { generateWalletFromSeed, decryptSeedPhrase } from "@/lib/wallet";
import { ethers } from "ethers";
import {
  Connection as SolanaConnection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair as SolanaKeypair,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
} from "@solana/spl-token";

interface NigerianBank {
  code: string;
  name: string;
}

type SendType = "ngn" | "crypto";
type NGNRecipientType = "user" | "bank";

function SendPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [sendType, setSendType] = useState<SendType>("ngn");
  const [ngnRecipientType, setNgnRecipientType] = useState<NGNRecipientType>("user");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  const [walletBalances, setWalletBalances] = useState<Record<string, Record<string, { balance: string; usdValue: number; symbol: string; name: string; address: string }>>>({});
  const [virtualAccount, setVirtualAccount] = useState<any>(null);
  const [loadingVirtualAccount, setLoadingVirtualAccount] = useState(false);
  const [selectedChain, setSelectedChain] = useState("base");
  const [selectedToken, setSelectedToken] = useState<string>(""); // Token address
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<NigerianBank[]>(NIGERIAN_BANKS);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [verifiedAccount, setVerifiedAccount] = useState<{ accountName: string; accountNumber: string; bankCode: string } | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const chainDropdownRef = useRef<HTMLDivElement>(null);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false);
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false);
      }
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setIsBankDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);

    // Check for query parameters
    const chainParam = searchParams.get("chain");
    const tokenParam = searchParams.get("token");
    const typeParam = searchParams.get("type");

    if (chainParam && SUPPORTED_CHAINS[chainParam]) {
      setSelectedChain(chainParam);
    }
    if (tokenParam) {
      setSelectedToken(tokenParam);
    }
    if (typeParam === "crypto") {
      setSendType("crypto");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (user) {
      fetchWalletAddresses();
      fetchVirtualAccount();
      fetchBanksList();
    }
  }, [user]);

  const fetchBanksList = async () => {
    setLoadingBanks(true);
    try {
      // Fetch from our API endpoint which calls Flutterwave API
      const response = await fetch(getApiUrl("/api/flutterwave/banks"));
      const data = await response.json();
      
      if (data.success && data.data.banks) {
        setAvailableBanks(data.data.banks);
      } else {
        // Fallback to static list
        setAvailableBanks(NIGERIAN_BANKS);
      }
    } catch (error) {
      console.error("Error fetching banks list:", error);
      // Keep static list as fallback
      setAvailableBanks(NIGERIAN_BANKS);
    } finally {
      setLoadingBanks(false);
    }
  };

  // Fetch balances when crypto is selected
  useEffect(() => {
    if (user && sendType === "crypto") {
      fetchWalletBalances();
    }
  }, [sendType, user]);

  const fetchWalletAddresses = async () => {
    if (!user || !user.id) {
      console.error("[Send] No user or user.id available");
      return;
    }
    
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${user.id}`));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Send] Profile API error:", response.status, errorData);
        return;
      }
      
      const data = await response.json();
      if (data.success && data.profile && data.profile.addresses) {
        setWalletAddresses(data.profile.addresses);
      } else {
        console.error("[Send] Profile API returned unsuccessful:", data);
      }
    } catch (error) {
      console.error("[Send] Error fetching addresses:", error);
    }
  };

  const fetchWalletBalances = async () => {
    if (!user || !user.id) return;

    setLoadingBalances(true);
    setBalancesError(null);
    const controller = new AbortController();
    const timeoutMs = 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(getApiUrl(`/api/wallet/balances?userId=${user.id}`), {
        signal: controller.signal,
      });
      const data = await response.json();

      if (!response.ok) {
        setBalancesError(data.error || "Failed to load balances. Tap Retry.");
        return;
      }

      if (data.success && data.balances) {
        setBalancesError(null);
        setWalletBalances(data.balances || {});

        // data.balances is { chainId: { tokenAddress: { balance, usdValue, symbol, ... } } }
        const chainHasBalance = (chainBalances: Record<string, { balance: string }>) =>
          Object.values(chainBalances || {}).some((t) => parseFloat(t.balance) > 0);

        const currentChainTokens = data.balances[selectedChain];
        if (!currentChainTokens || !chainHasBalance(currentChainTokens)) {
          const availableChain = Object.entries(data.balances).find(([, tokens]) =>
            chainHasBalance(tokens as Record<string, { balance: string }>)
          );
          if (availableChain) {
            setSelectedChain(availableChain[0]);
          }
        }
      } else if (data.success && (!data.balances || Object.keys(data.balances).length === 0)) {
        // No wallet or no tokens
        setBalancesError(null);
        setWalletBalances({});
      } else {
        setBalancesError("Could not load token balances. Tap Retry.");
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        setBalancesError("Loading took too long. Tap Retry to try again.");
      } else {
        console.error("Error fetching wallet balances:", error);
        setBalancesError("Failed to load balances. Tap Retry.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoadingBalances(false);
    }
  };

  const fetchVirtualAccount = async () => {
    if (!user) return;

    setLoadingVirtualAccount(true);
    try {
      // Fetch dashboard data to get balance and account info
      const dashboardResponse = await fetch(getApiUrl(`/api/user/dashboard?userId=${user.id}`));
      const dashboardData = await dashboardResponse.json();

      if (dashboardData.success && dashboardData.data) {
        setVirtualAccount({
          accountNumber: dashboardData.data.user.accountNumber,
          bankName: dashboardData.data.user.bankName,
          balance: dashboardData.data.balance.ngn || 0,
        });
      } else {
        // Fallback to virtual account API
        const response = await fetch(getApiUrl(`/api/user/virtual-account?userId=${user.id}`));
        const data = await response.json();
        if (data.success && data.data) {
          setVirtualAccount({
            accountNumber: data.data.accountNumber,
            bankName: data.data.bankName,
            balance: 0,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching virtual account:", error);
    } finally {
      setLoadingVirtualAccount(false);
    }
  };

  const handleSend = async () => {
    if (!user || !recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate inputs
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError("Please enter a valid amount");
        return;
      }

          if (sendType === "crypto") {
            // Validate balance
            const tokenInfo = selectedTokenInfo;
            if (!tokenInfo || typeof tokenInfo === "string" || parseFloat(tokenInfo.balance) < amountNum) {
              const balance = typeof tokenInfo === "string" ? "0" : (tokenInfo?.balance || "0");
              const symbol = typeof tokenInfo === "string" ? "" : (tokenInfo?.symbol || "");
              setError(`Insufficient balance. Available: ${balance} ${symbol}`);
              setLoading(false);
              return;
            }

        // Validate recipient address format
        const chainConfig = SUPPORTED_CHAINS[selectedChain];
        if (chainConfig?.type === ChainType.EVM) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
            setError("Please enter a valid wallet address (0x...)");
            setLoading(false);
            return;
          }
        } else if (chainConfig?.type === ChainType.SOLANA) {
          try {
            new PublicKey(recipient);
          } catch {
            setError("Please enter a valid Solana address");
            setLoading(false);
            return;
          }
        }

        // Passkey authentication
        setAuthenticating(true);
        const authResult = await authenticateWithPasskey(user.id);
        if (!authResult.success) {
          setError("Passkey authentication failed. Please try again.");
          setLoading(false);
          setAuthenticating(false);
          return;
        }
        setAuthenticating(false);

        // Fetch encrypted seed from backend (passkey already verified above)
        const seedRes = await fetch(getApiUrl("/api/passkey/seed-phrase"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, passkeyVerified: true }),
        });
        const seedData = await seedRes.json();
        if (!seedData.success || !seedData.encryptedSeed) {
          setError("Could not retrieve wallet. Please try again.");
          setLoading(false);
          return;
        }

        // Decrypt seed phrase client-side
        let seedPhrase: string;
        try {
          seedPhrase = await decryptSeedPhrase(seedData.encryptedSeed, seedData.publicKey);
        } catch {
          setError("Failed to decrypt wallet. Please check your passkey and try again.");
          setLoading(false);
          return;
        }

        // Derive private key from seed
        const walletData = generateWalletFromSeed(seedPhrase);
        const privateKey = walletData.privateKeys[selectedChain] ?? walletData.privateKeys["base"];
        if (!privateKey) {
          setError("No private key found for this chain.");
          setLoading(false);
          return;
        }

        let txHash: string;
        let fromAddress: string;
        const tokenIsNative = selectedToken === "native" || !selectedToken;

        if (chainConfig?.type === ChainType.SOLANA) {
          // Solana send path
          const privateKeyBytes = Buffer.from(privateKey, "hex");
          const keypair = SolanaKeypair.fromSecretKey(privateKeyBytes);
          fromAddress = keypair.publicKey.toBase58();
          const connection = new SolanaConnection(
            chainConfig.rpcUrl || "https://api.mainnet-beta.solana.com",
            "confirmed"
          );
          const recipientPubkey = new PublicKey(recipient);

          if (tokenIsNative) {
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: recipientPubkey,
                lamports: BigInt(Math.round(parseFloat(amount) * LAMPORTS_PER_SOL)),
              })
            );
            txHash = await sendAndConfirmTransaction(connection, transaction, [keypair]);
          } else {
            // SPL token transfer
            const mintPubkey = new PublicKey(selectedToken);
            const mintInfo = await getMint(connection, mintPubkey);
            const fromATA = await getOrCreateAssociatedTokenAccount(
              connection, keypair, mintPubkey, keypair.publicKey
            );
            const toATA = await getOrCreateAssociatedTokenAccount(
              connection, keypair, mintPubkey, recipientPubkey
            );
            const parsedAmount = BigInt(
              Math.round(parseFloat(amount) * Math.pow(10, mintInfo.decimals))
            );
            const transaction = new Transaction().add(
              createTransferInstruction(fromATA.address, toATA.address, keypair.publicKey, parsedAmount)
            );
            txHash = await sendAndConfirmTransaction(connection, transaction, [keypair]);
          }
        } else {
          // EVM send path
          const rpcUrl = chainConfig?.rpcUrl || "https://base.llamarpc.com";
          const chainIdNum = chainConfig?.chainId ?? 8453;
          const provider = new ethers.JsonRpcProvider(rpcUrl, chainIdNum);
          const signer = new ethers.Wallet(privateKey, provider);
          fromAddress = signer.address;

          if (tokenIsNative) {
            // Native token transfer (ETH, MATIC, etc.)
            const tx = await signer.sendTransaction({
              to: recipient,
              value: ethers.parseEther(amount),
            });
            const receipt = await tx.wait();
            if (!receipt || receipt.status !== 1) {
              setError("Transaction failed on-chain. Please try again.");
              setLoading(false);
              return;
            }
            txHash = receipt.hash;
          } else {
            // ERC20 token transfer
            const ERC20_ABI = [
              "function transfer(address to, uint256 value) returns (bool)",
              "function decimals() view returns (uint8)",
            ];
            const contract = new ethers.Contract(selectedToken, ERC20_ABI, signer);
            const decimals: number = await contract.decimals();
            const parsedAmount = ethers.parseUnits(amount, decimals);
            const tx = await contract.transfer(recipient, parsedAmount);
            const receipt = await tx.wait();
            if (!receipt || receipt.status !== 1) {
              setError("Transaction failed on-chain. Please try again.");
              setLoading(false);
              return;
            }
            txHash = receipt.hash;
          }
        }

        // Record the send in the backend
        await fetch(getApiUrl("/api/crypto/record-send"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            tokenSymbol: selectedTokenInfo && typeof selectedTokenInfo !== "string" ? selectedTokenInfo.symbol : (chainConfig?.nativeCurrency?.symbol || ""),
            tokenAddress: tokenIsNative ? "native" : selectedToken,
            chainId: selectedChain,
            amount,
            fromAddress: walletAddresses[selectedChain] || fromAddress,
            toAddress: recipient,
            txHash,
            status: "completed",
          }),
        });

        alert(`Successfully sent ${amount} ${selectedTokenInfo && typeof selectedTokenInfo !== "string" ? selectedTokenInfo.symbol : ""} to ${recipient}\n\nTx: ${txHash.slice(0, 20)}...`);

        // Clear form and go home
        setRecipient("");
        setAmount("");
        setTimeout(() => router.push("/"), 1500);
      } else {
        // NGN send - either to user (phone) or bank account
        if (ngnRecipientType === "user") {
          // Send to user - validate phone number format (Nigerian mobile)
          const cleanedPhone = recipient.replace(/\D/g, "");
          const isValidPhone = cleanedPhone.length >= 10 && cleanedPhone.length <= 13 && 
                              (cleanedPhone.startsWith("0") || cleanedPhone.startsWith("234")) &&
                              ["7", "8", "9"].includes(cleanedPhone.replace(/^(0|234)/, "").charAt(0));

          if (!isValidPhone) {
            setError("Please enter a valid Nigerian mobile number (e.g., 07034494055)");
            setLoading(false);
            return;
          }
        } else {
          // Send to bank account - validate account number and bank
          if (!isValidBankAccountNumber(recipient)) {
            setError("Please enter a valid 10-digit bank account number");
            setLoading(false);
            return;
          }

          if (!selectedBank) {
            setError("Please select a bank");
            setLoading(false);
            return;
          }
        }

        // Validate balance
        if (!virtualAccount || parseFloat(virtualAccount.balance?.toString() || "0") < amountNum) {
          setError(`Insufficient balance. Available: ₦${parseFloat(virtualAccount?.balance?.toString() || "0").toLocaleString()}`);
          setLoading(false);
          return;
        }

        // Send NGN from user's Zainpay SVA wallet to a bank account
        const sendResponse = await fetch(getApiUrl("/api/zainpay/send-from-wallet"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            destinationAccountNumber: ngnRecipientType === "bank" ? recipient : undefined,
            destinationBankCode: ngnRecipientType === "bank" ? selectedBank : undefined,
            amount: amountNum,
            narration:
              ngnRecipientType === "user"
                ? `Transfer to ${recipient}`
                : `Transfer to ${availableBanks.find((b) => b.code === selectedBank)?.name || "Bank"} account`,
          }),
        });

        const sendData = await sendResponse.json();

        if (!sendData.success) {
          setError(sendData.error || "Transfer failed. Please try again.");
          setLoading(false);
          return;
        }

        // Success - show message and redirect
        const recipientDisplay = ngnRecipientType === "user" 
          ? recipient 
          : `${availableBanks.find(b => b.code === selectedBank)?.name || "Bank"} - ${recipient}`;
        alert(`Successfully sent ₦${amountNum.toLocaleString()} to ${recipientDisplay}`);
        
        // Refresh balance
        await fetchVirtualAccount();
        
        // Clear form
        setRecipient("");
        setAmount("");
        setSelectedBank("");
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error sending:", err);
      setError(err.message || "Failed to send. Please try again.");
    } finally {
      setLoading(false);
      setAuthenticating(false);
    }
  };

  const chainConfig = SUPPORTED_CHAINS[selectedChain];
  const userAddress = walletAddresses[selectedChain];
  
  // Get available chains with tokens that have balance > 0
  const availableChains = Object.entries(walletBalances)
    .filter(([_, tokens]) => {
      return Object.values(tokens).some(token => parseFloat(token.balance) > 0);
    })
    .map(([chainId]) => chainId);
  
  // Get available tokens for selected chain (with balance > 0)
  const availableTokens = selectedChain && walletBalances[selectedChain]
    ? Object.entries(walletBalances[selectedChain])
        .filter(([_, token]) => parseFloat(token.balance) > 0)
    : [];
  
  // Get selected token info
  const selectedTokenInfo = selectedChain && selectedToken && walletBalances[selectedChain]?.[selectedToken];
  
  // Auto-select first token if none selected but chain has tokens
  useEffect(() => {
    if (selectedChain && availableTokens.length > 0 && !selectedToken) {
      setSelectedToken(availableTokens[0][0]);
    }
  }, [selectedChain, availableTokens.length]);

  // Verify bank account when account number and bank are both provided
  useEffect(() => {
    // Skip if already verified for this exact account number and bank
    if (verifiedAccount && 
        verifiedAccount.accountNumber === recipient && 
        verifiedAccount.bankCode === selectedBank &&
        recipient.length === 10 &&
        selectedBank) {
      return;
    }

    if (ngnRecipientType === "bank" && recipient.length === 10 && selectedBank && !verifyingAccount) {
      const verifyAccount = async () => {
        setVerifyingAccount(true);
        setVerificationError(null);
        
        try {
          const response = await fetch(getApiUrl("/api/flutterwave/verify-account"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountNumber: recipient,
              bankCode: selectedBank,
            }),
          });

          const data = await response.json();

          if (data.success && data.data && data.data.accountName) {
            setVerifiedAccount({
              accountName: data.data.accountName,
              accountNumber: data.data.accountNumber || recipient,
              bankCode: selectedBank,
            });
            setVerificationError(null);
          } else {
            // Show error message with helpful context
            let errorMsg = data.error || "Failed to verify account. Please check the account number and bank.";
            
            // Add helpful context for test mode
            if (data.isTestMode && selectedBank !== "044") {
              errorMsg = "Account verification in test mode only supports Access Bank. Please switch to production mode or use Access Bank for testing.";
            }
            
            setVerificationError(errorMsg);
            setVerifiedAccount(null);
            console.error("[Account Verification] Failed:", data);
          }
        } catch (error: any) {
          console.error("Error verifying account:", error);
          setVerificationError("Network error. Please try again.");
          setVerifiedAccount(null);
        } finally {
          setVerifyingAccount(false);
        }
      };

      // Debounce verification - wait 500ms after user stops typing
      const timeoutId = setTimeout(verifyAccount, 500);
      return () => clearTimeout(timeoutId);
    } else if (ngnRecipientType === "bank" && (recipient.length !== 10 || !selectedBank)) {
      // Reset verification if account number or bank changes
      setVerifiedAccount(null);
      setVerificationError(null);
    }
  }, [recipient, selectedBank, ngnRecipientType]);

  return (
    <div className="min-h-screen bg-background-dark relative flex flex-col items-center p-3 sm:p-4 pb-24 lg:pb-8">
      {/* Background blur orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="w-full max-w-sm mt-2 sm:mt-6 lg:mt-12 relative">
        {/* Header */}
        <div className="text-center mb-3 sm:mb-6">
          <button
            onClick={() => router.back()}
            className="hidden lg:flex absolute left-0 top-0 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 tracking-tight text-white font-display">Send</h1>
          <p className="text-xs sm:text-base text-accent/70">
            {sendType === "crypto" ? "Transfer crypto across multiple chains" : "Send NGN to users or bank accounts"}
          </p>
        </div>

        {/* Main Card - glass style (compact) */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl p-3 sm:p-6 border border-secondary/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -z-10" />
          {/* Type Selector */}
          <div className="mb-2 sm:mb-4">
            <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1 sm:mb-2 px-1">
              Send Type
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <button
                onClick={() => setSendType("ngn")}
                className={`p-2 sm:p-3 rounded-xl border transition-all flex flex-col items-center gap-0.5 sm:gap-1 ${
                  sendType === "ngn"
                    ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                <span className="material-icons-outlined text-lg sm:text-2xl">account_balance</span>
                <span className="text-sm sm:text-base font-semibold">NGN</span>
              </button>
              <button
                onClick={() => setSendType("crypto")}
                className={`p-2 sm:p-3 rounded-xl border transition-all flex flex-col items-center gap-0.5 sm:gap-1 ${
                  sendType === "crypto"
                    ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                <span className="material-icons-outlined text-lg sm:text-2xl">currency_bitcoin</span>
                <span className="text-sm sm:text-base font-semibold">Crypto</span>
              </button>
            </div>
          </div>

          {sendType === "crypto" ? (
            <>
              {/* Chain selector - only show chains with balance > 0 */}
              <div className="mb-2 sm:mb-4">
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1 sm:mb-2 px-1">
                  Select Chain {loadingBalances && <span className="normal-case">(Loading...)</span>}
                </label>
                {loadingBalances ? (
                  <div className="w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/40 border border-accent/10 flex items-center justify-center gap-2 sm:gap-3">
                    <FSpinner size="sm" />
                    <span className="text-sm text-accent">Loading balances...</span>
                  </div>
                ) : balancesError ? (
                  <div className="w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center gap-3">
                    <p className="text-sm text-red-400 text-center">{balancesError}</p>
                    <button
                      type="button"
                      onClick={() => fetchWalletBalances()}
                      className="px-4 py-2 rounded-xl bg-secondary text-primary font-semibold text-sm hover:bg-secondary/90 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                    <>
                  {availableChains.length > 0 ? (
                    <>
                      {/* Chain selector with logo */}
                      <div className="relative mb-2 sm:mb-3" ref={chainDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                          className="w-full py-3 px-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-secondary/30"
                        >
                          <div className="flex items-center gap-4">
                            {getChainLogo(selectedChain) ? (
                              <Image
                                src={getChainLogo(selectedChain)}
                                alt={chainConfig?.name || selectedChain}
                                width={32}
                                height={32}
                                className="rounded-full"
                                unoptimized
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border border-accent/10">
                                <span className="material-icons-outlined text-sm text-secondary">hub</span>
                              </div>
                            )}
                            <div className="text-left">
                              <div className="text-sm font-bold text-white">{chainConfig?.name || selectedChain}</div>
                              <div className="text-[10px] text-secondary font-medium uppercase tracking-widest">
                                ${Object.values(walletBalances[selectedChain] || {}).reduce((sum, token) => sum + token.usdValue, 0).toFixed(2)} USD
                              </div>
                            </div>
                          </div>
                          <span className="material-icons-outlined text-accent/40">{isChainDropdownOpen ? "expand_less" : "expand_more"}</span>
                        </button>

                        {isChainDropdownOpen && (
                          <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                                {availableChains.map((chainId) => {
                                  const chain = SUPPORTED_CHAINS[chainId];
                                  const tokens = walletBalances[chainId] || {};
                                  const totalUSD = Object.values(tokens).reduce((sum, token) => sum + token.usdValue, 0);
                                  return (
                                    <button
                                      key={chainId}
                                      type="button"
                                      onClick={() => {
                                        setSelectedChain(chainId);
                                        setSelectedToken("");
                                        setIsChainDropdownOpen(false);
                                      }}
                                      className={`w-full p-4 flex items-center gap-3 transition-colors rounded-xl ${
                                        selectedChain === chainId 
                                          ? "bg-secondary/10 hover:bg-secondary/15" 
                                          : "hover:bg-white/5"
                                      }`}
                                    >
                                      {getChainLogo(chainId) ? (
                                        <Image
                                          src={getChainLogo(chainId)}
                                          alt={chain?.name || chainId}
                                          width={24}
                                          height={24}
                                          className="rounded-full"
                                          unoptimized
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                          <span className="text-xs text-white font-bold">{(chain?.name || chainId).charAt(0)}</span>
                                        </div>
                                      )}
                                      <span className="font-bold text-white">
                                        {chain?.name || chainId} (${totalUSD.toFixed(2)})
                                      </span>
                                      {selectedChain === chainId && (
                                        <span className="material-icons-outlined text-primary dark:text-primary ml-auto text-sm">
                                          check
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          
                      {/* Token selector - You Send section */}
                      {availableTokens.length > 0 && (
                        <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-6">
                          <div className="flex justify-between items-end px-1">
                            <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60">You Send</label>
                            {selectedTokenInfo && (
                              <span className="text-xs text-accent/60">
                                Balance: {parseFloat(selectedTokenInfo.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {selectedTokenInfo.symbol}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between py-3 px-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                            <div className="flex flex-col flex-1 min-w-0">
                              <input
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-transparent border-none p-0 text-xl sm:text-3xl font-bold focus:ring-0 w-full outline-none text-white placeholder-white/20"
                              />
                              {selectedTokenInfo && amount && parseFloat(amount) > 0 && selectedTokenInfo.usdValue > 0 && (
                                <span className="text-xs text-accent/50 mt-1">≈ ${(parseFloat(amount) * selectedTokenInfo.usdValue / parseFloat(selectedTokenInfo.balance)).toFixed(2)} USD</span>
                              )}
                            </div>
                            <div className="relative ml-3" ref={tokenDropdownRef}>
                              <button
                                type="button"
                                onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                                className="flex items-center gap-2 bg-primary px-4 py-2.5 rounded-2xl border border-accent/5 hover:bg-primary/80 transition-colors"
                              >
                                {selectedTokenInfo && getTokenLogo(selectedTokenInfo.symbol) ? (
                                  <Image
                                    src={getTokenLogo(selectedTokenInfo.symbol)}
                                    alt={selectedTokenInfo.symbol}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                    unoptimized
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : selectedTokenInfo ? (
                                  <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                    <span className="text-xs text-white font-bold">{selectedTokenInfo.symbol.charAt(0)}</span>
                                  </div>
                                ) : null}
                                <span className="font-bold text-white tracking-tight">{typeof selectedTokenInfo === "object" && selectedTokenInfo ? selectedTokenInfo.symbol : "Select"}</span>
                                <span className="material-icons-outlined text-sm text-secondary">expand_more</span>
                              </button>

                              {isTokenDropdownOpen && (
                                <div className="absolute z-50 right-0 mt-2 min-w-[200px] bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                                  {availableTokens.map(([tokenAddress, token]) => (
                                    <button
                                      key={tokenAddress}
                                      type="button"
                                      onClick={() => {
                                        setSelectedToken(tokenAddress);
                                        setIsTokenDropdownOpen(false);
                                      }}
                                      className={`w-full p-4 flex items-center gap-3 transition-colors rounded-xl ${
                                        selectedToken === tokenAddress 
                                          ? "bg-secondary/10 hover:bg-secondary/15" 
                                          : "hover:bg-white/5"
                                      }`}
                                    >
                                      {getTokenLogo(token.symbol) ? (
                                        <Image
                                          src={getTokenLogo(token.symbol)}
                                          alt={token.symbol}
                                          width={24}
                                          height={24}
                                          className="rounded-full"
                                          unoptimized
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
                                          <span className="text-xs text-white font-bold">{token.symbol.charAt(0)}</span>
                                        </div>
                                      )}
                                      <div className="flex-1 text-left">
                                        <span className="font-bold text-white block">{token.symbol}</span>
                                        <span className="text-xs text-accent/60">
                                          {parseFloat(token.balance).toFixed(6)} {token.usdValue > 0 ? `($${token.usdValue.toFixed(2)})` : ""}
                                        </span>
                                      </div>
                                      {selectedToken === tokenAddress && (
                                        <span className="material-icons-outlined text-secondary text-sm">check</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                        </>
                      ) : (
                        <div className="p-6 rounded-2xl bg-yellow-500/20 border border-yellow-500/30">
                          <p className="text-sm text-yellow-400 font-medium text-center">
                            No tokens available. Please receive tokens first.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

              {/* Recipient address */}
              {availableChains.length > 0 && availableTokens.length > 0 && selectedTokenInfo && (
                <>
                  <div className="space-y-3 mb-6">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 px-1">
                      Recipient Address
                    </label>
                    <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                      <span className="material-icons-outlined text-accent/40">wallet</span>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder={chainConfig?.type === "EVM" ? "0x... or ENS name" : chainConfig?.type === "SOLANA" ? "Solana address..." : "Wallet address..."}
                        className="flex-1 bg-transparent border-none p-0 text-base focus:ring-0 outline-none text-white placeholder-white/20 font-mono"
                      />
                    </div>
                  </div>

                  {userAddress && (
                    <div className="mb-3 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/40 border border-accent/5">
                      <p className="text-[10px] sm:text-xs text-accent/60 font-mono mb-0.5 sm:mb-1">
                        Your {chainConfig?.name} address: {userAddress.substring(0, 10)}...{userAddress.substring(userAddress.length - 8)}
                      </p>
                      <p className="text-xs font-semibold text-white">
                        Max: {parseFloat(selectedTokenInfo.balance).toFixed(6)} {selectedTokenInfo.symbol}
                      </p>
                    </div>
                  )}
                </>
              )}
              </>
            ) : loadingVirtualAccount ? (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4">
                <FSpinner size="md" />
                <p className="text-sm text-accent/80">Loading your NGN account...</p>
              </div>
            ) : !virtualAccount?.accountNumber ? (
              <div className="text-center py-8 sm:py-12">
                <span className="material-icons-outlined text-5xl sm:text-6xl text-accent/30 mb-4">account_balance</span>
                <p className="text-white font-medium mb-2">You need an NGN account to send Naira</p>
                <p className="text-sm text-accent/80 mb-6 max-w-sm mx-auto">
                  Complete verification in Settings to create your ZainBank NGN account. It only takes a minute.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/settings#phone-ngn")}
                  className="bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-4 px-6 rounded-xl sm:rounded-[1.5rem] transition-all flex items-center justify-center gap-2 mx-auto shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                >
                  <span className="material-icons-outlined">verified_user</span>
                  <span>Create NGN account</span>
                </button>
              </div>
            ) : (
              <>
                {/* Recipient Type Selector */}
                <div className="mb-3 sm:mb-6">
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-3 px-1">
                    Send To
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNgnRecipientType("user");
                        setRecipient("");
                        setSelectedBank("");
                      }}
                      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col items-center gap-1 sm:gap-2 ${
                        ngnRecipientType === "user"
                          ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                          : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                      }`}
                    >
                      <span className="material-icons-outlined text-lg sm:text-2xl">person</span>
                      <span className="text-sm sm:text-base font-semibold">User</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNgnRecipientType("bank");
                        setRecipient("");
                        setSelectedBank("");
                        setBankSearchQuery("");
                        setVerifiedAccount(null);
                        setVerificationError(null);
                      }}
                      className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col items-center gap-1 sm:gap-2 ${
                        ngnRecipientType === "bank"
                          ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                          : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                      }`}
                    >
                      <span className="material-icons-outlined text-lg sm:text-2xl">account_balance</span>
                      <span className="text-sm sm:text-base font-semibold">Bank</span>
                    </button>
                  </div>
                </div>

                {ngnRecipientType === "bank" && (
                  <>
                    {/* Searchable Bank Input */}
                    <div className="mb-3 sm:mb-6">
                      <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-3 px-1">
                        Search Bank
                      </label>
                      <div className="relative" ref={bankDropdownRef}>
                        <div className="flex items-center gap-2 sm:gap-3 py-3 px-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                          <span className="material-icons-outlined text-accent/40">account_balance</span>
                          <input
                          type="text"
                          value={selectedBank ? (availableBanks.find(b => b.code === selectedBank)?.name || bankSearchQuery) : bankSearchQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBankSearchQuery(value);
                            setSelectedBank(""); // Clear selection when user types
                            setVerifiedAccount(null); // Reset verification
                            setIsBankDropdownOpen(true);
                            // Auto-select if exact match
                            const exactMatch = availableBanks.find(
                              b => b.name.toLowerCase() === value.toLowerCase()
                            );
                            if (exactMatch) {
                              setSelectedBank(exactMatch.code);
                              setBankSearchQuery(exactMatch.name);
                              setIsBankDropdownOpen(false);
                            }
                          }}
                          onFocus={() => {
                            if (!selectedBank) {
                              setIsBankDropdownOpen(true);
                            }
                          }}
                          placeholder="Type to search banks (e.g., OPay, GTB, Moniepoint)"
                          className="flex-1 bg-transparent border-none p-0 text-sm sm:text-base focus:ring-0 outline-none text-white placeholder-white/20 min-w-0"
                        />
                        {selectedBank && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBank("");
                              setBankSearchQuery("");
                              setVerifiedAccount(null);
                            }}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <span className="material-icons-outlined text-sm text-accent">close</span>
                          </button>
                        )}
                        </div>

                        {/* Search Results Dropdown */}
                        {isBankDropdownOpen && (bankSearchQuery || !selectedBank) && (
                          <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                            {loadingBanks ? (
                              <div className="p-4 text-center">
                                <FSpinner size="sm" className="mx-auto" />
                                <p className="text-xs text-accent/60 mt-2">Loading banks...</p>
                              </div>
                            ) : (
                              <>
                                {availableBanks
                                  .filter(bank => 
                                    !bankSearchQuery || bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                                  )
                                  .slice(0, 20) // Limit to 20 results
                                  .map((bank, index) => (
                                    <button
                                      key={`${bank.code}-${bank.name}-${index}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedBank(bank.code);
                                        setBankSearchQuery(bank.name);
                                        setIsBankDropdownOpen(false);
                                        setVerifiedAccount(null); // Reset verification when bank changes
                                        setVerificationError(null);
                                      }}
                                      className={`w-full p-4 text-left transition-colors rounded-xl ${
                                        selectedBank === bank.code 
                                          ? "bg-secondary/10 hover:bg-secondary/15" 
                                          : "hover:bg-white/5"
                                      }`}
                                    >
                                      <span className="font-semibold text-white">{bank.name}</span>
                                      {selectedBank === bank.code && (
                                        <span className="material-icons-outlined text-secondary ml-auto float-right text-sm">check</span>
                                      )}
                                    </button>
                                  ))}
                                {bankSearchQuery && availableBanks.filter(bank => 
                                  bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="p-4 text-center">
                                    <p className="text-sm text-accent/60">No banks found matching "{bankSearchQuery}"</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </>
                )}

                {/* Recipient input */}
                <div className="mb-3 sm:mb-6">
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-3 px-1">
                    {ngnRecipientType === "user" 
                      ? "Recipient Phone Number" 
                      : "Recipient Account Number"}
                  </label>
                  <div className="flex items-center gap-2 sm:gap-3 py-3 px-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                    <span className="material-icons-outlined text-accent/40 text-lg sm:text-2xl shrink-0">
                      {ngnRecipientType === "user" ? "phone" : "account_balance"}
                    </span>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (ngnRecipientType === "bank") {
                          const cleaned = value.replace(/\D/g, "").slice(0, 10);
                          setRecipient(cleaned);
                          if (cleaned !== recipient) {
                            setVerifiedAccount(null);
                            setVerificationError(null);
                          }
                        } else {
                          setRecipient(value);
                        }
                      }}
                      placeholder={ngnRecipientType === "user" 
                        ? "Enter phone (e.g., 07034494055)" 
                        : "Enter 10-digit account number"}
                      maxLength={ngnRecipientType === "bank" ? 10 : undefined}
                      className="flex-1 bg-transparent border-none p-0 text-sm sm:text-base focus:ring-0 outline-none text-white placeholder-white/20 min-w-0"
                    />
                  </div>
                  {ngnRecipientType === "user" && (
                    <p className="text-[10px] sm:text-xs text-background-dark/70 dark:text-white/60 mt-0.5 sm:mt-1">
                      Enter recipient's Nigerian mobile number
                    </p>
                  )}
                  {ngnRecipientType === "bank" && (
                    <>
                      <p className="text-xs text-background-dark/70 dark:text-white/60 mt-1">
                        Enter 10-digit bank account number
                      </p>
                      {/* Account Verification Status */}
                      {verifyingAccount && (
                        <div className="mt-2 sm:mt-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-secondary/10 border border-secondary/20">
                          <div className="flex items-center gap-2">
                            <FSpinner size="xs" />
                            <p className="text-xs text-accent">Verifying account...</p>
                          </div>
                        </div>
                      )}
                      {verifiedAccount && !verifyingAccount && (
                        <div className="mt-2 sm:mt-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-secondary/10 border border-secondary/20">
                          <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                            <span className="material-icons-outlined text-sm text-secondary">check_circle</span>
                            <p className="text-xs font-semibold text-secondary">Account Verified</p>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-white">{verifiedAccount.accountName}</p>
                          <p className="text-[10px] sm:text-xs text-accent/80 mt-0.5 sm:mt-1">Account: {verifiedAccount.accountNumber}</p>
                        </div>
                      )}
                      {verificationError && !verifyingAccount && !verifiedAccount && (
                        <div className="mt-2 sm:mt-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-red-500/20 border border-red-500/30">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-icons-outlined text-sm text-red-400">error</span>
                            <p className="text-xs font-semibold text-red-400">Verification Failed</p>
                          </div>
                          <p className="text-xs text-red-400">{verificationError}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amount */}
                <div className="mb-3 sm:mb-6">
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-accent/60 mb-1.5 sm:mb-3 px-1">
                    Amount (₦)
                  </label>
                  <div className="flex items-center gap-2 sm:gap-3 py-3 px-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                    <span className="material-icons-outlined text-accent/40 text-lg sm:text-2xl shrink-0">payments</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0.00"
                      className="flex-1 bg-transparent border-none p-0 text-xl sm:text-2xl font-bold focus:ring-0 outline-none text-white placeholder-white/20 min-w-0"
                    />
                  </div>
                  {virtualAccount && (
                    <p className="text-[10px] sm:text-xs text-accent/60 mt-1 sm:mt-2 px-1">Balance: ₦ {(virtualAccount.balance || 0).toLocaleString()}</p>
                  )}
                </div>
              </>
            )}

          {error && (
            <div className="mb-3 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-red-500/20 border border-red-500/30">
              <p className="text-xs sm:text-sm text-red-400 font-medium">{error}</p>
            </div>
          )}

          {authenticating && (
            <div className="mb-3 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/40 border border-secondary/20">
              <p className="text-xs sm:text-sm text-accent font-medium">
                Authenticating with passkey... Please follow the prompt on your device.
              </p>
            </div>
          )}

          {!(sendType === "ngn" && !virtualAccount?.accountNumber) && (
          <button
            onClick={handleSend}
            disabled={loading || !recipient || !amount || authenticating || 
                     (sendType === "crypto" && (availableChains.length === 0 || !selectedTokenInfo)) ||
                     (sendType === "ngn" && ngnRecipientType === "bank" && !selectedBank)}
            className="w-full text-sm sm:text-base font-extrabold py-3 sm:py-5 rounded-xl sm:rounded-[1.5rem] bg-secondary hover:bg-secondary/90 text-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] transition-all"
          >
            {loading ? (
              <>
                <FSpinner size="sm" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span className="material-icons-outlined font-bold">send</span>
                <span className="text-black">Send</span>
              </>
            )}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SendPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <PageLoadingSpinner message="Loading..." bgClass="bg-background-light dark:bg-background-dark" />
      }>
        <SendPageContent />
      </Suspense>
    </DashboardLayout>
  );
}

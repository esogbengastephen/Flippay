"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { SUPPORTED_CHAINS, VISIBLE_CHAINS } from "@/lib/chains";
import { authenticateWithPasskey } from "@/lib/passkey";
import { decryptSeedPhrase } from "@/lib/wallet";
import { getChainLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import dynamic from "next/dynamic";
import DashboardLayout from "@/components/DashboardLayout";

// Lazy load QRCode component to reduce initial bundle
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => ({ default: mod.QRCodeSVG })), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading QR...</div>,
});

type ReceiveType = "ngn" | "crypto";

export default function ReceivePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [receiveType, setReceiveType] = useState<ReceiveType>("ngn");
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  const [virtualAccount, setVirtualAccount] = useState<any>(null);
  const [loadingVirtualAccount, setLoadingVirtualAccount] = useState(false);
  const [selectedChain, setSelectedChain] = useState("base");
  const [copied, setCopied] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState(192);

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
  }, []);

  // Responsive QR size for mobile fit (avoids hydration mismatch)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setQrSize(mq.matches ? 136 : 192);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (user) {
      fetchWalletAddresses();
      fetchVirtualAccount();
    }
  }, [user]);

  const fetchVirtualAccount = async () => {
    if (!user) return;

    setLoadingVirtualAccount(true);
    try {
      const response = await fetch(getApiUrl(`/api/user/virtual-account?userId=${user.id}`));
      const data = await response.json();
      if (data.success && data.data) {
        setVirtualAccount({
          accountNumber: data.data.accountNumber,
          accountName: data.data.accountName ?? null,
          bankName: data.data.bankName,
        });
      }
    } catch (error) {
      console.error("Error fetching virtual account:", error);
    } finally {
      setLoadingVirtualAccount(false);
    }
  };

  const fetchWalletAddresses = async () => {
    if (!user || !user.id) {
      console.error("[Receive] No user or user.id available");
      setLoadingAddresses(false);
      return;
    }
    
    setLoadingAddresses(true);
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${user.id}`));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Receive] Profile API error:", response.status, errorData);
        return;
      }
      
      const data = await response.json();
      
      if (data.success && data.profile) {
        console.log("[Receive] Fetched addresses:", {
          addresses: data.profile.addresses,
          keys: data.profile.addresses ? Object.keys(data.profile.addresses) : [],
          selectedChain,
          hasSelected: data.profile.addresses?.[selectedChain]
        });
        
        if (data.profile.addresses) {
          setWalletAddresses(data.profile.addresses);
          console.log("[Receive] State updated with addresses:", Object.keys(data.profile.addresses));
        }
        setHasPasskey(data.profile.hasPasskey || false);
      } else {
        console.error("[Receive] Profile API returned unsuccessful:", data);
      }
    } catch (error) {
      console.error("[Receive] Error fetching addresses:", error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const currentAddress = walletAddresses[selectedChain] || "";
  const chainConfig = SUPPORTED_CHAINS[selectedChain];
  
  // Check if user has addresses but missing the selected chain
  const hasAnyAddress = Object.keys(walletAddresses).length > 0;
  const missingSelectedChain = hasAnyAddress && !currentAddress && hasPasskey;
  const availableChains = Object.keys(walletAddresses).filter(chain => walletAddresses[chain]);
  
  // Debug: Log when addresses or selected chain changes
  useEffect(() => {
    console.log("[Receive] Address state:", {
      selectedChain,
      currentAddress: currentAddress || "NONE",
      allAddresses: walletAddresses,
      addressKeys: Object.keys(walletAddresses),
      hasAddressForSelected: !!walletAddresses[selectedChain]
    });
  }, [selectedChain, walletAddresses, currentAddress]);

  const copyAddress = () => {
    if (currentAddress) {
      navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  };

  const handleFixMissingAddresses = async () => {
    if (!user || !user.id) return;

    setRegenerating(true);
    setRegenerateError("");
    
    try {
      // Step 1: Authenticate with passkey
      console.log("[Receive] Starting passkey authentication...");
      const authResult = await authenticateWithPasskey(user.id);
      if (!authResult.success) {
        console.error("[Receive] Passkey auth failed:", authResult.error);
        setRegenerateError(
          `Passkey authentication failed: ${authResult.error || "Unknown error"}\n\nPlease ensure:\n- Your device supports passkeys\n- You complete the biometric/PIN prompt\n- You're using a secure connection (HTTPS or localhost)`
        );
        return;
      }
      console.log("[Receive] Passkey authentication successful");

      // Step 2: Get encrypted seed
      const seedResponse = await fetch(getApiUrl("/api/passkey/seed-phrase"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          passkeyVerified: true,
        }),
      });

      const seedData = await seedResponse.json();
      if (!seedData.success || !seedData.encryptedSeed || !seedData.publicKey) {
        setRegenerateError("Failed to retrieve wallet data. Please try again.");
        return;
      }

      // Step 3: Decrypt seed phrase client-side
      const seedPhrase = await decryptSeedPhrase(seedData.encryptedSeed, seedData.publicKey);
      
      // Step 3.5: Generate addresses client-side (where we know it works)
      console.log("[Receive] Generating addresses client-side...");
      console.log("[Receive] Seed phrase words:", seedPhrase.split(" ").length);
      
      // Test if ethers is available before generating
      try {
        const ethersTest = await import("ethers");
        console.log("[Receive] Ethers imported successfully:", typeof ethersTest.ethers !== "undefined");
        if (typeof ethersTest.ethers === "undefined") {
          throw new Error("ethers library failed to import");
        }
      } catch (ethersError: any) {
        console.error("[Receive] Ethers import failed:", ethersError);
        setRegenerateError(`Failed to load ethers library: ${ethersError.message}. Please refresh the page and try again.`);
        return;
      }
      
      let walletData: { addresses: Record<string, string> } | undefined;
      try {
        const { generateWalletFromSeed } = await import("@/lib/wallet");
        console.log("[Receive] Calling generateWalletFromSeed...");
        walletData = generateWalletFromSeed(seedPhrase);
        console.log("[Receive] Generated addresses:", Object.keys(walletData.addresses));
        console.log("[Receive] Address details:", walletData.addresses);
        
        if (!walletData) {
          setRegenerateError("Failed to generate wallet data. Please try again.");
          return;
        }
        
        // Check if EVM addresses were generated
        const evmChains = ["ethereum", "base", "polygon", "monad"];
        const missingEVM = evmChains.filter(chain => !walletData!.addresses[chain]);
        if (missingEVM.length > 0) {
          console.error("[Receive] ❌ MISSING EVM ADDRESSES:", missingEVM);
          console.error("[Receive] Available addresses:", Object.keys(walletData.addresses));
          setRegenerateError(`Failed to generate addresses for: ${missingEVM.join(", ")}. Check browser console (F12) for detailed error messages.`);
          return;
        }
        
        console.log("[Receive] ✅ All addresses generated successfully!");
      } catch (error: any) {
        console.error("[Receive] ❌ Error generating wallet:", error);
        console.error("[Receive] Error name:", error?.name);
        console.error("[Receive] Error message:", error?.message);
        console.error("[Receive] Error stack:", error?.stack);
        setRegenerateError(`Failed to generate wallet addresses: ${error.message || "Unknown error"}. Check browser console (F12) for details.`);
        return;
      }
      
      // Step 4: Send generated addresses to server (more reliable than server-side generation)
      const fixResponse = await fetch(getApiUrl("/api/wallet/fix-missing-addresses"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          addresses: walletData.addresses, // Send pre-generated addresses
        }),
      });

      const fixData = await fixResponse.json();
      if (!fixData.success) {
        setRegenerateError(fixData.error || "Failed to fix addresses. Please try again.");
        return;
      }

      // Step 4: Clear error and show success
      setRegenerateError(""); // Clear any previous errors
      
      // Show success message with details
      const addedChains = fixData.added || [];
      const totalChains = fixData.totalChains || Object.keys(fixData.addresses || {}).length;
      const successMsg = `Successfully fixed wallet addresses!\n\nAdded: ${addedChains.length > 0 ? addedChains.map((c: string) => SUPPORTED_CHAINS[c]?.name || c).join(", ") : "all missing chains"}\nTotal chains: ${totalChains}`;
      alert(successMsg);
      
      // Update addresses directly from response
      if (fixData.addresses) {
        console.log("[Receive] Updating addresses from fix response:", Object.keys(fixData.addresses));
        setWalletAddresses(fixData.addresses);
      }
      
      // Also refresh from API to ensure consistency
      console.log("[Receive] Refreshing addresses from API after fix...");
      await fetchWalletAddresses();
      
      // Force re-render by updating selected chain if it was missing
      if (!walletAddresses[selectedChain] && fixData.addresses?.[selectedChain]) {
        console.log("[Receive] Selected chain now has address, forcing update");
        const currentChain = selectedChain;
        setSelectedChain(""); // Clear
        setTimeout(() => setSelectedChain(currentChain), 100); // Restore
      }
    } catch (error: any) {
      console.error("[Receive] Error fixing addresses:", error);
      setRegenerateError(error.message || "Failed to fix addresses. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <DashboardLayout>
    <div className="h-[100dvh] max-h-[100dvh] lg:min-h-screen lg:h-auto bg-background-dark relative flex flex-col items-center overflow-hidden">
      {/* Background blur orbs - clipped to viewport to prevent bottom artifact */}
      <div className="fixed inset-0 w-full h-[100dvh] max-h-[100dvh] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-0 left-[-5%] w-[400px] h-[400px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="w-full max-w-lg flex-1 flex flex-col min-h-0 overflow-y-auto p-4 pt-4 pb-28 lg:pt-16 lg:pb-8">
        {/* Header - tighter on mobile */}
        <div className="text-center mb-4 lg:mb-10 shrink-0">
          <button
            onClick={() => router.back()}
            className="hidden lg:flex absolute left-0 top-0 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
          >
            <span className="material-icons-outlined">arrow_back</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 tracking-tight text-white font-display">Receive</h1>
          <p className="text-accent/70 text-sm sm:text-base">
            {receiveType === "crypto" ? "Get your wallet address to receive crypto" : "Share your virtual account to receive NGN"}
          </p>
        </div>

        {/* Main Card - glass style, tighter padding on mobile */}
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-secondary/10 shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -z-10" />

          {/* Type Selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-3 px-1">
              Receive Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReceiveType("ngn")}
                className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                  receiveType === "ngn"
                    ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                <span className="material-icons-outlined">account_balance</span>
                <span className="font-semibold">NGN</span>
              </button>
              <button
                onClick={() => setReceiveType("crypto")}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col items-center gap-1.5 sm:gap-2 ${
                  receiveType === "crypto"
                    ? "bg-primary border-secondary/40 text-secondary shadow-lg shadow-secondary/10"
                    : "bg-primary/40 border-accent/10 hover:border-secondary/20 text-accent"
                }`}
              >
                <span className="material-icons-outlined">currency_bitcoin</span>
                <span className="font-semibold">Crypto</span>
              </button>
            </div>
          </div>

          {receiveType === "crypto" ? (
            <>
              {/* Chain selector */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 px-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60">
                    Select Chain
                  </label>
                  <button
                    onClick={() => fetchWalletAddresses()}
                    className="text-xs text-accent/80 hover:text-secondary flex items-center gap-1 font-semibold transition-colors"
                    title="Refresh addresses"
                  >
                    <span className="material-icons-outlined text-sm">refresh</span>
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full p-5 rounded-3xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-secondary/30"
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
                        {Object.keys(VISIBLE_CHAINS).filter(c => walletAddresses[c]).length > 0 && (
                          <div className="text-[10px] text-secondary font-medium uppercase tracking-widest">
                            {Object.keys(VISIBLE_CHAINS).filter(c => walletAddresses[c]).length} chain{Object.keys(VISIBLE_CHAINS).filter(c => walletAddresses[c]).length !== 1 ? "s" : ""} available
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="material-icons-outlined text-accent/40">{isDropdownOpen ? "expand_less" : "expand_more"}</span>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/20 shadow-xl max-h-64 overflow-y-auto">
                      {Object.entries(VISIBLE_CHAINS).map(([chainId, chain]) => (
                        <button
                          key={chainId}
                          type="button"
                          onClick={() => {
                            setSelectedChain(chainId);
                            setIsDropdownOpen(false);
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
                              alt={chain.name}
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
                              <span className="text-xs text-white font-bold">{chain.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="font-bold text-white">{chain.name}</span>
                          {selectedChain === chainId && (
                            <span className="material-icons-outlined text-secondary ml-auto text-sm">check</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Address display */}
              {loadingAddresses ? (
                <PageLoadingSpinner message="Loading wallet addresses..." bgClass="bg-background-dark" />
              ) : !hasPasskey ? (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-accent/30 mb-4">fingerprint</span>
                  <p className="text-white font-medium mb-2">Passkey Not Set Up</p>
                  <p className="text-sm text-accent/80 mb-6">
                    You need to set up a passkey to generate wallet addresses
                  </p>
                  <button
                    onClick={() => router.push("/passkey-setup")}
                    className="bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-4 px-6 rounded-[1.5rem] transition-all flex items-center justify-center gap-2 mx-auto shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                  >
                    <span className="material-icons-outlined">fingerprint</span>
                    <span>Set Up Passkey</span>
                  </button>
                </div>
              ) : currentAddress ? (
              <>
                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-3 px-1">
                    Your {chainConfig?.name} Address
                  </label>
                  <div className="p-5 rounded-3xl bg-primary/40 border border-accent/10 break-all">
                    <p className="text-sm font-mono text-white" key={`addr-${selectedChain}-${currentAddress}`}>
                      {currentAddress}
                    </p>
                  </div>
                  <button
                    onClick={copyAddress}
                    className={`w-full mt-4 py-5 rounded-[1.5rem] font-extrabold flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] ${
                      copied 
                        ? "bg-secondary/80 text-primary" 
                        : "bg-secondary hover:bg-secondary/90 text-primary"
                    }`}
                  >
                    {copied ? (
                      <>
                        <span className="material-icons-outlined font-bold">check</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined font-bold">content_copy</span>
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>

                {/* QR Code */}
                <div className="mt-6 p-8 rounded-2xl bg-primary/40 border border-accent/10 flex flex-col items-center justify-center">
                  <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-4 p-4">
                    <QRCodeSVG
                      value={currentAddress}
                      size={qrSize}
                      level="H"
                      includeMargin={true}
                      fgColor="#1a1a1a"
                      bgColor="#ffffff"
                    />
                  </div>
                  <p className="text-sm text-accent/80 text-center font-medium">
                    QR Code for {chainConfig?.name} address
                  </p>
                  <p className="text-xs text-accent/60 text-center mt-2 font-mono">
                    {formatAddress(currentAddress)}
                  </p>
                </div>

                {/* Network info */}
                <div className="mt-6 p-4 rounded-2xl bg-primary/40 border border-accent/5">
                  <p className="text-xs text-white font-medium">
                    <strong>Network:</strong> {chainConfig?.name}
                  </p>
                  <p className="text-xs text-accent/80 mt-1">
                    <strong>Symbol:</strong> {chainConfig?.nativeCurrency?.symbol || "N/A"}
                  </p>
                  <p className="text-xs text-accent/60 mt-2">
                    Make sure you're sending to the correct network. Sending to the wrong network may result in loss of funds.
                  </p>
                </div>
              </>
              ) : missingSelectedChain ? (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-accent/30 mb-4">account_balance_wallet</span>
                  <p className="text-white font-medium mb-2">
                    No wallet address found for {chainConfig?.name || "this chain"}
                  </p>
                  {availableChains.length > 0 && (
                    <p className="text-sm text-accent/80 mb-2 font-medium">
                      Available chains: {availableChains.map(c => SUPPORTED_CHAINS[c]?.name || c).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-accent/70 mt-4 mb-6">
                    This chain address wasn't generated during wallet setup.
                  </p>
                  
                  {regenerateError && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-500/20 border border-red-500/30">
                      <p className="text-sm text-red-400 font-medium whitespace-pre-line">
                        {regenerateError}
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleFixMissingAddresses}
                    disabled={regenerating}
                    className="bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-4 px-6 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                  >
                    {regenerating ? (
                      <>
                        <FSpinner size="sm" />
                        <span>Fixing addresses...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">refresh</span>
                        <span>Fix Missing Addresses</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-accent/60 mt-4">
                    Or try selecting: {availableChains.map(c => SUPPORTED_CHAINS[c]?.name || c).join(", ") || "another chain"}
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="material-icons-outlined text-6xl text-accent/30 mb-4">account_balance_wallet</span>
                  <p className="text-white font-medium">No wallet address found for {chainConfig?.name || "this chain"}</p>
                  <p className="text-sm text-accent/80 mt-2">
                    Please set up your passkey to generate wallet addresses
                  </p>
                </div>
              )}
              </>
          ) : (
            <>
              {/* NGN Virtual Account Display */}
              {loadingVirtualAccount ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 gap-4">
                  <FSpinner size="md" />
                  <p className="text-sm text-accent/80">Loading your NGN account...</p>
                </div>
              ) : virtualAccount?.accountNumber ? (
                <>
                  <div className="mb-4 sm:mb-6">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 sm:mb-3 px-1">
                      Your Virtual Account
                    </label>
                    <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-primary/40 border border-accent/10">
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-accent/60 mb-0.5 sm:mb-1 font-medium">Account Number</p>
                          <p className="text-lg sm:text-2xl font-bold text-white font-mono truncate">
                            {virtualAccount.accountNumber}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(virtualAccount.accountNumber);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-colors shrink-0 ${
                            copied ? "bg-secondary/80" : "bg-primary hover:bg-primary/80 border border-accent/10"
                          }`}
                        >
                          <span className="material-icons-outlined text-secondary text-lg sm:text-xl">
                            {copied ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                      {virtualAccount.accountName && (
                        <div className="pt-3 sm:pt-4 border-t border-accent/10">
                          <p className="text-xs text-accent/60 mb-0.5 sm:mb-1 font-medium">Account Name</p>
                          <p className="text-sm sm:text-base font-semibold text-white break-words min-w-0">
                            {virtualAccount.accountName}
                          </p>
                        </div>
                      )}
                      <div className="pt-3 sm:pt-4 border-t border-accent/10">
                        <p className="text-xs text-accent/60 mb-0.5 sm:mb-1 font-medium">Bank Name</p>
                        <p className="text-sm sm:text-base font-semibold text-white min-w-0">
                          {virtualAccount.bankName || "ZainBank"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(virtualAccount.accountNumber);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={`w-full mt-4 py-5 rounded-[1.5rem] font-extrabold flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(19,236,90,0.2)] active:scale-[0.98] ${
                        copied ? "bg-secondary/80 text-primary" : "bg-secondary hover:bg-secondary/90 text-primary"
                      }`}
                    >
                      {copied ? (
                        <>
                          <span className="material-icons-outlined font-bold">check</span>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <span className="material-icons-outlined font-bold">content_copy</span>
                          <span>Copy Account Number</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* QR Code for NGN - compact on mobile */}
                  {virtualAccount?.accountNumber && (
                    <div className="mt-4 sm:mt-6 p-4 sm:p-8 rounded-xl sm:rounded-2xl bg-primary/40 border border-accent/10 flex flex-col items-center justify-center">
                      <div className="w-36 h-36 sm:w-48 sm:h-48 bg-white rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 p-2 sm:p-4">
                        <QRCodeSVG
                          value={`${virtualAccount.accountNumber}|${virtualAccount.bankName || "ZainBank"}`}
                          size={qrSize}
                          level="H"
                          includeMargin={true}
                          fgColor="#1a1a1a"
                          bgColor="#ffffff"
                        />
                      </div>
                      <p className="text-xs sm:text-sm text-accent/80 text-center font-medium">
                        QR Code for NGN payments
                      </p>
                      <p className="text-xs text-accent/60 text-center mt-1 sm:mt-2 font-mono">
                        {virtualAccount.accountNumber}
                      </p>
                      <p className="text-xs text-accent/60 text-center mt-0.5 sm:mt-1">
                        {virtualAccount.bankName || "ZainBank"}
                      </p>
                    </div>
                  )}

                  {/* Info */}
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/40 border border-accent/5">
                    <p className="text-xs text-white font-medium mb-2">
                      💡 How to receive NGN payments
                    </p>
                    <p className="text-xs text-accent/70">
                      Share your account number above with anyone who wants to send you money. Payments will be automatically credited to your account.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <span className="material-icons-outlined text-5xl sm:text-6xl text-accent/30 mb-4">account_balance</span>
                  <p className="text-white font-medium mb-2">You need an NGN account to receive Naira</p>
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

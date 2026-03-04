"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DarkModeToggle from "@/components/DarkModeToggle";
import { getUserFromStorage, isUserLoggedIn } from "@/lib/session";
import { createPasskey, isPasskeySupported, isPlatformAuthenticatorAvailable } from "@/lib/passkey";
import FSpinner from "@/components/FSpinner";
import { generateWalletFromSeed, generateSeedPhrase, encryptSeedPhrase } from "@/lib/wallet";

export default function PasskeySetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState("");
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [step, setStep] = useState<"intro" | "creating" | "success">("intro");
  const [hasExistingWallet, setHasExistingWallet] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    checkAuth();
    checkPasskeySupport();
    
    // Check for recovery mode in URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("recovery") === "true") {
        setIsRecoveryMode(true);
      }
    }
  }, []);

  const checkAuth = () => {
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
    setLoading(false);

    // Check if user already has passkey
    checkExistingPasskey();
  };

  const checkExistingPasskey = async () => {
    if (!user) return;

    try {
      const response = await fetch(getApiUrl(`/api/user/check-passkey?userId=${user.id}`));
      const data = await response.json();

      if (data.success && data.hasPasskey) {
        // User already has passkey, redirect to dashboard
        router.push("/");
        return;
      }

      // Check if user has existing wallet (for recovery scenarios)
      if (data.success && data.hasWallet) {
        setHasExistingWallet(true);
        // Check if this is recovery mode (user came from recovery flow)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("recovery") === "true") {
          setIsRecoveryMode(true);
        }
      }
    } catch (error) {
      console.error("Error checking passkey:", error);
    }
  };

  const checkPasskeySupport = async () => {
    const supported = isPasskeySupported();
    const available = supported ? await isPlatformAuthenticatorAvailable() : false;
    setPasskeySupported(available);

    if (!supported) {
      setError("Passkeys are not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge.");
    } else if (!available) {
      setError("Platform authenticator is not available. Please ensure you're using a device that supports biometric authentication.");
    }
  };

  const handleSetupPasskey = async () => {
    if (!user) return;

    // Show warning if user has existing wallet and not in recovery mode
    if (hasExistingWallet && !isRecoveryMode && !showWarning) {
      setShowWarning(true);
      setError("WARNING: You already have a wallet. Creating a new passkey will generate a NEW wallet with NEW addresses. You will LOSE ACCESS to your old wallet and any funds in it. This action cannot be undone. Are you sure you want to continue?");
      return;
    }

    // If user confirmed the warning, clear it and proceed
    if (showWarning) {
      setShowWarning(false);
      setError("");
    }

    // If warning was shown and user clicked "Yes, Continue", proceed
    // (This check happens when showWarning is already true and user confirms)

    setSettingUp(true);
    setError("");
    setStep("creating");

    try {
      // Step 1: Generate wallet
      console.log("Generating wallet...");
      const seedPhrase = generateSeedPhrase();
      const walletData = generateWalletFromSeed(seedPhrase);
      
      // Verify all expected addresses were generated
      const expectedChains = ["bitcoin", "ethereum", "base", "polygon", "monad", "solana", "sui"];
      const missingChains = expectedChains.filter(chain => !walletData.addresses[chain]);
      
      if (missingChains.length > 0) {
        console.warn("Some chain addresses were not generated:", missingChains);
        // Continue anyway - some chains might fail but we should have at least some addresses
      }
      
      if (Object.keys(walletData.addresses).length === 0) {
        throw new Error("Failed to generate any wallet addresses. Please try again.");
      }
      
      console.log("Generated addresses for chains:", Object.keys(walletData.addresses));

      // Step 2: Create passkey
      console.log("Creating passkey...");
      const passkeyResult = await createPasskey(
        user.id,
        user.email,
        user.displayName || user.email
      );

      if (!passkeyResult.success || !passkeyResult.credential) {
        throw new Error(passkeyResult.error || "Failed to create passkey");
      }

      // Step 3: Encrypt seed phrase
      console.log("Encrypting seed phrase...");
      const encryptedSeed = await encryptSeedPhrase(
        seedPhrase,
        passkeyResult.credential.publicKey
      );

      // Step 4: Send to backend
      console.log("Saving to backend...");
      const response = await fetch(getApiUrl("/api/passkey/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          credentialId: passkeyResult.credential.rawId,
          publicKey: passkeyResult.credential.publicKey,
          encryptedSeed,
          addresses: walletData.addresses,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save passkey and wallet");
      }

      // Success!
      setStep("success");
      
      // Update user in storage
      const updatedUser = {
        ...user,
        hasPasskey: true,
        hasWallet: true,
        walletAddresses: walletData.addresses,
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/");
      }, 2000);

    } catch (err: any) {
      console.error("Error setting up passkey:", err);
      setError(err.message || "Failed to set up passkey. Please try again.");
      setStep("intro");
    } finally {
      setSettingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-dark">
        <div className="text-center">
          <FSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-accent/80">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background-dark px-4 pt-16 sm:pt-20 pb-8 relative">
      {/* Background blur orbs - Flippay branding */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
      </div>

      <div className="absolute top-4 left-4 flex items-center gap-4 z-10">
        <DarkModeToggle fixed={false} />
      </div>

      {/* Logo */}
      <div className="mb-4 flex justify-center">
        <img src="/logo.png" alt="FlipPay" className="h-12 sm:h-14 w-auto" />
      </div>

      {/* Card */}
      <div className="w-full max-w-md sm:max-w-lg">
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] border border-secondary/10 shadow-2xl p-5 sm:p-6">
          {step === "intro" && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="material-icons-outlined text-secondary text-3xl">fingerprint</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white font-display mb-1">
                  Set Up Passkey
                </h1>
                <p className="text-sm text-accent/80">
                  Secure your account with a passkey. This will also create your multi-chain wallet automatically.
                </p>
              </div>

              {error && (
                <div className={`mb-5 p-4 rounded-2xl ${
                  error.includes("WARNING")
                    ? "bg-secondary/10 border border-secondary/20"
                    : "bg-red-500/20 border border-red-500/30"
                }`}>
                  <p className={`text-sm ${
                    error.includes("WARNING")
                      ? "text-secondary"
                      : "text-red-400"
                  }`}>{error}</p>
                  {error.includes("WARNING") && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={async () => {
                          setError("");
                          setShowWarning(true);
                          await handleSetupPasskey();
                        }}
                        className="flex-1 bg-red-500/80 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-[1rem] transition-colors"
                      >
                        Yes, Continue (I understand the risk)
                      </button>
                      <button
                        onClick={() => {
                          setError("");
                          setShowWarning(false);
                        }}
                        className="flex-1 bg-primary/60 hover:bg-primary/80 text-accent font-semibold py-2 px-4 rounded-[1rem] border border-accent/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isRecoveryMode && hasExistingWallet && (
                <div className="mb-5 p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                  <p className="text-sm text-secondary">
                    <span className="material-icons-outlined align-middle text-base mr-1">info</span>
                    <strong>Recovery Mode:</strong> You're recovering your account. Your existing wallet addresses will be preserved for reference, but you'll get a new wallet with new addresses. The old seed phrase cannot be recovered without the old passkey.
                  </p>
                </div>
              )}

              <div className="space-y-4 mb-5">
                <div className="flex items-start gap-3">
                  <span className="material-icons-outlined text-secondary text-xl">security</span>
                  <div>
                    <p className="font-semibold text-white">Enhanced Security</p>
                    <p className="text-sm text-accent/80">
                      Use biometric authentication or device PIN
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-icons-outlined text-secondary text-xl">account_balance_wallet</span>
                  <div>
                    <p className="font-semibold text-white">Multi-Chain Wallet</p>
                    <p className="text-sm text-accent/80">
                      Automatically creates wallets for Bitcoin, Ethereum, Solana, and more
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-icons-outlined text-secondary text-xl">speed</span>
                  <div>
                    <p className="font-semibold text-white">Quick Access</p>
                    <p className="text-sm text-accent/80">
                      Sign in instantly with your device
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSetupPasskey}
                disabled={!passkeySupported || settingUp}
                className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-4 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
              >
                {settingUp ? (
                  <>
                    <FSpinner size="sm" />
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">fingerprint</span>
                    <span>Set Up Passkey</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (confirm("You'll need a passkey to access your wallet. Skip for now?")) {
                    router.push("/");
                  }
                }}
                className="w-full mt-3 text-accent/70 hover:text-secondary text-sm py-2 transition-colors"
              >
                Skip for now (you'll be prompted again)
              </button>
            </>
          )}

          {step === "creating" && (
            <div className="text-center py-4">
              <FSpinner size="xl" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Creating Your Wallet
              </h2>
              <p className="text-sm text-accent/80">
                Please follow the prompts on your device to set up your passkey...
              </p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-outlined text-secondary text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Passkey Set Up Successfully!
              </h2>
              <p className="text-sm text-accent/80 mb-4">
                Your multi-chain wallet has been created. Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


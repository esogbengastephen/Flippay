"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import { authenticateWithPasskey } from "@/lib/passkey";
import { decryptSeedPhrase } from "@/lib/wallet";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { getChainLogo } from "@/lib/logos";
import FSpinner from "@/components/FSpinner";
import { getKYCTierInfo, canUpgradeTier, formatCurrency, type KYCTier, KYC_TIERS } from "@/lib/kyc-tiers";

// Add Phone Number Form Component
function AddPhoneNumberForm({ onSuccess, userId }: { onSuccess: () => void; userId: string }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!userId) {
      setError("User ID is missing. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/flutterwave/add-phone-number"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, userId }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess("Phone number added successfully!");
        setPhoneNumber("");
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setError(data.error || "Failed to add phone number");
      }
    } catch (err: any) {
      setError(err.message || "Failed to add phone number");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="07034494055"
          className="w-full px-4 py-3 rounded-xl bg-primary/40 border border-accent/10 text-white placeholder-white/30 focus:border-secondary/30 focus:ring-0 outline-none"
          required
        />
        <p className="text-xs text-accent/50 mt-1">
          Enter your Nigerian mobile number (e.g., 07034494055)
        </p>
      </div>
      {error && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
          <p className="text-sm text-secondary">{success}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !phoneNumber}
        className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
      >
        {loading ? "Adding..." : "Add Phone Number"}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [walletAddresses, setWalletAddresses] = useState<Record<string, string>>({});
  
  // Invoice settings state
  const [invoiceType, setInvoiceType] = useState<"personal" | "business">("personal");
  const [savingInvoiceSettings, setSavingInvoiceSettings] = useState(false);
  const [invoiceSettingsSuccess, setInvoiceSettingsSuccess] = useState("");
  const [invoiceSettingsError, setInvoiceSettingsError] = useState("");
  
  // Seed phrase state
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string>("");
  const [authenticating, setAuthenticating] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [seedCopied, setSeedCopied] = useState(false);

  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    setUser(currentUser);
    fetchUserProfile(currentUser.id);
  }, [router]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/user/profile?userId=${userId}`));
      const data = await response.json();
      
      if (data.success && data.profile) {
        setUserProfile(data.profile);
        if (data.profile.addresses) {
          setWalletAddresses(data.profile.addresses);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSeedPhrase = async () => {
    if (!user?.id) return;

    setAuthenticating(true);
    setSeedError("");
    setSeedPhrase("");

    try {
      // Step 1: Authenticate with passkey
      const authResult = await authenticateWithPasskey(user.id);
      if (!authResult.success) {
        setSeedError(authResult.error || "Passkey authentication failed");
        return;
      }

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
        setSeedError("Failed to retrieve wallet data");
        return;
      }

      // Step 3: Decrypt seed phrase client-side
      const decryptedSeed = await decryptSeedPhrase(
        seedData.encryptedSeed,
        seedData.publicKey
      );

      setSeedPhrase(decryptedSeed);
      setShowSeedPhrase(true);
    } catch (error: any) {
      console.error("Error viewing seed phrase:", error);
      setSeedError(error.message || "Failed to view seed phrase");
    } finally {
      setAuthenticating(false);
    }
  };

  const copySeedPhrase = () => {
    if (seedPhrase) {
      navigator.clipboard.writeText(seedPhrase);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 2000);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // You can add a toast notification here
  };

  const handleSaveInvoiceSettings = async () => {
    if (!user?.id) return;

    setSavingInvoiceSettings(true);
    setInvoiceSettingsError("");
    setInvoiceSettingsSuccess("");

    try {
      const response = await fetch(getApiUrl("/api/user/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          invoice_type: invoiceType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInvoiceSettingsSuccess("Invoice settings saved successfully!");
        setTimeout(() => {
          setInvoiceSettingsSuccess("");
        }, 3000);
        // Refresh profile to get updated data
        fetchUserProfile(user.id);
      } else {
        setInvoiceSettingsError(data.error || "Failed to save invoice settings");
        setTimeout(() => {
          setInvoiceSettingsError("");
        }, 5000);
      }
    } catch (error: any) {
      console.error("Error saving invoice settings:", error);
      setInvoiceSettingsError(error.message || "Failed to save invoice settings");
      setTimeout(() => {
        setInvoiceSettingsError("");
      }, 5000);
    } finally {
      setSavingInvoiceSettings(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background-dark flex items-center justify-center pb-24 lg:pb-0">
          <FSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background-dark relative flex flex-col p-4 pb-24 lg:pb-8">
        {/* Background blur orbs */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
          <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
        </div>

        <div className="max-w-4xl mx-auto w-full relative">
          {/* Header */}
          <div className="text-center mb-10 relative">
            <button
              onClick={() => router.back()}
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
            >
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-white font-display">Settings</h1>
            <p className="text-accent/70">Manage your profile, security, and preferences</p>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <section id="profile" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Profile</h2>
                <p className="text-sm text-accent/60 mt-1">Your basic account information</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-accent/60">Display Name</p>
                    <p className="text-base font-medium text-white">
                      {userProfile?.displayName || "Not set"}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/profile")}
                    className="bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-5 rounded-xl transition-all shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
                  >
                    Edit Profile
                  </button>
                </div>
                <div className="pt-4 border-t border-accent/10">
                  <p className="text-sm text-accent/60 mb-1">Email</p>
                  <p className="text-base text-white">{user?.email}</p>
                </div>
              </div>
            </section>

            {/* Phone Number & NGN Account Section */}
            <section id="phone-ngn" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Phone & NGN Account</h2>
                <p className="text-sm text-accent/60 mt-1">Manage your phone number and NGN wallet</p>
              </div>
              <div className="p-6 space-y-4">
                {userProfile?.mobileNumber ? (
                  <>
                    <div className="pt-4 border-t border-accent/10">
                      <p className="text-sm text-accent/60 mb-1">Phone Number</p>
                      <p className="text-base text-white">{userProfile.mobileNumber}</p>
                    </div>
                    {userProfile.flutterwaveAccountNumber && (
                      <>
                        <div className="pt-4 border-t border-accent/10">
                          <p className="text-sm text-accent/60 mb-1">NGN Account Number</p>
                          <p className="text-base font-mono text-white">{userProfile.flutterwaveAccountNumber}</p>
                          <p className="text-xs text-accent/50 mt-1">{userProfile.flutterwaveBank}</p>
                        </div>
                        {!userProfile.flutterwaveIsPermanent && (
                          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                            <p className="text-xs text-accent/80 mb-2">
                              ⚠️ Temporary account (Tier 1). Verify your BVN to get a permanent account and upgrade to Tier 2 with higher limits.
                            </p>
                            <button
                              onClick={() => router.push("/kyc/verify-bvn")}
                              className="text-xs bg-secondary text-primary font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                              Verify BVN Now
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-accent/70">
                      Add your phone number to create your NGN wallet account.
                    </p>
                    <AddPhoneNumberForm onSuccess={() => fetchUserProfile(user.id)} userId={user.id} />
                  </div>
                )}
              </div>
            </section>

            {/* KYC Section */}
            <section id="kyc" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">KYC Verification & Limits</h2>
                <p className="text-sm text-accent/60 mt-1">Your verification tier and transaction limits</p>
              </div>
              <div className="p-6 space-y-4">
                {(() => {
                  const hasAccount = userProfile?.mobileNumber && userProfile?.flutterwaveAccountNumber;
                  const currentTier = hasAccount ? ((userProfile?.flutterwaveKYCTier || 1) as KYCTier) : (1 as KYCTier);
                  const tierInfo = getKYCTierInfo(currentTier);
                  const upgradeInfo = hasAccount ? canUpgradeTier(currentTier, !!userProfile?.flutterwaveIsPermanent) : { canUpgrade: false, nextTier: KYC_TIERS[2] };
                  const allTiers = [1, 2, 3] as KYCTier[];
                    
                    return (
                      <>
                        {!hasAccount && (
                          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 mb-4">
                            <p className="text-sm text-accent/80">
                              Add your phone number above to create your NGN account. Once created, you'll start at Tier 1.
                            </p>
                          </div>
                        )}

                        {/* Current Tier Card */}
                        {hasAccount && (
                          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-base font-semibold text-white">
                                Your Current Tier: {tierInfo.name}
                              </h3>
                              <span className="px-3 py-1 bg-secondary text-primary rounded-full text-xs font-bold">
                                Tier {currentTier} ✓
                              </span>
                            </div>
                            <p className="text-sm text-accent/70 mb-4">
                              {tierInfo.description}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                              <div className="p-3 rounded-lg bg-primary/40 border border-accent/10">
                                <p className="text-xs text-accent/60 mb-1">Daily Limit</p>
                                <p className="text-sm font-bold text-white">
                                  {formatCurrency(tierInfo.dailyLimit)}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-primary/40 border border-accent/10">
                                <p className="text-xs text-accent/60 mb-1">Monthly Limit</p>
                                <p className="text-sm font-bold text-white">
                                  {formatCurrency(tierInfo.monthlyLimit)}
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-primary/40 border border-accent/10">
                                <p className="text-xs text-accent/60 mb-1">Single Transaction</p>
                                <p className="text-sm font-bold text-white">
                                  {formatCurrency(tierInfo.singleTransactionLimit)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* All Tiers Comparison */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-white">
                            Available Tiers & Upgrade Options
                          </h4>
                          {allTiers.map((tier) => {
                            const info = KYC_TIERS[tier];
                            const isCurrentTier = tier === currentTier;
                            const isNextTier = tier === currentTier + 1;
                            const isLocked = tier > currentTier + 1;
                            
                            return (
                              <div
                                key={tier}
                                className={`p-4 rounded-xl border ${
                                  isCurrentTier
                                    ? "bg-secondary/10 border-secondary/30"
                                    : isNextTier
                                    ? "bg-secondary/5 border-secondary/20"
                                    : "bg-primary/40 border-accent/10"
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="text-sm font-semibold text-white">
                                        {info.name}
                                      </h5>
                                      {isCurrentTier && (
                                        <span className="px-2 py-0.5 bg-secondary text-primary text-xs rounded-full font-medium">
                                          Current
                                        </span>
                                      )}
                                      {isNextTier && (
                                        <span className="px-2 py-0.5 bg-secondary/80 text-primary text-xs rounded-full font-medium">
                                          Available
                                        </span>
                                      )}
                                      {isLocked && (
                                        <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full font-medium">
                                          Locked
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-accent/70 mb-3">
                                      {info.description}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                      <div>
                                        <p className="text-accent/50">Daily</p>
                                        <p className="font-semibold text-white">
                                          {formatCurrency(info.dailyLimit)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-accent/50">Monthly</p>
                                        <p className="font-semibold text-white">
                                          {formatCurrency(info.monthlyLimit)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-accent/50">Single TX</p>
                                        <p className="font-semibold text-white">
                                          {formatCurrency(info.singleTransactionLimit)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Upgrade Button Logic */}
                                {isNextTier && hasAccount && (
                                  <div className="mt-3 pt-3 border-t border-secondary/20">
                                    {currentTier === 1 ? (
                                      <button
                                        onClick={() => router.push("/kyc/verify-bvn")}
                                        className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span className="material-icons-outlined text-sm">arrow_upward</span>
                                        Verify BVN to Upgrade to Tier 2
                                      </button>
                                    ) : currentTier === 2 ? (
                                      <button
                                        onClick={() => router.push("/kyc/upgrade-tier-3")}
                                        className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span className="material-icons-outlined text-sm">arrow_upward</span>
                                        Upgrade to Tier 3 (Enhanced KYC)
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                                {isNextTier && !hasAccount && (
                                  <div className="mt-3 pt-3 border-t border-accent/10">
                                    <p className="text-xs text-accent/50 text-center">
                                      Add phone number to unlock
                                    </p>
                                  </div>
                                )}
                                {isLocked && (
                                  <div className="mt-3 pt-3 border-t border-accent/10">
                                    <p className="text-xs text-accent/50 text-center">
                                      Complete Tier {tier - 1} first to unlock
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Upgrade Benefits Summary */}
                        {hasAccount && upgradeInfo.canUpgrade && upgradeInfo.nextTier && (
                          <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-icons-outlined text-secondary">trending_up</span>
                              <h4 className="text-sm font-bold text-secondary">
                                Upgrade Benefits
                              </h4>
                            </div>
                            <div className="space-y-2 text-xs text-accent/80">
                              <p className="font-semibold">Upgrade to {upgradeInfo.nextTier.name} and get:</p>
                              <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>
                                  <strong>{(upgradeInfo.nextTier.dailyLimit / tierInfo.dailyLimit).toFixed(1)}x</strong> higher daily limit
                                  ({formatCurrency(tierInfo.dailyLimit)} → {formatCurrency(upgradeInfo.nextTier.dailyLimit)})
                                </li>
                                <li>
                                  <strong>{(upgradeInfo.nextTier.monthlyLimit / tierInfo.monthlyLimit).toFixed(1)}x</strong> higher monthly limit
                                  ({formatCurrency(tierInfo.monthlyLimit)} → {formatCurrency(upgradeInfo.nextTier.monthlyLimit)})
                                </li>
                                <li>
                                  <strong>{(upgradeInfo.nextTier.singleTransactionLimit / tierInfo.singleTransactionLimit).toFixed(1)}x</strong> higher single transaction limit
                                  ({formatCurrency(tierInfo.singleTransactionLimit)} → {formatCurrency(upgradeInfo.nextTier.singleTransactionLimit)})
                                </li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
              </div>
            </section>

            {/* Security Section - Seed Phrase */}
            <section id="security" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Security</h2>
                <p className="text-sm text-accent/60 mt-1">Seed phrase and wallet recovery</p>
              </div>
              <div className="p-6">
              {!showSeedPhrase ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                    <p className="text-sm text-secondary font-medium mb-2 flex items-center gap-2">
                      <span className="material-icons-outlined text-white text-lg">warning</span>
                      Important Security Warning
                    </p>
                    <ul className="text-xs text-accent/80 space-y-1 list-disc list-inside">
                      <li>Never share your seed phrase with anyone</li>
                      <li>Store it in a safe, offline location</li>
                      <li>Anyone with your seed phrase can access your wallet</li>
                      <li>We never store your seed phrase in plaintext</li>
                    </ul>
                  </div>
                  
                  {seedError && (
                    <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                      <p className="text-sm text-red-400">{seedError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleViewSeedPhrase}
                    disabled={authenticating}
                    className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
                  >
                    {authenticating ? (
                      <>
                        <FSpinner size="sm" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">fingerprint</span>
                        <span>View Seed Phrase</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                    <p className="text-sm text-red-400 font-medium">
                      ⚠️ Keep this seed phrase secret and secure!
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {seedPhrase.split(" ").map((word, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-xl bg-primary/40 border border-accent/10 text-center"
                      >
                        <span className="text-xs text-accent/50 mr-1">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-mono font-semibold text-white">
                          {word}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={copySeedPhrase}
                    className={`w-full font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)] ${
                      seedCopied
                        ? "bg-secondary/80 text-primary"
                        : "bg-secondary hover:bg-secondary/90 text-primary"
                    }`}
                  >
                    {seedCopied ? (
                      <>
                        <span className="material-icons-outlined">check</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined">content_copy</span>
                        <span>Copy Seed Phrase</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowSeedPhrase(false);
                      setSeedPhrase("");
                    }}
                    className="w-full bg-primary/40 hover:bg-primary/60 border border-accent/10 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Hide Seed Phrase
                  </button>
                </div>
              )}
              </div>
            </section>

            {/* Wallet Addresses Section */}
            <section id="wallets" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Wallet Addresses</h2>
                <p className="text-sm text-accent/60 mt-1">Your multi-chain wallet addresses</p>
              </div>
              <div className="p-6">
              {Object.keys(walletAddresses).length === 0 ? (
                <p className="text-sm text-accent/70">
                  No wallet addresses found. Please set up a passkey to generate addresses.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(walletAddresses).map(([chainId, address]) => {
                    const chain = SUPPORTED_CHAINS[chainId];
                    return (
                      <div
                        key={chainId}
                        className="p-4 rounded-xl bg-primary/40 border border-accent/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getChainLogo(chainId) ? (
                              <Image
                                src={getChainLogo(chainId)}
                                alt={chain?.name || chainId}
                                width={20}
                                height={20}
                                className="rounded-full"
                                unoptimized
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="text-sm font-semibold text-white">
                              {chain?.name || chainId}
                            </span>
                            <span className="text-xs text-accent/50">
                              ({chain?.nativeCurrency?.symbol || "N/A"})
                            </span>
                          </div>
                          <button
                            onClick={() => copyAddress(address)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition"
                            title="Copy address"
                          >
                            <span className="material-icons-outlined text-sm text-white">
                              content_copy
                            </span>
                          </button>
                        </div>
                        <p className="text-xs font-mono text-accent/80 break-all">
                          {address}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </section>

            {/* Invoice Settings */}
            <section id="invoice" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Invoice Settings</h2>
                <p className="text-sm text-accent/60 mt-1">Personal or business invoice type</p>
              </div>
              <div className="p-6 space-y-4">
                {/* Invoice Type Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-accent/80">
                    Invoice Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceType("personal")}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                        invoiceType === "personal"
                          ? "bg-primary border border-secondary/40 text-secondary"
                          : "bg-primary/40 border border-accent/10 text-accent hover:border-secondary/20"
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceType("business")}
                      className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all ${
                        invoiceType === "business"
                          ? "bg-primary border border-secondary/40 text-secondary"
                          : "bg-primary/40 border border-accent/10 text-accent hover:border-secondary/20"
                      }`}
                    >
                      Business
                    </button>
                  </div>
                  <p className="text-xs text-accent/60 mt-2">
                    {invoiceType === "personal" 
                      ? "Invoices will show your personal name and email"
                      : "Invoices will show your business information and logo"}
                  </p>
                </div>

                {/* Success/Error Messages */}
                {invoiceSettingsSuccess && (
                  <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                    <p className="text-sm text-secondary">{invoiceSettingsSuccess}</p>
                  </div>
                )}
                {invoiceSettingsError && (
                  <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
                    <p className="text-sm text-red-400">{invoiceSettingsError}</p>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSaveInvoiceSettings}
                  disabled={savingInvoiceSettings}
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
                >
                  {savingInvoiceSettings ? (
                    <>
                      <FSpinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined">save</span>
                      <span>Save Invoice Settings</span>
                    </>
                  )}
                </button>

                {/* Link to Profile for Business Details */}
                {invoiceType === "business" && (
                  <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20">
                    <p className="text-xs text-accent/80 mb-2">
                      💡 To set up your business information (name, logo, address), visit your Profile page.
                    </p>
                    <button
                      onClick={() => router.push("/profile")}
                      className="text-xs text-secondary hover:underline font-medium"
                    >
                      Go to Profile →
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Other Settings */}
            <section id="preferences" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">Preferences</h2>
                <p className="text-sm text-accent/60 mt-1">Quick links to receive and send</p>
              </div>
              <div className="p-6 space-y-4">
                <button
                  onClick={() => router.push("/receive")}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-white">
                      qr_code
                    </span>
                    <span className="text-white font-medium">
                      Receive Crypto
                    </span>
                  </div>
                  <span className="material-icons-outlined text-accent/60">
                    arrow_forward
                  </span>
                </button>

                <button
                  onClick={() => router.push("/send")}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-icons-outlined text-white">
                      send
                    </span>
                    <span className="text-white font-medium">
                      Send Crypto
                    </span>
                  </div>
                  <span className="material-icons-outlined text-accent/60">
                    arrow_forward
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


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
import PageLoadingSpinner from "@/components/PageLoadingSpinner";

const NGN_FORM_STEPS = 3;

// Create NGN Account (Zainpay SVA - ZainBank only) — 3-step form with progress bar
function CreateNGNAccountForm({
  onSuccess,
  userId,
  userEmail,
}: {
  onSuccess: () => void;
  userId: string;
  userEmail: string;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    surname: "",
    mobileNumber: "",
    dob: "",
    gender: "M" as "M" | "F",
    address: "",
    title: "Mr",
    state: "",
    bvn: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < NGN_FORM_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    if (!userId || !userEmail) {
      setError("Session missing. Please log in again.");
      setLoading(false);
      return;
    }
    const bvnClean = form.bvn.replace(/\D/g, "");
    if (bvnClean.length !== 11) {
      setError("BVN must be 11 digits.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(getApiUrl("/api/zainpay/create-user-sva"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          firstName: form.firstName.trim(),
          surname: form.surname.trim(),
          email: userEmail,
          mobileNumber: form.mobileNumber.replace(/\D/g, "").slice(0, 11),
          dob: form.dob.trim(),
          gender: form.gender,
          address: form.address.trim(),
          title: form.title.trim(),
          state: form.state.trim(),
          bvn: bvnClean,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(data.message || "NGN account created. You can now send and receive NGN.");
        setTimeout(() => onSuccess(), 1500);
      } else {
        setError(data.error || "Failed to create NGN account.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create NGN account.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base rounded-xl bg-primary/40 border border-accent/10 text-white placeholder-white/30 focus:border-secondary/30 focus:ring-0 outline-none";
  const btnClass =
    "flex-1 text-sm sm:text-base font-semibold py-2.5 px-4 sm:py-3 sm:px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-accent/70">
        Create a ZainBank NGN account for sending and receiving Naira. One account per user.
      </p>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-accent/60">
          <span>Step {step} of {NGN_FORM_STEPS}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-primary/40 overflow-hidden flex">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-full flex-1 transition-colors ${s <= step ? "bg-secondary" : "bg-primary/20"}`}
              style={{ minWidth: 0 }}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Personal basics */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-accent/60 mb-1">First name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className={inputClass}
                placeholder="John"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-accent/60 mb-1">Surname *</label>
              <input
                type="text"
                value={form.surname}
                onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                className={inputClass}
                placeholder="Doe"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-accent/60 mb-1">Mobile number *</label>
            <input
              type="tel"
              value={form.mobileNumber}
              onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
              className={inputClass}
              placeholder="00000000000"
              maxLength={11}
              required
            />
          </div>
        </div>
      )}

      {/* Step 2: Date of birth, gender, address */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-accent/60 mb-1">Date of birth *</label>
              <input
                type="date"
                aria-label="Date of birth"
                value={form.dob}
                onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-accent/60 mb-1">Gender *</label>
              <select
                aria-label="Gender"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as "M" | "F" }))}
                className={inputClass}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-accent/60 mb-1">Address *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={inputClass}
              placeholder="123 Street, City"
              required
            />
          </div>
        </div>
      )}

      {/* Step 3: Title, state, BVN */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-accent/60 mb-1">Title *</label>
              <select
                aria-label="Title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
              >
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Miss">Miss</option>
                <option value="Dr">Dr</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-accent/60 mb-1">State *</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className={inputClass}
                placeholder="Lagos"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-accent/60 mb-1">BVN (11 digits) *</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.bvn}
              onChange={(e) => setForm((f) => ({ ...f, bvn: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
              className={inputClass}
              placeholder="00000000000"
              maxLength={11}
              required
            />
          </div>
        </div>
      )}

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

      {/* Navigation: Previous + Next or Submit */}
      <div className="flex gap-3 pt-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className={`${btnClass} bg-primary/60 hover:bg-primary/80 text-white border border-accent/20`}
          >
            Previous
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {step < NGN_FORM_STEPS ? (
          <button
            type="submit"
            className={`${btnClass} bg-secondary hover:bg-secondary/90 text-primary shadow-[0_4px_14px_rgba(19,236,90,0.2)]`}
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className={`${btnClass} bg-secondary hover:bg-secondary/90 text-primary shadow-[0_4px_14px_rgba(19,236,90,0.2)]`}
          >
            {loading ? "Creating NGN account..." : "Create NGN account (ZainBank)"}
          </button>
        )}
      </div>
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
        <PageLoadingSpinner message="Loading..." bgClass="bg-background-dark" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background-dark relative flex flex-col p-3 sm:p-4 pb-24 lg:pb-8">
        {/* Background blur orbs */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary rounded-full blur-[160px] opacity-[0.05]" />
          <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary rounded-full blur-[120px] opacity-30" />
        </div>

        <div className="max-w-4xl mx-auto w-full relative">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-10 relative">
            <button
              onClick={() => router.back()}
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-colors text-accent/60 hover:text-secondary"
            >
              <span className="material-icons-outlined">arrow_back</span>
            </button>
            <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 tracking-tight text-white font-display">Settings</h1>
            <p className="text-sm sm:text-base text-accent/70">Manage your profile, security, and preferences</p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Profile Section */}
            <section id="profile" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Profile</h2>
                <p className="text-sm text-accent/60 mt-1">Your basic account information</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-accent/60">Display Name</p>
                    <p className="text-sm sm:text-base font-medium text-white truncate">
                      {userProfile?.displayName || "Not set"}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/profile")}
                    className="shrink-0 text-sm font-semibold py-2 px-3 sm:py-2.5 sm:px-5 rounded-xl bg-secondary hover:bg-secondary/90 text-primary transition-all shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
                  >
                    Edit Profile
                  </button>
                </div>
                <div className="pt-4 border-t border-accent/10">
                  <p className="text-sm text-accent/60 mb-1">Email</p>
                  <p className="text-sm sm:text-base text-white break-all">{user?.email}</p>
                </div>
              </div>
            </section>

            {/* NGN Account Section (Zainpay SVA - ZainBank) */}
            <section id="phone-ngn" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">NGN Account</h2>
                <p className="text-sm text-accent/60 mt-1">Your NGN account for send and receive (ZainBank)</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                {userProfile?.zainpayAccountNumber ? (
                  <>
                    <div className="pt-4 border-t border-accent/10">
                      <p className="text-sm text-accent/60 mb-1">NGN Account Number</p>
                      <p className="text-sm sm:text-base font-mono text-white">{userProfile.zainpayAccountNumber}</p>
                      <p className="text-xs text-accent/50 mt-1">{userProfile.zainpayBank || "ZainBank"}</p>
                      {userProfile.zainpayAccountName && (
                        <p className="text-xs text-accent/50 mt-0.5">{userProfile.zainpayAccountName}</p>
                      )}
                    </div>
                    <p className="text-xs text-accent/60">
                      Use this account to send and receive NGN. It appears on your Receive and Send pages.
                    </p>
                  </>
                ) : (
                  <div className="space-y-4">
                    <CreateNGNAccountForm
                      onSuccess={() => fetchUserProfile(user.id)}
                      userId={user.id}
                      userEmail={user?.email || ""}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* KYC Section - simple verified / not verified */}
            <section id="kyc" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-accent/10">
                <h2 className="text-xl font-semibold text-white">KYC Status</h2>
                <p className="text-sm text-accent/60 mt-1">Whether you have completed identity verification</p>
              </div>
              <div className="p-6">
                {(() => {
                  const kycDone = !!userProfile?.zainpayAccountNumber;
                  return (
                    <div className={`p-3 sm:p-4 rounded-xl border ${kycDone ? "bg-secondary/10 border-secondary/20" : "bg-primary/40 border-accent/10"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`material-icons-outlined text-xl sm:text-2xl shrink-0 ${kycDone ? "text-secondary" : "text-accent/50"}`}>
                          {kycDone ? "verified_user" : "person_off"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-semibold text-white">
                            {kycDone ? "KYC: Verified" : "KYC: Not verified"}
                          </p>
                          <p className="text-sm text-accent/60 mt-0.5">
                            {kycDone
                              ? "You have completed identity verification."
                              : "Create your NGN account (ZainBank) above with BVN to complete verification."}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </section>

            {/* Security Section - Seed Phrase */}
            <section id="security" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Security</h2>
                <p className="text-sm text-accent/60 mt-1">Seed phrase and wallet recovery</p>
              </div>
              <div className="p-4 sm:p-6">
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
                    className="w-full text-sm sm:text-base font-semibold py-3 px-4 sm:py-4 sm:px-6 rounded-xl bg-secondary hover:bg-secondary/90 text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
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
                    className={`w-full text-sm sm:text-base font-semibold py-3 px-4 sm:py-4 sm:px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)] ${
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
                    className="w-full text-sm sm:text-base font-semibold py-2.5 px-4 sm:py-3 sm:px-6 rounded-xl bg-primary/40 hover:bg-primary/60 border border-accent/10 text-white transition-colors"
                  >
                    Hide Seed Phrase
                  </button>
                </div>
              )}
              </div>
            </section>

            {/* Wallet Addresses Section */}
            <section id="wallets" className="bg-surface/60 backdrop-blur-[24px] rounded-2xl border border-secondary/10 overflow-hidden shadow-xl">
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Wallet Addresses</h2>
                <p className="text-sm text-accent/60 mt-1">Your multi-chain wallet addresses</p>
              </div>
              <div className="p-4 sm:p-6">
              {Object.keys(walletAddresses).length === 0 ? (
                <p className="text-sm text-accent/70">
                  No wallet addresses found. Please set up a passkey to generate addresses.
                </p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {Object.entries(walletAddresses).map(([chainId, address]) => {
                    const chain = SUPPORTED_CHAINS[chainId];
                    return (
                      <div
                        key={chainId}
                        className="p-3 sm:p-4 rounded-xl bg-primary/40 border border-accent/10"
                      >
                        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
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
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Invoice Settings</h2>
                <p className="text-sm text-accent/60 mt-1">Personal or business invoice type</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                {/* Invoice Type Toggle */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-accent/80">
                    Invoice Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInvoiceType("personal")}
                      className={`flex-1 text-sm sm:text-base font-semibold py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl transition-all ${
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
                      className={`flex-1 text-sm sm:text-base font-semibold py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl transition-all ${
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
                  className="w-full text-sm sm:text-base font-semibold py-3 px-4 sm:py-4 sm:px-6 rounded-xl bg-secondary hover:bg-secondary/90 text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(19,236,90,0.2)]"
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
              <div className="p-4 sm:p-6 border-b border-accent/10">
                <h2 className="text-lg sm:text-xl font-semibold text-white">Preferences</h2>
                <p className="text-sm text-accent/60 mt-1">Quick links to receive and send</p>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <button
                  onClick={() => router.push("/receive")}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all text-sm sm:text-base"
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
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl bg-primary/40 border border-accent/10 hover:border-secondary/20 transition-all text-sm sm:text-base"
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


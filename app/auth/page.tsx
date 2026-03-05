"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PoweredBySEND from "@/components/PoweredBySEND";
import { authenticateWithPasskey, isPasskeySupported } from "@/lib/passkey";

type AuthMode = "login" | "signup" | "verify";

// Mock user data for local development (bypass auth for UI work)
const MOCK_USER = {
  id: "mock-user-id",
  email: "",
  name: "Mock User",
  createdAt: new Date().toISOString(),
  hasPasskey: false,
  referralCode: "MOCK1234",
  emailVerified: true,
  totalTransactions: 0,
  totalSpentNGN: 0,
  totalReceivedSEND: "0",
};

const USE_MOCK_AUTH = false;

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState<string | null>(null);
  const [passkeyUser, setPasskeyUser] = useState<any>(null);
  const [authenticatingPasskey, setAuthenticatingPasskey] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // 5-second splash screen on page load
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Load last used email on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastEmail = localStorage.getItem("last_email");
      if (lastEmail && mode === "login") {
        setEmail(lastEmail);
        // Auto-check for passkey if email exists
        checkPasskeyForEmail(lastEmail);
      }
    }
  }, [mode]);

  // Check for passkey when email changes (debounced)
  useEffect(() => {
    if (!email || mode !== "login") return;

    const timeoutId = setTimeout(() => {
      if (email.includes("@")) {
        checkPasskeyForEmail(email);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [email, mode]);

  // Function to check if user has passkey
  const checkPasskeyForEmail = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return;

    setCheckingPasskey(true);

    if (USE_MOCK_AUTH) {
      setHasPasskey(false);
      setPasskeyUserId(null);
      setPasskeyUser(null);
      setCheckingPasskey(false);
      return;
    }

    try {
      const passkeyCheckResponse = await fetch(getApiUrl("/api/auth/passkey-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });

      const passkeyData = await passkeyCheckResponse.json();

      if (passkeyData.success && passkeyData.hasPasskey) {
        setHasPasskey(true);
        setPasskeyUserId(passkeyData.userId);
        setPasskeyUser(passkeyData.user);
      } else {
        setHasPasskey(false);
        setPasskeyUserId(null);
        setPasskeyUser(null);
      }
    } catch (err) {
      // Silently fail - user can still login with email
      setHasPasskey(false);
      setPasskeyUserId(null);
      setPasskeyUser(null);
    } finally {
      setCheckingPasskey(false);
    }
  };

  const handleSendCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    setHasPasskey(false);
    setPasskeyUserId(null);
    setPasskeyUser(null);

    if (USE_MOCK_AUTH) {
      setTimeout(() => {
        if (mode === "login") {
          setMessage("Login successful! Redirecting to passkey setup...");
          const mockUser = { ...MOCK_USER, email };
          localStorage.setItem("user", JSON.stringify(mockUser));
          localStorage.setItem("last_email", email);
          setTimeout(() => router.push("/passkey-setup"), 1500);
        } else {
          setMessage("Confirmation code sent to your email (mock auth)");
          setCodeSent(true);
          setResendCooldown(60);
          setLoading(false);
        }
      }, 800);
      return;
    }

    try {
      if (mode === "login") {
        // First check if user has passkey
        const passkeyCheckResponse = await fetch(getApiUrl("/api/auth/passkey-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const passkeyData = await passkeyCheckResponse.json();

        if (passkeyData.success && passkeyData.hasPasskey) {
          // User has passkey - show passkey option
          setHasPasskey(true);
          setPasskeyUserId(passkeyData.userId);
          setPasskeyUser(passkeyData.user);
          setMessage("Passkey detected! You can sign in with passkey or continue with email.");
          setLoading(false);
          return;
        }

        // User doesn't have passkey - proceed with email login
        const response = await fetch(getApiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "User doesn't exist. Please sign up.");
          return;
        }

        // User exists - store session and redirect to passkey setup
        setMessage("Login successful! Redirecting...");
        localStorage.setItem("user", JSON.stringify(data.user));
        // Store email for next time
        localStorage.setItem("last_email", email);
        setTimeout(() => router.push("/passkey-setup"), 1500);
      } else {
        // For signup: send confirmation code
        const response = await fetch(getApiUrl("/api/auth/send-code"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!data.success) {
          // If user already exists, switch to login mode
          if (data.userExists || data.error?.includes("already exists")) {
            setError("User already exists. Please login.");
            // Switch to login mode after a short delay
            setTimeout(() => {
              setMode("login");
              setError("");
              setMessage("Please login with your email.");
            }, 2000);
          } else {
            setError(data.error || "Failed to send code");
          }
          return;
        }

        setMessage(data.message || "Confirmation code sent to your email");
        setCodeSent(true);
        // Set initial cooldown when code is first sent
        setResendCooldown(60);
      }
    } catch (err: any) {
      setError("Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return; // Prevent spam during cooldown
    
    setError("");
    setMessage("");
    setResending(true);

    if (USE_MOCK_AUTH) {
      setMessage(recoveryMode ? "Recovery code resent (mock)" : "Confirmation code resent (mock)");
      setResendCooldown(60);
      setResending(false);
      return;
    }

    try {
      // Use recovery endpoint if in recovery mode, otherwise use regular send-code
      const endpoint = getApiUrl(recoveryMode ? "/api/auth/recover-passkey" : "/api/auth/send-code");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to resend code");
        return;
      }

      setMessage(recoveryMode ? "Recovery code resent to your email" : "Confirmation code resent to your email");
      
      // Set 60 second cooldown
      setResendCooldown(60);
    } catch (err: any) {
      setError("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleVerifyCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (USE_MOCK_AUTH) {
      setMessage("Account created successfully! Redirecting...");
      const mockUser = { ...MOCK_USER, email };
      localStorage.setItem("user", JSON.stringify(mockUser));
      localStorage.setItem("last_email", email);
      setTimeout(() => router.push("/passkey-setup"), 1500);
      setLoading(false);
      return;
    }

    try {
      // Sign up flow only (login doesn't need code verification)
      // Phone number is required for signup
      if (mode === "signup" && !phoneNumber) {
        setError("Phone number is required");
        setLoading(false);
        return;
      }

      const response = await fetch(getApiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          referralCode: referralCode || undefined,
          phoneNumber: mode === "signup" ? phoneNumber : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to create account");
        return;
      }

      setMessage("Account created successfully! Redirecting...");
      // Store user in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      // Store email for next time
      localStorage.setItem("last_email", email);
      
      // New users must set up passkey before accessing dashboard
      setTimeout(() => router.push("/passkey-setup"), 1500);
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!passkeyUserId || !isPasskeySupported()) {
      setError("Passkey authentication is not available");
      return;
    }

    setAuthenticatingPasskey(true);
    setError("");
    setMessage("");

    if (USE_MOCK_AUTH) {
      setMessage("Passkey authentication successful! Redirecting...");
      const mockUser = { ...MOCK_USER, email: passkeyUser?.email || email };
      localStorage.setItem("user", JSON.stringify(mockUser));
      if (mockUser.email) localStorage.setItem("last_email", mockUser.email);
      setTimeout(() => router.push("/"), 1500);
      setAuthenticatingPasskey(false);
      return;
    }

    try {
      const authResult = await authenticateWithPasskey(passkeyUserId);

      if (!authResult.success) {
        // Check if passkey needs to be recreated (domain mismatch)
        if ((authResult as any).requiresRecreate) {
          setError(
            authResult.error || 
            "Your passkey was created on a different domain. Please recreate it on flippay.app by going to Settings → Security."
          );
          // Optionally redirect to passkey setup
          setTimeout(() => {
            if (confirm("Would you like to recreate your passkey now?")) {
              router.push("/passkey-setup");
            }
          }, 2000);
        } else {
          setError(authResult.error || "Passkey authentication failed");
        }
        return;
      }

      // Authentication successful
      setMessage("Passkey authentication successful! Redirecting...");
      localStorage.setItem("user", JSON.stringify(passkeyUser));
      // Store email for next time
      if (passkeyUser?.email) {
        localStorage.setItem("last_email", passkeyUser.email);
      }
      
      setTimeout(() => router.push("/"), 1500);
    } catch (err: any) {
      console.error("Passkey login error:", err);
      setError(err.message || "Failed to authenticate with passkey");
    } finally {
      setAuthenticatingPasskey(false);
    }
  };

  const handleRecoverPasskey = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (USE_MOCK_AUTH) {
      setMessage("Recovery code sent to your email (mock)");
      setRecoveryCodeSent(true);
      setResendCooldown(60);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/auth/recover-passkey"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to send recovery code");
        return;
      }

      setMessage(data.message || "Recovery code sent to your email");
      setRecoveryCodeSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError("Failed to send recovery code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (USE_MOCK_AUTH) {
      setMessage("Recovery verified! Redirecting to create new passkey...");
      const mockUser = { ...MOCK_USER, email };
      localStorage.setItem("user", JSON.stringify(mockUser));
      localStorage.setItem("last_email", email);
      setTimeout(() => router.push("/passkey-setup?recovery=true"), 1500);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl("/api/auth/recover-passkey"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Invalid recovery code");
        return;
      }

      // Store user and redirect to passkey setup with recovery flag
      setMessage("Recovery verified! Redirecting to create new passkey...");
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("last_email", email);
      
      setTimeout(() => router.push("/passkey-setup?recovery=true"), 1500);
    } catch (err: any) {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // 4-second splash screen with GIF on page load
  if (showSplash) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-[100]"
        style={{ backgroundColor: "#11281A" }}
      >
        <img
          src="/asset/flippay-spinner.gif"
          alt="FlipPay"
          className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
          aria-hidden
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/flippay-logo-white.png";
          }}
        />
      </div>
    );
  }

  // Full-screen spinner when checking passkey on load
  if (mode === "login" && checkingPasskey && email && !recoveryMode) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-[100]"
        style={{ backgroundColor: "#11281A" }}
      >
        <div className="flex flex-col items-center gap-4">
          <img
            src="/asset/flippay-spinner.gif"
            alt="Loading"
            className="w-16 h-16 object-contain"
            aria-hidden
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/flippay-logo-white.png";
            }}
          />
          <p className="text-sm text-accent/80">Checking for passkey...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-start min-h-screen px-4 pt-16 sm:pt-20 pb-8 relative"
      style={{ backgroundColor: "#11281A" }}
    >

      {/* Logo - floating above card (landscape layout) */}
      <div className="mb-4 flex justify-center">
        <img src="/flippay-logo-white.png" alt="FlipPay" className="h-12 sm:h-14 w-auto object-contain mix-blend-lighten" />
      </div>

      {/* Compact landscape card - positioned in upper half */}
      <div className="w-full max-w-md sm:max-w-lg">
        <div className="bg-surface/60 backdrop-blur-[24px] rounded-[2.5rem] border border-secondary/10 shadow-2xl p-5 sm:p-6">
          {/* Header - left-aligned */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-display mb-1">
              {mode === "login" ? "Login" : "Sign Up"}
            </h1>
            <p className="text-sm text-accent/80">
              {mode === "login"
                ? "Enter your email to login"
                : "Sign up with your email and optional referral code"}
            </p>
          </div>

          {/* Error/Message Display */}
          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-red-500/20 border border-red-500/30">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
              <p className="text-sm text-secondary">{message}</p>
            </div>
          )}

          {/* Email Input */}
          {!codeSent && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Email Address
                </label>
                <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 focus-within:bg-primary/60 transition-all">
                  <span className="material-icons-outlined text-accent/40">email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                    disabled={loading || authenticatingPasskey}
                  />
                </div>
              </div>

              {/* Referral Code (only for signup) */}
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                    Referral Code <span className="text-accent/50 normal-case">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 transition-all">
                    <span className="material-icons-outlined text-accent/40">card_giftcard</span>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Enter referral code"
                      className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Passkey Login Button */}
              {mode === "login" && hasPasskey && isPasskeySupported() && !recoveryMode && (
                <button
                  onClick={handlePasskeyLogin}
                  disabled={authenticatingPasskey || checkingPasskey}
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(19,236,90,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authenticatingPasskey ? (
                    <>
                      <img
                        src="/asset/flippay-spinner.gif"
                        alt=""
                        className="h-5 w-5 object-contain shrink-0"
                        aria-hidden
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/flippay-logo-white.png";
                        }}
                      />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined">fingerprint</span>
                      <span>Sign in with Passkey</span>
                    </>
                  )}
                </button>
              )}

              {/* Forgot Passkey Link - only show in login mode when passkey is detected */}
              {mode === "login" && hasPasskey && !recoveryMode && (
                <button
                  onClick={() => {
                    setRecoveryMode(true);
                    setError("");
                    setMessage("");
                    setHasPasskey(false);
                  }}
                  className="w-full text-sm text-accent/70 hover:text-secondary transition-colors underline mt-2"
                >
                  Forgot Passkey? Recover Account
                </button>
              )}

              {/* Show checking indicator when verifying passkey */}
              {mode === "login" && checkingPasskey && email && !recoveryMode && (
                <div className="text-xs text-accent/60 text-center">
                  Checking for passkey...
                </div>
              )}

              {/* Recovery Mode UI */}
              {recoveryMode && !recoveryCodeSent && (
                <div className="mb-4 p-4 rounded-2xl bg-secondary/10 border border-secondary/20">
                  <p className="text-sm text-secondary">
                    Enter your email to receive a recovery code. After verification, you can create a new passkey.
                  </p>
                </div>
              )}

              {recoveryMode && recoveryCodeSent && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                      Recovery Code
                    </label>
                    <div className="p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 transition-all">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full bg-transparent border-none p-0 text-white text-center text-2xl tracking-widest placeholder-white/30 focus:ring-0 outline-none"
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-accent/60 mt-2 text-center">
                      Enter the 6-digit code sent to {email}
                    </p>
                    <div className="mt-3 text-center">
                      <button
                        type="button"
                        onClick={handleRecoverPasskey}
                        disabled={resending || resendCooldown > 0 || loading}
                        className="text-sm text-secondary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity underline"
                      >
                        {resending 
                          ? "Resending..." 
                          : resendCooldown > 0 
                            ? `Resend code in ${resendCooldown}s` 
                            : "Resend Code"}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyRecoveryCode}
                    disabled={loading || code.length !== 6}
                    className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                  >
                    {loading ? "Verifying..." : "Verify & Recover Account"}
                  </button>

                  <button
                    onClick={() => {
                      setRecoveryMode(false);
                      setRecoveryCodeSent(false);
                      setCode("");
                      setError("");
                      setMessage("");
                      setResendCooldown(0);
                    }}
                    className="w-full text-sm text-accent/70 hover:text-secondary transition-colors"
                  >
                    Cancel Recovery
                  </button>
                </div>
              )}

              {/* Divider */}
              {mode === "login" && hasPasskey && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-accent/10"></div>
                  <span className="text-xs text-accent/50">OR</span>
                  <div className="flex-1 border-t border-accent/10"></div>
                </div>
              )}

              {!recoveryMode && !recoveryCodeSent && (
                <button
                  onClick={handleSendCode}
                  disabled={loading || !email || authenticatingPasskey}
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                >
                  {loading 
                    ? "Processing..." 
                    : mode === "login" 
                      ? hasPasskey 
                        ? "Continue with Email"
                        : "Login"
                      : "Send Confirmation Code"}
                </button>
              )}

              {recoveryMode && !recoveryCodeSent && (
                <button
                  onClick={handleRecoverPasskey}
                  disabled={loading || !email}
                  className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
                >
                  {loading ? "Sending..." : "Send Recovery Code"}
                </button>
              )}
            </div>
          )}

          {/* Code Verification */}
          {codeSent && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                  Confirmation Code
                </label>
                <div className="p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 transition-all">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-transparent border-none p-0 text-white text-center text-2xl tracking-widest placeholder-white/30 focus:ring-0 outline-none"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-accent/60 mt-2 text-center">
                  Enter the 6-digit code sent to {email}
                </p>
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending || resendCooldown > 0 || loading}
                    className="text-sm text-secondary hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity underline"
                  >
                    {resending 
                      ? "Resending..." 
                      : resendCooldown > 0 
                        ? `Resend code in ${resendCooldown}s` 
                        : "Resend Code"}
                  </button>
                </div>
              </div>

              {/* Phone Number Input - Only for Signup */}
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-accent/60 mb-2 px-1">
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-3 p-5 rounded-3xl bg-primary/40 border border-accent/10 focus-within:border-secondary/30 transition-all">
                    <span className="material-icons-outlined text-accent/40">phone</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setPhoneNumber(value);
                      }}
                      placeholder="08012345678"
                      maxLength={11}
                      className="flex-1 bg-transparent border-none p-0 text-white placeholder-white/30 focus:ring-0 outline-none"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-accent/60 mt-2">
                    Enter your 11-digit Nigerian phone number (e.g., 08012345678)
                  </p>
                  {phoneNumber && phoneNumber.length < 11 && (
                    <p className="text-xs text-red-400 mt-1">
                      Phone number must be 11 digits
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6 || (mode === "signup" && (!phoneNumber || phoneNumber.length < 11))}
                className="w-full bg-secondary hover:bg-secondary/90 text-primary font-extrabold py-5 rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(19,236,90,0.2)]"
              >
                {loading ? "Verifying..." : mode === "login" ? "Login" : "Sign Up"}
              </button>

              <button
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setPhoneNumber("");
                  setError("");
                  setMessage("");
                  setResendCooldown(0); // Reset cooldown when changing email
                }}
                className="w-full text-sm text-accent/70 hover:text-secondary transition-colors"
              >
                Change Email
              </button>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="mt-4 pt-4 border-t border-accent/10 text-center">
            <p className="text-sm text-accent/80">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setCodeSent(false);
                  setCode("");
                  setEmail("");
                  setReferralCode("");
                  setError("");
                  setMessage("");
                }}
                className="text-secondary font-medium hover:text-white transition-colors"
              >
                {mode === "login" ? "Sign Up" : "Login"}
              </button>
            </p>
          </div>
          
          {/* Powered by SEND */}
          <PoweredBySEND />
        </div>
      </div>
    </div>
  );
}


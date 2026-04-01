/**
 * Passkey (WebAuthn) management library
 * Handles passkey creation, authentication, and recovery
 */

import { getApiUrl } from "@/lib/apiBase";

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  rawId: string;
}

export interface PasskeyChallenge {
  challenge: string;
  userId: string;
}

function getPasskeyRuntimeContext() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "flippay.app";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://flippay.app";
  const noWww = hostname.replace(/^www\./i, "");
  const preferredRpId =
    hostname === "flippay.app" || hostname === "www.flippay.app"
      ? "www.flippay.app"
      : hostname;
  const rpIdCandidates = Array.from(new Set([preferredRpId, hostname, noWww, "www.flippay.app", "flippay.app"])).filter(Boolean);

  return {
    hostname,
    origin,
    normalizedHostname: noWww,
    preferredRpId,
    rpIdCandidates,
    apiChallengeUrl: getApiUrl("/api/passkey/challenge"),
    apiVerifyUrl: getApiUrl("/api/passkey/verify"),
  };
}

/**
 * Generate a random challenge for passkey operations
 */
export function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Convert base64url to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64url
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Create a new passkey for the user
 * This will trigger wallet creation automatically
 */
export async function createPasskey(
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; credential?: PasskeyCredential; error?: string }> {
  try {
    const getRpId = (): string => {
      // Keep passkeys tied to one canonical production host to avoid
      // cross-subdomain mismatches during platform authenticator lookups.
      return getPasskeyRuntimeContext().preferredRpId || "www.flippay.app";
    };

    // Get challenge from server
    const challengeResponse = await fetch(getApiUrl("/api/passkey/challenge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: userEmail }),
    });

    const challengeData = await challengeResponse.json();
    if (!challengeData.success || !challengeData.challenge) {
      return { success: false, error: "Failed to get challenge" };
    }

    const challenge = base64UrlToArrayBuffer(challengeData.challenge);

    // Create credential
    const publicKeyCredential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "SendApp",
          // Normalize to a stable RP ID across `www` and non-`www` hosts.
          id: getRpId(),
        },
        user: {
          id: base64UrlToArrayBuffer(userId),
          name: userEmail,
          displayName: userName || userEmail,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Platform authenticator (device)
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "direct",
      },
    }) as PublicKeyCredential;

    if (!publicKeyCredential) {
      return { success: false, error: "Failed to create passkey" };
    }

    const response = publicKeyCredential.response as AuthenticatorAttestationResponse;
    const credentialId = arrayBufferToBase64Url(publicKeyCredential.rawId);
    const publicKey = arrayBufferToBase64Url(response.getPublicKey()!);

    return {
      success: true,
      credential: {
        id: publicKeyCredential.id,
        publicKey,
        rawId: credentialId,
      },
    };
  } catch (error: any) {
    console.error("Error creating passkey:", error);
    return {
      success: false,
      error: error.message || "Failed to create passkey",
    };
  }
}

/**
 * Authenticate with passkey
 */
export async function authenticateWithPasskey(
  userId: string
): Promise<{ success: boolean; credentialId?: string; error?: string; requiresRecreate?: boolean }> {
  try {
    const runtime = getPasskeyRuntimeContext();
    console.log("[Passkey] Runtime context:", runtime);

    // Get challenge from server
    console.log("[Passkey] Requesting challenge for userId:", userId);
    const challengeResponse = await fetch(getApiUrl("/api/passkey/challenge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!challengeResponse.ok) {
      const errorData = await challengeResponse.json().catch(() => ({}));
      console.error("[Passkey] Challenge API error:", challengeResponse.status, errorData);
      return { 
        success: false, 
        error: errorData.error || `Failed to get challenge (${challengeResponse.status})` 
      };
    }

    const challengeData = await challengeResponse.json();
    if (!challengeData.success || !challengeData.challenge) {
      console.error("[Passkey] Invalid challenge response:", challengeData);
      return { 
        success: false, 
        error: challengeData.error || "Failed to get challenge" 
      };
    }
    
    console.log("[Passkey] Challenge received successfully");

    const challenge = base64UrlToArrayBuffer(challengeData.challenge);

    // Get credential ID from server
    const credentialResponse = await fetch(getApiUrl(`/api/passkey/credential/${userId}`));
    
    if (!credentialResponse.ok) {
      console.error("[Passkey] Credential API error:", credentialResponse.status);
      const errorData = await credentialResponse.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || `Failed to get passkey credential (${credentialResponse.status})` 
      };
    }
    
    const credentialData = await credentialResponse.json();
    if (!credentialData.success || !credentialData.credentialId) {
      console.error("[Passkey] No credential found:", credentialData);
      return { 
        success: false, 
        error: credentialData.error || "No passkey found for user. Please set up a passkey first." 
      };
    }

    const credentialId = base64UrlToArrayBuffer(credentialData.credentialId);

    // Authenticate
    console.log("[Passkey] Requesting authentication from browser...");
    let assertion: PublicKeyCredential;
    
    try {
      const candidates = runtime.rpIdCandidates;
      console.log("[Passkey] RP ID candidates:", candidates);

      assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
            },
          ],
          timeout: 60000,
          userVerification: "preferred", // Changed from "required" to "preferred" for better compatibility
          // Start with the canonical host before trying any legacy fallback RP IDs.
          rpId: candidates[0],
        },
      }) as PublicKeyCredential;

      // If we got here, we succeeded with the first candidate.
    } catch (authError: any) {
      const msg = String(authError?.message || "").toLowerCase();

      // If Google Password Manager is unreachable, don't retry; surface a helpful message.
      if (msg.includes("google password manager") || msg.includes("password manager")) {
        throw authError;
      }

      const isLikelyUserDismissal =
        authError?.name === "NotAllowedError" &&
        (msg.includes("dismiss") || msg.includes("cancel") || msg.includes("rejected"));

      // Retry with an alternate RP ID when the failure looks like an RP/domain mismatch.
      const isLikelyRpMismatch =
        authError?.name === "NotAllowedError" ||
        authError?.name === "SecurityError";

      const shouldRetryRpId =
        !isLikelyUserDismissal &&
        isLikelyRpMismatch &&
        msg &&
        (msg.includes("origin") || msg.includes("rp id") || msg.includes("domain") || msg.includes("rp-id"));

      if (shouldRetryRpId) {
        const candidates2 = runtime.rpIdCandidates;
        console.warn("[Passkey] Retrying with alternate RP IDs after likely mismatch:", {
          errorName: authError?.name,
          errorMessage: authError?.message,
          candidates: candidates2,
          origin: runtime.origin,
        });

        let lastErr: any = authError;
        for (const rpId of candidates2) {
          try {
            console.log("[Passkey] Retrying browser authentication with rpId:", rpId);
            assertion = await navigator.credentials.get({
              publicKey: {
                challenge,
                allowCredentials: [
                  {
                    id: credentialId,
                    type: "public-key",
                  },
                ],
                timeout: 60000,
                userVerification: "preferred",
                rpId,
              },
            }) as PublicKeyCredential;
            lastErr = null;
            break;
          } catch (e: any) {
            lastErr = e;
          }
        }

        if (lastErr) throw lastErr;
        // If we successfully authenticated with an alternate RP ID, continue below
        // so we still verify the assertion with the server.
      }

      // Don't log expected user cancellation errors to console.error
      // These are normal when users dismiss the prompt.
      if (authError.name === "NotAllowedError") {
        console.log("[Passkey] User cancelled or operation not allowed");
        throw authError; // Re-throw to be caught by outer catch with proper handling
      }
      console.error("[Passkey] Browser authentication error:", {
        name: authError?.name,
        message: authError?.message,
        runtime,
      });
      throw authError; // Re-throw to be caught by outer catch
    }

    if (!assertion) {
      return { success: false, error: "Authentication was cancelled" };
    }
    
    console.log("[Passkey] Browser authentication successful, verifying with server...");

    const response = assertion.response as AuthenticatorAssertionResponse;
    const signature = arrayBufferToBase64Url(response.signature);
    const clientDataJSON = arrayBufferToBase64Url(response.clientDataJSON);
    const authenticatorData = arrayBufferToBase64Url(response.authenticatorData);

    // Verify with server
    const verifyResponse = await fetch(getApiUrl("/api/passkey/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        credentialId: arrayBufferToBase64Url(credentialId),
        signature,
        clientDataJSON,
        authenticatorData,
      }),
    });

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.error("[Passkey] Verify API error:", verifyResponse.status, errorData);
      return { 
        success: false, 
        error: errorData.error || `Verification failed (${verifyResponse.status})`,
        requiresRecreate: errorData.requiresRecreate || false,
      };
    }

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      console.error("[Passkey] Verification failed:", verifyData);
      return { 
        success: false, 
        error: verifyData.error || "Verification failed",
        requiresRecreate: verifyData.requiresRecreate || false,
      };
    }
    
    console.log("[Passkey] Verification successful");

    return {
      success: true,
      credentialId: arrayBufferToBase64Url(credentialId),
    };
  } catch (error: any) {
    // Handle specific error types with user-friendly messages
    // Only log unexpected errors to avoid console noise
    
    if (error.name === "NotAllowedError") {
      // This is a common, expected error when user cancels or dismisses the prompt
      // Don't log as error - it's normal user behavior
      console.log("[Passkey] Authentication cancelled or not allowed by user");
      return {
        success: false,
        error: error.message?.includes("Google Password Manager")
          ? "Can't reach Google Password Manager. Check your connection and try again (or use email login)."
          : "Authentication was cancelled. Please try again and complete the passkey prompt when it appears.",
      };
    } else if (error.name === "InvalidStateError") {
      console.warn("[Passkey] InvalidStateError:", error.message);
      return {
        success: false,
        error: "Passkey is not available or has been removed. Please set up a new passkey.",
      };
    } else if (
      typeof error?.message === "string" &&
      error.message.toLowerCase().includes("google password manager")
    ) {
      return {
        success: false,
        error: "Can't reach Google Password Manager. Check your connection and try again (or use email login).",
      };
    } else if (error.name === "NotSupportedError") {
      console.warn("[Passkey] NotSupportedError:", error.message);
      return {
        success: false,
        error: "Passkey authentication is not supported on this device or browser.",
      };
    } else if (error.name === "SecurityError") {
      console.warn("[Passkey] SecurityError:", error.message);
      return {
        success: false,
        error: "Security error. If you created your passkey on localhost, you need to recreate it on the production domain (flippay.app).",
        requiresRecreate: true,
      };
    } else if (error.name === "NotAllowedError" && error.message?.includes("origin")) {
      console.warn("[Passkey] Origin mismatch:", error.message);
      return {
        success: false,
        error: "Domain mismatch. Your passkey was created on a different domain. Please recreate your passkey on flippay.app.",
        requiresRecreate: true,
      };
    } else if (error.name === "AbortError") {
      return {
        success: false,
        error: "Passkey prompt timed out or was aborted. Try again (or use email login).",
      };
    }
    
    // Log unexpected errors
    console.error("[Passkey] Unexpected authentication error:", error);
    console.error("[Passkey] Error name:", error.name);
    console.error("[Passkey] Error message:", error.message);
    console.error("[Passkey] Error runtime context:", getPasskeyRuntimeContext());
    
    return {
      success: false,
      error: error.message || "Failed to authenticate with passkey. Please try again.",
    };
  }
}

/**
 * Check if passkey is supported
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== undefined
  );
}

/**
 * Check if platform authenticator is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}


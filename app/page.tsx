"use client";

import { getApiUrl } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isUserLoggedIn, getUserFromStorage, clearUserSession } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";
import FSpinner from "@/components/FSpinner";

// Flag to enable mock authentication
const USE_MOCK_AUTH = false;

// Lazy load UserDashboard to reduce initial bundle size
const UserDashboard = dynamic(() => import("@/components/UserDashboard"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-background-dark">
      <div className="text-center">
        <FSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-accent">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  // Safely get user from storage with error handling for mobile browsers
  const [user, setUser] = useState(() => {
    try {
      return getUserFromStorage();
    } catch (e) {
      console.warn("Error getting user from storage:", e);
      return null;
    }
  });

  useEffect(() => {
    const verifyUser = async () => {
      try {
        // Check if user is logged in
        if (!isUserLoggedIn()) {
          try {
            router.push("/auth");
          } catch (e) {
            console.error("Error navigating to auth:", e);
            // Fallback navigation
            if (typeof window !== "undefined") {
              window.location.href = "/auth";
            }
          }
          return;
        }

        // Verify session is still valid
        let currentUser;
        try {
          currentUser = getUserFromStorage();
        } catch (e) {
          console.error("Error getting user from storage:", e);
          setIsChecking(false);
          try {
            router.push("/auth");
          } catch (navError) {
            if (typeof window !== "undefined") {
              window.location.href = "/auth";
            }
          }
          return;
        }

        if (!currentUser) {
          try {
            clearUserSession();
          } catch (e) {
            console.warn("Error clearing session:", e);
          }
          try {
            router.push("/auth");
          } catch (e) {
            if (typeof window !== "undefined") {
              window.location.href = "/auth";
            }
          }
          return;
        }

        // CRITICAL: Verify user exists in database
        try {
          // Use mock authentication if enabled
          if (USE_MOCK_AUTH) {
            // Simulate successful user verification for mock users
            // For mock users, we'll assume they exist and need passkey setup initially
            const isMockUser = currentUser && currentUser.id === "mock-user-id";
            
            if (isMockUser) {
              // Mock user - skip backend verification
              // For mock users, we'll check if they have the hasPasskey property set to true
              // If not present or false, they need passkey setup
              if (!currentUser.hasPasskey) {
                // User doesn't have passkey - redirect to setup
                try {
                  router.push("/passkey-setup");
                } catch (e) {
                  if (typeof window !== "undefined") {
                    window.location.href = "/passkey-setup";
                  }
                }
                return;
              }
              
              // User exists and has passkey - allow access
              setUser(currentUser);
              setIsChecking(false);
              return;
            }
          }
          
          const response = await fetch(getApiUrl("/api/auth/verify-user"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: currentUser.email }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (!data.success || !data.exists) {
            // User doesn't exist in database - log them out immediately
            console.log(`[Auth] User ${currentUser.email} not found in database. Logging out...`);
            try {
              clearUserSession();
            } catch (e) {
              console.warn("Error clearing session:", e);
            }
            try {
              router.push("/auth");
            } catch (e) {
              if (typeof window !== "undefined") {
                window.location.href = "/auth";
              }
            }
            return;
          }

          // Check if user has passkey - redirect to setup if not
          try {
            const passkeyResponse = await fetch(getApiUrl(`/api/user/check-passkey?userId=${currentUser.id}`));
            
            if (passkeyResponse.ok) {
              const passkeyData = await passkeyResponse.json();

              if (passkeyData.success && passkeyData.needsPasskeySetup) {
                // User doesn't have passkey - redirect to setup
                try {
                  router.push("/passkey-setup");
                } catch (e) {
                  if (typeof window !== "undefined") {
                    window.location.href = "/passkey-setup";
                  }
                }
                return;
              }
            }
          } catch (error) {
            console.error("Error checking passkey:", error);
            // Continue to dashboard if check fails - don't block user
          }

          // User exists in database and has passkey - allow access
          setUser(currentUser);
          setIsChecking(false);
        } catch (error) {
          console.error("Error verifying user in database:", error);
          // On error, log out for security
          try {
            clearUserSession();
          } catch (e) {
            console.warn("Error clearing session:", e);
          }
          try {
            router.push("/auth");
          } catch (e) {
            if (typeof window !== "undefined") {
              window.location.href = "/auth";
            }
          }
        }
      } catch (outerError) {
        // Catch any unexpected errors (e.g., router.push failures, localStorage errors)
        console.error("Error in verifyUser:", outerError);
        setIsChecking(false);
        // Don't throw - let ErrorBoundary handle it if needed
      }
    };

    // Add a small delay to ensure window is available on mobile
    if (typeof window !== "undefined") {
      verifyUser();
    } else {
      // Wait for window to be available
      const timer = setTimeout(() => {
        verifyUser();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <FSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <UserDashboard />
    </DashboardLayout>
  );
}


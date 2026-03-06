"use client";

import { getApiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isUserLoggedIn, getUserFromStorage, clearUserSession, setUserSession } from "@/lib/session";

const USE_MOCK_AUTH = false;
// Bypass auth for user dashboard only – UI/UX work (revert before push, added 2025-03-06)
const BYPASS_AUTH_FOR_USER_DASHBOARD = false;
import DashboardLayout from "@/components/DashboardLayout";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";

// Lazy load UserDashboard to reduce initial bundle size
const UserDashboard = dynamic(() => import("@/components/UserDashboard"), {
  loading: () => <PageLoadingSpinner message="Loading..." bgClass="bg-background-dark" />,
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
          // Bypass auth for user dashboard only (local dev – UI/UX work; admin stays protected)
          if (BYPASS_AUTH_FOR_USER_DASHBOARD) {
            const mockUser = {
              id: "mock-dashboard-user",
              email: "test@flippay.local",
              referralCode: "MOCK1234",
              emailVerified: true,
              createdAt: new Date().toISOString(),
              totalTransactions: 0,
              totalSpentNGN: 0,
              totalReceivedSEND: "0",
            };
            setUserSession(mockUser as any, "mock-session-token");
            setUser(mockUser as any);
            setIsChecking(false);
            return;
          }
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

        // Skip backend verification when using mock auth (local dev)
        if (USE_MOCK_AUTH) {
          setUser(currentUser);
          setIsChecking(false);
          return;
        }

        // Skip backend verification when bypassing auth for user dashboard (local dev)
        if (BYPASS_AUTH_FOR_USER_DASHBOARD && currentUser.id === "mock-dashboard-user") {
          setUser(currentUser);
          setIsChecking(false);
          return;
        }

        // CRITICAL: Verify user exists in database
        try {
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
    return <PageLoadingSpinner message="Loading..." bgClass="bg-primary" />;
  }

  return (
    <DashboardLayout>
      <UserDashboard />
    </DashboardLayout>
  );
}


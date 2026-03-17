"use client";

import { getApiUrl } from "@/lib/apiBase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isUserLoggedIn, getUserFromStorage, clearUserSession } from "@/lib/session";
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
        if (!isUserLoggedIn()) {
          router.push("/auth");
          return;
        }

        let currentUser;
        try {
          currentUser = getUserFromStorage();
        } catch (e) {
          console.error("Error getting user from storage:", e);
          router.push("/auth");
          return;
        }

        if (!currentUser) {
          try { clearUserSession(); } catch {}
          router.push("/auth");
          return;
        }

        // Run both checks in parallel — saves one full network round-trip on every load
        try {
          const [verifyRes, passkeyRes] = await Promise.all([
            fetch(getApiUrl("/api/auth/verify-user"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: currentUser.email }),
            }),
            fetch(getApiUrl(`/api/user/check-passkey?userId=${currentUser.id}`)),
          ]);

          // Handle verify-user response
          if (!verifyRes.ok) {
            const errBody = await verifyRes.json().catch(() => ({}));
            console.error("[Auth] verify-user failed:", verifyRes.status, errBody);
            try { clearUserSession(); } catch {}
            router.push("/auth");
            return;
          }

          const verifyData = await verifyRes.json();
          if (!verifyData.success || !verifyData.exists) {
            try { clearUserSession(); } catch {}
            router.push("/auth");
            return;
          }

          // Handle passkey check response
          try {
            if (passkeyRes.ok) {
              const passkeyData = await passkeyRes.json();
              if (passkeyData.success && passkeyData.needsPasskeySetup) {
                router.push("/passkey-setup");
                return;
              }
            }
          } catch {
            // Non-fatal: continue to dashboard if passkey check fails
          }

          setUser(currentUser);
          setIsChecking(false);
        } catch (error) {
          console.error("Error verifying user:", error);
          try { clearUserSession(); } catch {}
          router.push("/auth");
        }
      } catch (outerError) {
        console.error("Error in verifyUser:", outerError);
        setIsChecking(false);
      }
    };

    if (typeof window !== "undefined") {
      verifyUser();
    } else {
      const timer = setTimeout(() => { verifyUser(); }, 100);
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


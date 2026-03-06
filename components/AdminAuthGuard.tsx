"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "./WalletConnect";
import { useRouter } from "next/navigation";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import { USE_MOCK_ADMIN_AUTH } from "@/lib/admin-permissions";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [address, isConnected]);


  const checkAuth = async () => {
    setIsChecking(true);

    if (USE_MOCK_ADMIN_AUTH) {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    // Check localStorage for session
    const session = localStorage.getItem("admin_session");
    if (session) {
      try {
        const sessionData = JSON.parse(session);
        const walletAddress = sessionData.address;
        
        // Check if session is still valid (24 hours)
        const sessionAge = Date.now() - sessionData.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        // If wallet is connected, verify it matches session
        if (isConnected && address) {
          if (sessionAge < maxAge && walletAddress === address.toLowerCase()) {
            setIsAuthenticated(true);
            setIsChecking(false);
            return;
          } else if (sessionAge >= maxAge) {
            // Session expired
            localStorage.removeItem("admin_session");
            localStorage.removeItem("admin_wallet");
          } else if (walletAddress !== address.toLowerCase()) {
            // Wallet changed
            localStorage.removeItem("admin_session");
            localStorage.removeItem("admin_wallet");
          }
        } else if (sessionAge < maxAge) {
          // Session valid but wallet not connected yet - allow access if wallet connects
          // This handles the case where session exists but wallet needs to reconnect
          setIsAuthenticated(false);
          setIsChecking(false);
          return;
        }
      } catch (error) {
        console.error("Error parsing session:", error);
        localStorage.removeItem("admin_session");
        localStorage.removeItem("admin_wallet");
      }
    }

    setIsChecking(false);
  };

  const handleAuthSuccess = (walletAddress: string) => {
    // Immediately set authenticated state after successful verification
    // The session is already stored by WalletConnect component
    setIsAuthenticated(true);
    setIsChecking(false);
  };

  if (isChecking) {
    return <PageLoadingSpinner message="Checking authentication..." bgClass="bg-surface" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface p-8">
        <div className="w-full max-w-md bg-primary p-8 rounded-xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center text-primary font-bold shadow-[0_0_15px_rgba(19,236,90,0.6)]">
              <span className="material-icons-outlined text-xl font-bold">token</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Admin Access Required
            </h1>
          </div>
          <WalletConnect onAuthSuccess={handleAuthSuccess} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


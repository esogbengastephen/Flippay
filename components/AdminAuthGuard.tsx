"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      <div className="flex items-center justify-center min-h-screen bg-surface p-4 sm:p-6 md:p-8 min-h-dvh">
        <div className="w-full max-w-md bg-primary p-4 sm:p-6 md:p-8 rounded-xl border border-secondary/20 shadow-lg shadow-secondary/5 overflow-hidden">
          <div className="flex flex-col items-center text-center gap-1 mb-4 sm:mb-6">
            <div className="relative w-[120px] h-[120px] sm:w-[168px] sm:h-[168px] flex-shrink-0 flex items-center justify-center bg-transparent">
              <Image
                src="/admin-logo.png"
                alt="FlipPay"
                width={168}
                height={168}
                className="object-contain w-full h-full bg-transparent"
                unoptimized
                priority
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight whitespace-nowrap">
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


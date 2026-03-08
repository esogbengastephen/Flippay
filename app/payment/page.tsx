"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import PaymentHub from "@/components/PaymentHub";
import { isUserLoggedIn } from "@/lib/session";
import PageLoadingSpinner from "@/components/PageLoadingSpinner";
import DashboardLayout from "@/components/DashboardLayout";

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowParam = searchParams.get("flow");
  const network = (searchParams.get("network") || "send").toLowerCase();
  const validNetwork = network === "base" || network === "solana" ? network : "send";

  const [view, setView] = useState<"hub" | "buy">(
    flowParam === "buy" ? "buy" : "hub"
  );

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  useEffect(() => {
    if (flowParam === "buy") setView("buy");
  }, [flowParam]);

  const handleSelectBuy = () => setView("buy");
  const handleSelectWithdraw = () => router.push("/offramp");
  const handleBack = () => router.push("/");

  return (
    <DashboardLayout>
      <div className="min-h-screen min-h-[100dvh] bg-background-dark flex flex-col items-center justify-start overflow-x-hidden pt-0 pb-24 lg:pb-24 relative">
        {/* Background blur orbs */}
        <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-secondary rounded-full blur-[150px] opacity-[0.07]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary rounded-full blur-[150px] opacity-20"></div>
        </div>
        <div className={`w-full mx-auto flex flex-col flex-1 ${view === "hub" ? "max-w-4xl" : "max-w-lg"}`}>
          {view === "hub" ? (
            <PaymentHub onSelectBuy={handleSelectBuy} onSelectWithdraw={handleSelectWithdraw} />
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleBack}
                className="hidden lg:flex items-center gap-2 text-accent/80 hover:text-white transition-colors"
              >
                <span className="material-icons-outlined text-lg">arrow_back</span>
                <span className="text-sm font-medium">Back</span>
              </button>
              <PaymentForm network={validNetwork} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <PageLoadingSpinner message="Loading..." bgClass="bg-background-dark" />
    }>
      <PaymentPageContent />
    </Suspense>
  );
}

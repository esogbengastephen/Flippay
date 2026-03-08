"use client";

import { useRouter } from "next/navigation";
import PoweredBySEND from "@/components/PoweredBySEND";

interface PaymentHubProps {
  onSelectBuy: () => void;
  onSelectWithdraw: () => void;
}

const SERVICES = [
  { id: "invoice", icon: "receipt_long", label: "Generate Invoice", desc: "Create crypto-ready invoices for clients.", route: "/invoice" },
  { id: "data", icon: "wifi", label: "Buy Data", desc: "Purchase mobile data bundles.", route: "/buy-data" },
  { id: "airtime", icon: "phone_iphone", label: "Buy Airtime", desc: "Top up airtime for any network.", route: "/buy-airtime" },
  { id: "electricity", icon: "bolt", label: "Electricity", desc: "Pay electricity bills.", route: "/buy-electricity" },
  { id: "tv", icon: "tv", label: "TV Sub", desc: "Subscribe to TV packages.", route: "/tv-sub" },
  { id: "betting", icon: "sports_soccer", label: "Pay Betting", desc: "Fund betting accounts.", route: "/pay-betting" },
  { id: "giftcard", icon: "card_giftcard", label: "Gift Card Redeem", desc: "Redeem gift cards.", route: "/gift-card-redeem" },
];

export default function PaymentHub({ onSelectBuy, onSelectWithdraw }: PaymentHubProps) {
  const router = useRouter();
  const handleServiceClick = (route: string) => router.push(route);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Hero header - HTML 3 style */}
      <div className="bg-surface/60 backdrop-blur-[24px] relative pb-10 pt-8 px-4 sm:px-6 border-b border-secondary/10">
        <div className="absolute inset-0 header-pattern opacity-10 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            Bill Payments
          </h1>
          <p className="text-accent/80 text-base sm:text-lg font-light max-w-2xl">
            Convert & pay in one place. Manage crypto and utility payments securely.
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-8 sm:py-10 space-y-10 -mt-6 relative z-10">
        {/* Payments Section */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-secondary rounded-full shadow-[0_0_10px_rgba(19,236,90,0.6)]" />
            Payments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={onSelectBuy}
              className="service-card p-6 rounded-xl group cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-secondary group-hover:text-background-dark transition-all duration-300">
                <span className="material-icons-outlined text-2xl">swap_vert</span>
              </div>
              <h3 className="font-bold text-white mb-1">Buy Crypto</h3>
              <p className="text-xs text-accent/70">Convert NGN to SEND, USDC or USDT instantly.</p>
            </button>
            <button
              onClick={onSelectWithdraw}
              className="service-card p-6 rounded-xl group cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-secondary group-hover:text-background-dark transition-all duration-300">
                <span className="material-icons-outlined text-2xl">account_balance</span>
              </div>
              <h3 className="font-bold text-white mb-1">Withdraw to Bank</h3>
              <p className="text-xs text-accent/70">Convert crypto to NGN and send to your bank.</p>
            </button>
          </div>
        </section>

        {/* Services Section - HTML 3 style: circular icons, centered, compact */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-secondary rounded-full shadow-[0_0_10px_rgba(19,236,90,0.6)]" />
            Select Service Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {SERVICES.map((svc) => {
              const canClick = true;
              return (
                <button
                  key={svc.id}
                  onClick={() => canClick && handleServiceClick(svc.route)}
                  disabled={!canClick}
                  className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl bg-surface/60 backdrop-blur-[24px] p-6 border border-secondary/10 transition-all duration-200 ${
                    !canClick
                      ? "opacity-70 cursor-not-allowed"
                      : "cursor-pointer hover:shadow-[0_0_20px_rgba(19,236,90,0.15)] hover:-translate-y-1 hover:border-secondary/30"
                  }`}
                >
                  <div className="h-14 w-14 rounded-full bg-primary/40 flex items-center justify-center border border-accent/10 group-hover:bg-secondary group-hover:text-primary group-hover:shadow-[0_0_15px_rgba(19,236,90,0.5)] transition-all">
                    <span className="material-icons-outlined text-3xl text-white group-hover:text-primary">{svc.icon}</span>
                  </div>
                  <span className="font-medium text-accent/80 group-hover:text-white text-sm text-center transition-colors line-clamp-2">
                    {svc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <PoweredBySEND />
      </div>
    </div>
  );
}

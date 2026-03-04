"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const MORE_MENU_ITEMS = [
  { href: "/invoice", icon: "receipt_long", label: "Invoices" },
  { href: "/banners", icon: "campaign", label: "Banners" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("home");
  const [isAnimating, setIsAnimating] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Determine active tab based on current pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("home");
    } else if (pathname === "/payment" || pathname.startsWith("/payment")) {
      setActiveTab("payment");
    } else if (pathname === "/send" || pathname.startsWith("/send")) {
      setActiveTab("upload");
    } else if (pathname === "/receive" || pathname.startsWith("/receive")) {
      setActiveTab("upload");
    } else if (pathname === "/history" || pathname.startsWith("/history")) {
      setActiveTab("history");
    } else if (pathname === "/invoice" || pathname.startsWith("/invoice")) {
      setActiveTab("www");
    } else if (pathname === "/banners" || pathname.startsWith("/banners")) {
      setActiveTab("www");
    } else if (pathname === "/settings" || pathname.startsWith("/settings")) {
      setActiveTab("www");
    } else if (pathname === "/profile" || pathname.startsWith("/profile")) {
      setActiveTab("www");
    } else {
      setActiveTab("home");
    }
  }, [pathname]);

  const handleNavigation = (tab: string, route: string) => {
    setIsAnimating(true);
    setActiveTab(tab);
    router.push(route);
  };

  const handleMoreItemClick = (href: string) => {
    setShowMoreMenu(false);
    setActiveTab("www");
    router.push(href);
  };

  const inactiveClass = "text-accent/70";
  const transitionClass = "transition-all duration-motion-base ease-standard";

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 px-4 pb-4">
      <div className="max-w-md mx-auto">
        <div className="relative bg-primary/90 backdrop-blur-md rounded-xl h-20 shadow-lg overflow-visible border border-white/5 card-hover">
          {/* Active tab pill */}
          <div
            className={`absolute top-1/2 w-14 h-14 bg-secondary rounded-full ${transitionClass} flex flex-col items-center justify-center pointer-events-none ${
              isAnimating ? "animate-popIn" : ""
            }`}
            style={{
              left: `calc(${
                (showMoreMenu ? "www" : activeTab) === "home" ? "8%" :
                (showMoreMenu ? "www" : activeTab) === "history" ? "25%" :
                (showMoreMenu ? "www" : activeTab) === "payment" ? "42%" :
                (showMoreMenu ? "www" : activeTab) === "upload" ? "58%" :
                (showMoreMenu ? "www" : activeTab) === "support" ? "75%" : "92%"
              } - 1.75rem)`,
              transform: "translateY(-50%)",
              zIndex: 20,
              boxShadow: "0 0 10px rgba(19, 236, 90, 0.4)",
            }}
            onAnimationEnd={() => setIsAnimating(false)}
          >
            <span className="material-icons-round text-2xl text-primary font-bold relative z-10">
              {(showMoreMenu ? "www" : activeTab) === "home" ? "home" :
               (showMoreMenu ? "www" : activeTab) === "history" ? "history" :
               (showMoreMenu ? "www" : activeTab) === "payment" ? "payments" :
               (showMoreMenu ? "www" : activeTab) === "upload" ? "arrow_upward" :
               (showMoreMenu ? "www" : activeTab) === "support" ? "headset_mic" : "language"}
            </span>
            <span className="text-[8px] font-bold text-primary relative z-10 mt-0.5 uppercase tracking-tight">
              {(showMoreMenu ? "www" : activeTab) === "home" ? "Home" :
               (showMoreMenu ? "www" : activeTab) === "history" ? "History" :
               (showMoreMenu ? "www" : activeTab) === "payment" ? "Payment" :
               (showMoreMenu ? "www" : activeTab) === "upload" ? "Send" :
               (showMoreMenu ? "www" : activeTab) === "support" ? "Support" : "More"}
            </span>
          </div>

          <div className="relative flex justify-around items-center h-full px-2 pt-1">
            <button
              onClick={() => handleNavigation("home", "/")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Home"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${activeTab === "home" ? "opacity-0" : inactiveClass}`}>
                home
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "home" ? "opacity-0" : inactiveClass}`}>
                Home
              </span>
            </button>

            <button
              onClick={() => handleNavigation("history", "/history")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="History"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${activeTab === "history" ? "opacity-0" : inactiveClass}`}>
                history
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "history" ? "opacity-0" : inactiveClass}`}>
                History
              </span>
            </button>

            <button
              onClick={() => handleNavigation("payment", "/payment")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Payment"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${activeTab === "payment" ? "opacity-0" : inactiveClass}`}>
                payments
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "payment" ? "opacity-0" : inactiveClass}`}>
                Payment
              </span>
            </button>

            <button
              onClick={() => handleNavigation("upload", "/send")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Send"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${activeTab === "upload" ? "opacity-0" : inactiveClass}`}>
                arrow_upward
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "upload" ? "opacity-0" : inactiveClass}`}>
                Send
              </span>
            </button>

            <a
              href="https://t.me/Flippayofficial"
              target="_blank"
              rel="noopener noreferrer"
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Support"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${activeTab === "support" ? "opacity-0" : inactiveClass}`}>
                headset_mic
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "support" ? "opacity-0" : inactiveClass}`}>
                Support
              </span>
            </a>

            <button
              onClick={() => setShowMoreMenu(true)}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="More"
            >
              <span className={`material-icons-round text-xl ${transitionClass} ${(showMoreMenu || activeTab === "www") ? "opacity-0" : inactiveClass}`}>
                language
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${(showMoreMenu || activeTab === "www") ? "opacity-0" : inactiveClass}`}>
                More
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* More Menu - Bottom Sheet */}
      {showMoreMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            onClick={() => setShowMoreMenu(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] lg:hidden bg-surface border-t border-white/10 rounded-t-2xl shadow-2xl animate-slide-up">
            <div className="p-4 pb-8">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-4 px-2">More</h3>
              <div className="space-y-1">
                {MORE_MENU_ITEMS.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleMoreItemClick(item.href)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-accent hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <span className="material-icons-round text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUserFromStorage } from "@/lib/session";

const navItems = [
  { href: "/", icon: "account_balance_wallet", label: "Wallet" },
  { href: "/payment", icon: "payments", label: "Payments" },
  { href: "/invoice", icon: "receipt_long", label: "Invoices" },
  { href: "/history", icon: "history", label: "History" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

function NavLink({
  href,
  icon,
  label,
  isActive,
}: {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm ${
        isActive
          ? "bg-secondary/20 text-secondary border border-secondary/30"
          : "text-accent/80 hover:bg-white/10 hover:text-accent"
      }`}
    >
      <span className="material-icons-round text-[20px]">{icon}</span>
      {label}
    </button>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("User");

  useEffect(() => {
    try {
      const user = getUserFromStorage();
      const u = user as { displayName?: string; display_name?: string; email?: string };
      const name = u?.displayName || u?.display_name || u?.email?.split("@")[0] || "User";
      setDisplayName(name);
    } catch {
      setDisplayName("User");
    }
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex w-52 bg-primary flex-shrink-0 flex-col p-4 border-r border-white/5">
      {/* Logo */}
      <Link href="/" className="flex items-center justify-start w-full mb-6 shrink-0">
        <div className="relative w-20 h-20">
          <Image
            src="/flippay-logo-white.png"
            alt="FlipPay"
            fill
            sizes="80px"
            className="object-contain mix-blend-lighten"
          />
        </div>
      </Link>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>

      {/* User Account Card - clickable to settings */}
      <Link
        href="/settings"
        className="bg-surface-highlight/50 p-3 rounded-xl flex items-center gap-2 border border-white/5 hover:bg-surface-highlight/70 hover:border-accent/20 transition-colors block"
      >
          <div className="w-7 h-7 bg-secondary rounded-full border-2 border-accent/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="text-xs font-semibold truncate text-accent min-w-0">{displayName}</div>
      </Link>
    </aside>
  );
}

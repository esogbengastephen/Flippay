"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUserFromStorage, clearUserSession, USER_STORAGE_UPDATED_EVENT } from "@/lib/session";
import UserAvatar from "@/components/UserAvatar";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "./ui/basic-dropdown";
import { UserCircle, Settings, LogOut } from "lucide-react";

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
  const router = useRouter();
  const [displayName, setDisplayName] = useState("User");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    function syncFromStorage() {
      try {
        const user = getUserFromStorage();
        const u = user as {
          displayName?: string;
          display_name?: string;
          email?: string;
          photoUrl?: string;
        };
        setDisplayName(u?.displayName || u?.display_name || u?.email?.split("@")[0] || "User");
        setPhotoUrl(u?.photoUrl ?? null);
      } catch {
        setDisplayName("User");
        setPhotoUrl(null);
      }
    }
    syncFromStorage();
    window.addEventListener(USER_STORAGE_UPDATED_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(USER_STORAGE_UPDATED_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [pathname]);

  const handleLogout = () => {
    if (confirm("Are you sure you want to sign out?")) {
      clearUserSession();
      router.push("/auth");
    }
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden h-full min-h-0 w-52 flex-shrink-0 flex-col border-r border-white/5 bg-primary p-4 lg:flex">
      {/* Logo */}
      <Link href="/" className="mb-6 flex w-full shrink-0 items-center justify-start">
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

      {/* Main Nav — scrolls only if items overflow; keeps user block pinned to bottom of viewport */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
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

      {/* User Account - dropdown with Profile, Settings, Sign out */}
      <div className="mt-3 shrink-0">
      <Dropdown>
        <DropdownTrigger className="w-full bg-surface-highlight/50 p-3 rounded-xl flex items-center gap-2 border border-white/5 hover:bg-surface-highlight/70 hover:border-accent/20 transition-colors">
          <UserAvatar
            photoUrl={photoUrl}
            displayName={displayName}
            size={28}
            className="h-7 w-7"
          />
          <div className="text-xs font-semibold truncate text-accent min-w-0">{displayName}</div>
        </DropdownTrigger>
        <DropdownContent align="start" side="left" placement="top" className="w-56">
          <DropdownItem onClick={() => router.push("/profile")} className="gap-2">
            <UserCircle className="h-4 w-4 text-secondary" />
            Profile
          </DropdownItem>
          <DropdownItem onClick={() => router.push("/settings")} className="gap-2">
            <Settings className="h-4 w-4 text-secondary" />
            Settings
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onClick={handleLogout} destructive className="gap-2">
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
      </div>
    </aside>
  );
}

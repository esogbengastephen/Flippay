"use client";

import { getApiUrl } from "@/lib/apiBase";
import Image from "next/image";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";
import AdminAuthGuard from "@/components/AdminAuthGuard";
import FSpinner from "@/components/FSpinner";
import WagmiProvider from "@/components/WagmiProvider";
import PoweredBySEND from "@/components/PoweredBySEND";
import ThemeToggle from "@/components/ThemeToggle";
import { useAccount, useDisconnect } from "wagmi";
import {
  ADMIN_NAV_ITEMS,
  ADMIN_NAV_SECTIONS,
  canAccessRoute,
  filterNavByPermission,
  getAdminPageTitle,
  USE_MOCK_ADMIN_AUTH,
  type AdminNavSection,
} from "@/lib/admin-permissions";

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<"super_admin" | "admin" | undefined>(undefined);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    if (USE_MOCK_ADMIN_AUTH) {
      setRole("super_admin");
      setPermissions([]);
      setLoadingMe(false);
      return;
    }
    if (!address) {
      setRole(undefined);
      setPermissions([]);
      setLoadingMe(false);
      return;
    }
    let cancelled = false;
    setLoadingMe(true);
    fetch(getApiUrl("/api/admin/me"), {
      headers: { Authorization: `Bearer ${address}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setRole(data.role ?? "admin");
          setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        } else {
          setRole("admin");
          setPermissions([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRole("admin");
          setPermissions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const allowedNavItems = filterNavByPermission(ADMIN_NAV_ITEMS, role, permissions);
  const canAccessCurrentPage = canAccessRoute(pathname ?? "", role, permissions);

  const itemsBySection = allowedNavItems.reduce<Record<AdminNavSection, typeof allowedNavItems>>(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    },
    { operations: [], management: [], tokenomics: [], system: [] }
  );

  const sectionOrder: AdminNavSection[] = ["operations", "management", "tokenomics", "system"];

  return (
    <div className="min-h-screen bg-surface flex overflow-hidden text-white">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary p-2 rounded-lg border border-accent/10"
        aria-label="Toggle menu"
      >
        <span className="material-icons-outlined text-white">
          {sidebarOpen ? "close" : "menu"}
        </span>
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Flippay branding */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-background-dark flex-shrink-0 border-r border-accent/10 flex flex-col z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-20 flex items-center px-6 border-b border-accent/10">
          <Link href="/admin" className="flex items-center" onClick={() => setSidebarOpen(false)}>
            <div className="relative w-12 h-12 flex-shrink-0">
              <Image
                src="/flippay-logo-white.png"
                alt="FlipPay"
                fill
                sizes="48px"
                className="object-contain mix-blend-lighten"
              />
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {loadingMe ? (
            <div className="flex items-center gap-2 py-3 text-accent/60 text-sm">
              <FSpinner size="xs" />
              <span>Loading...</span>
            </div>
          ) : (
            sectionOrder.map((sectionKey) => {
              const items = itemsBySection[sectionKey];
              if (!items.length) return null;
              const sectionLabel = ADMIN_NAV_SECTIONS[sectionKey];
              return (
                <div key={sectionKey}>
                  <p className="px-3 pt-4 pb-2 text-xs font-semibold text-accent/50 uppercase tracking-wider">
                    {sectionLabel}
                  </p>
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all group ${
                        pathname === item.href
                          ? "bg-secondary/10 text-secondary border border-secondary/20 shadow-[0_0_10px_rgba(19,236,90,0.1)]"
                          : "text-accent/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span className="material-icons-outlined text-[20px] text-white">
                        {item.icon}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              );
            })
          )}

          <div className="mt-4 pt-4 border-t border-accent/10">
            <ThemeToggle />
          </div>

          <Link
            href="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-accent/70 hover:text-white hover:bg-white/5 transition-colors mt-2"
          >
            <span className="material-icons-outlined text-[20px] text-white">arrow_back</span>
            <span className="text-sm font-medium">Back to App</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-accent/10 flex-shrink-0">
          {address ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary border border-accent/20 flex items-center justify-center text-white text-xs font-mono">
                {address.slice(2, 6)}
              </div>
              <div className="text-sm min-w-0">
                <p className="font-bold text-white truncate">{role === "super_admin" ? "Super Admin" : "Admin"}</p>
                <p className="text-xs text-secondary truncate">{address.slice(0, 10)}...</p>
              </div>
              <button
                onClick={() => {
                  disconnect();
                  localStorage.removeItem("admin_session");
                  localStorage.removeItem("admin_wallet");
                  window.location.href = "/admin";
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="bg-primary/40 rounded-lg p-3 border border-accent/10">
              <p className="text-xs font-medium text-accent/60 mb-1">Deposit Account</p>
              <p className="text-xs font-semibold text-white break-words">{DEPOSIT_ACCOUNT.name}</p>
              <p className="text-xs text-accent/60 mt-1">
                {DEPOSIT_ACCOUNT.accountNumber} • {DEPOSIT_ACCOUNT.bank}
              </p>
            </div>
          )}
          <div className="mt-3">
            <PoweredBySEND />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-16 lg:pt-0 lg:ml-64">
        {!loadingMe && pathname && !canAccessCurrentPage ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <span className="material-icons-outlined text-6xl text-white mb-4">lock</span>
            <h2 className="text-xl font-bold text-white mb-2">Access denied</h2>
            <p className="text-accent/70 mb-4 max-w-md">
              You don&apos;t have permission to view this page. Contact a super admin to request access.
            </p>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-lg bg-secondary text-primary font-medium hover:bg-secondary/90"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            {/* Sticky Top Bar - page title (h-20 matches sidebar header for aligned divider) */}
            <header className="sticky top-0 z-20 flex-shrink-0 h-20 flex items-center bg-surface/95 backdrop-blur-md border-b border-accent/10 px-6 lg:px-8">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {pathname ? getAdminPageTitle(pathname) : "Admin"}
              </h1>
            </header>
            {/* Content */}
            <div className="flex-1 pt-4 px-6 lg:px-8 pb-6 lg:pb-8">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider>
      <AdminAuthGuard>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </AdminAuthGuard>
    </WagmiProvider>
  );
}

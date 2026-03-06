"use client";

import Sidebar from "./Sidebar";
import BottomNavigation from "./BottomNavigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Wraps main app content with:
 * - Sidebar (desktop only, lg+)
 * - BottomNavigation (mobile only, hidden on lg+)
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen overflow-hidden bg-background-dark">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative flex flex-col min-h-screen pb-24 lg:pb-0">
        {children}
      </main>
      {/* Mobile bottom nav - hidden on desktop (lg+) */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}

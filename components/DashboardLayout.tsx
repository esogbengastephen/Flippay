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
    <div className="flex min-h-screen overflow-hidden bg-background-dark lg:h-screen lg:max-h-screen lg:min-h-0">
      <Sidebar />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-24 relative lg:min-h-0 lg:pb-0">
        {children}
      </main>
      {/* Mobile bottom nav - hidden on desktop (lg+) */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useMemo } from "react";
import { isViewOnlyAdmin } from "@/lib/admin-permissions";

type AdminViewOnlyContextValue = { isViewOnly: boolean };

const AdminViewOnlyContext = createContext<AdminViewOnlyContextValue>({ isViewOnly: false });

export function AdminViewOnlyProvider({
  children,
  permissions,
  role,
}: {
  children: React.ReactNode;
  permissions: string[];
  role: "super_admin" | "admin" | undefined;
}) {
  const isViewOnly = useMemo(() => {
    if (role === "super_admin") return false;
    return isViewOnlyAdmin(permissions);
  }, [role, permissions]);

  const value = useMemo(() => ({ isViewOnly }), [isViewOnly]);

  return (
    <AdminViewOnlyContext.Provider value={value}>
      {children}
    </AdminViewOnlyContext.Provider>
  );
}

export function useAdminViewOnly(): boolean {
  const { isViewOnly } = useContext(AdminViewOnlyContext);
  return isViewOnly;
}

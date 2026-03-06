"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";

export default function BuyElectricityPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <DashboardLayout>
      <UtilityForm
        serviceId="electricity"
        serviceName="Buy Electricity"
        icon="bolt"
        networks={["EKEDC", "IKEDC", "AEDC", "PHED", "KEDCO", "EEDC", "IBEDC", "KAEDCO", "JED", "YEDC"]}
        placeholder="Enter meter number"
      />
    </DashboardLayout>
  );
}

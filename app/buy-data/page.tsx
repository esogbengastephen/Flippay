"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";

export default function BuyDataPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <DashboardLayout>
      <UtilityForm
        serviceId="data"
        serviceName="Buy Data"
        icon="data_usage"
        networks={["MTN", "Airtel", "Glo", "9mobile"]}
        placeholder="Enter phone number"
        showPackageDropdown={true}
        allowMultipleNumbers={false}
      />
    </DashboardLayout>
  );
}


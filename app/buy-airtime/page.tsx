"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import DashboardLayout from "@/components/DashboardLayout";

export default function BuyAirtimePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <DashboardLayout>
      <UtilityForm
        serviceId="airtime"
        serviceName="Buy Airtime"
        icon="phone_android"
        networks={["MTN", "Airtel", "Glo", "9mobile"]}
        placeholder="Enter phone number"
        allowMultipleNumbers={true}
      />
    </DashboardLayout>
  );
}


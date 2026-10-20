"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { getBatteryByVehicle } from "@/services/batteries";
import { getVehicle } from "@/services/vehicles";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function VehicleBatteryIndexPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();

  useEffect(() => {
    Promise.all([getVehicle(vehicleId), getBatteryByVehicle(vehicleId)]).then(([vehicle, battery]) => {
      if (vehicle && battery) router.replace(`/vehicles/${vehicleId}/battery/${battery.id}`);
    });
  }, [router, vehicleId]);

  return (
    <div>
      <PageHeader
        title="Battery"
        crumbs={[
          { href: "/vehicles", label: "Vehicles" },
          { href: `/vehicles/${vehicleId}`, label: vehicleId },
          { label: "Battery" },
        ]}
      />
      <QueryGate loading error={null} empty={<EmptyState title="Battery not found" />} isEmpty={false}>
        <LoadingState label="Opening pack" />
      </QueryGate>
    </div>
  );
}

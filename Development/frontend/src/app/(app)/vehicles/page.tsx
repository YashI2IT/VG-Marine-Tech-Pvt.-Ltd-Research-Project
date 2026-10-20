"use client";

import { VehicleTable } from "@/components/fleet/VehicleTable";
import { Card } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listVehicles } from "@/services/vehicles";
import { useMemo, useState } from "react";

export default function VehiclesPage() {
  const { data, loading, error, reload } = useAsyncData(() => listVehicles(), []);
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => (data ?? []).filter((v) => `${v.id} ${v.name} ${v.location}`.toLowerCase().includes(q.toLowerCase())),
    [data, q]
  );

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Inventory of monitored vehicles and pack thermal status."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Vehicles" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && rows.length === 0} empty={<EmptyState title="No vehicles found" />}>
        <Card>
          <div className="mb-4">
            <SearchInput aria-label="Search vehicles" placeholder="Search vehicles" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <VehicleTable rows={rows} />
        </Card>
      </QueryGate>
    </div>
  );
}

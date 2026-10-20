"use client";

import { VehicleTable } from "@/components/fleet/VehicleTable";
import { Card } from "@/components/ui/Card";
import { DateInput, SearchInput, Select } from "@/components/ui/Form";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getFleetVehicles } from "@/services/fleet";
import { Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

export default function FleetPage() {
  const { data, loading, error, reload } = useAsyncData(() => getFleetVehicles(), []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    return (data ?? []).filter((v) => {
      const matchesQ = `${v.id} ${v.name} ${v.batteryId}`.toLowerCase().includes(q.toLowerCase());
      const matchesS = status === "all" || v.status === status;
      return matchesQ && matchesS;
    });
  }, [data, q, status]);

  const kpis = {
    healthy: data?.filter((v) => v.status === "healthy").length ?? 0,
    warning: data?.filter((v) => v.status === "warning" || v.status === "watch").length ?? 0,
    critical: data?.filter((v) => v.status === "critical").length ?? 0,
    anomalies: data?.filter((v) => v.thermalRisk === "critical" || v.thermalRisk === "warning").length ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="Fleet thermal condition"
        description="Rank vehicles by thermal risk and jump into vehicle detail."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Fleet" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && (data?.length ?? 0) === 0} empty={<EmptyState title="No vehicles in this tenant" />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Healthy" value={kpis.healthy} icon={Activity} tone="mint" />
          <KpiCard label="Watch / warning" value={kpis.warning} icon={AlertTriangle} tone="amber" />
          <KpiCard label="Critical" value={kpis.critical} icon={ShieldAlert} tone="rose" />
          <KpiCard label="Thermal anomalies" value={kpis.anomalies} />
        </div>
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <SearchInput aria-label="Search fleet" placeholder="Search vehicle, name, battery" value={q} onChange={(e) => setQ(e.target.value)} />
            <DateInput aria-label="As of time" />
            <Select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="watch">Watch</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
          <VehicleTable rows={rows} />
        </Card>
      </QueryGate>
    </div>
  );
}

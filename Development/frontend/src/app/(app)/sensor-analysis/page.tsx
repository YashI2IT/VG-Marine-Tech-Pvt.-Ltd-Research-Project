"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { ResidualChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/Button";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber } from "@/lib/format";
import { getSensorHealth } from "@/services/sensors";
import { Activity } from "lucide-react";
import Link from "next/link";

export default function SensorAnalysisPage() {
  const { data, loading, error, reload } = useAsyncData(() => getSensorHealth(), []);
  const faulty = data?.filter((s) => s.status === "faulty" || s.faultType !== "none") ?? [];

  return (
    <div>
      <PageHeader
        title="Sensor analysis"
        description="Physical vs virtual comparison foundation. Fault models are not implemented."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Sensor analysis" }]}
        actions={
          <Link href="/sensor-analysis/placement">
            <Button>Placement study</Button>
          </Link>
        }
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No sensor faults detected" />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <KpiCard label="Sensors in sample" value={data?.length ?? 0} icon={Activity} />
          <KpiCard label="Suspicious" value={faulty.length} tone="rose" />
          <KpiCard label="Healthy" value={(data?.length ?? 0) - faulty.length} tone="mint" />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionHeader title="Residual snapshot" />
            <ResidualChart
              data={(data ?? []).map((s) => ({ label: s.id, value: s.residual }))}
            />
          </Card>
          <Card>
            <SectionHeader title="Coverage" />
            <p className="text-sm text-slate-500">Demo pack uses sparse physical sensors plus virtual estimates. Placement optimization is UI-only.</p>
            <div className="mt-4 rounded-full bg-[#eff6ff] px-4 py-3 text-sm">Open the placement page for reduction study metrics.</div>
          </Card>
        </div>
        <Card className="mt-5">
          <SectionHeader title="Sensor list" />
          <DataTable
            rows={data ?? []}
            empty="No sensor faults detected"
            columns={[
              { key: "id", header: "Sensor", render: (r) => r.id, sortValue: (r) => r.id },
              { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
              { key: "l", header: "Location", render: (r) => r.location },
              { key: "p", header: "Physical", render: (r) => `${formatNumber(r.physicalValue)}°C` },
              { key: "vt", header: "Virtual", render: (r) => `${formatNumber(r.virtualValue)}°C` },
              { key: "r", header: "Residual", render: (r) => `${formatNumber(r.residual)}°C`, sortValue: (r) => r.residual },
              { key: "f", header: "Fault", render: (r) => r.faultType },
              { key: "s", header: "Status", render: (r) => <StatusBadge label={r.status} tone={r.status} /> },
            ]}
          />
        </Card>
      </QueryGate>
    </div>
  );
}

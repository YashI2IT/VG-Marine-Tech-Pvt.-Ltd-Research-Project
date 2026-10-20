"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatTime } from "@/lib/format";
import { listSensors } from "@/services/thermal";

export default function SensorHealthPage() {
  const { data, loading, error, reload } = useAsyncData(() => listSensors(), []);
  const selected = data?.[0];

  return (
    <div>
      <PageHeader
        title="Sensor health"
        description="Physical versus virtual comparison. Fault classification is mock."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Sensors" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No sensor faults detected" />}>
        {data && selected ? (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Residual trend (demo)" />
                <TrendChart data={[-2, -4, -8, -12, selected.residual].map((v, i) => ({ label: `${i}`, value: v }))} unit="°C" />
              </Card>
              <Card>
                <SectionHeader title="Selected sensor" />
                <p className="font-semibold">{selected.id}</p>
                <p className="text-sm text-slate-500">{selected.location}</p>
                <p className="mt-3 text-sm">Physical {selected.physicalValue}°C · virtual {selected.virtualValue}°C · residual {selected.residual}°C</p>
                <div className="mt-2"><StatusBadge label={selected.faultType} tone={selected.status} /></div>
              </Card>
            </div>
            <Card>
              <DataTable
                rows={data}
                columns={[
                  { key: "id", header: "Sensor", render: (r) => r.id, sortValue: (r) => r.id },
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "loc", header: "Location", render: (r) => r.location },
                  { key: "p", header: "Physical", render: (r) => `${r.physicalValue}°C` },
                  { key: "vt", header: "Virtual", render: (r) => `${r.virtualValue}°C` },
                  { key: "r", header: "Residual", render: (r) => `${r.residual}°C`, sortValue: (r) => r.residual },
                  { key: "f", header: "Fault", render: (r) => r.faultType },
                  { key: "c", header: "Confidence", render: (r) => `${Math.round(r.confidence * 100)}%` },
                  { key: "u", header: "Updated", render: (r) => formatTime(r.lastUpdate) },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

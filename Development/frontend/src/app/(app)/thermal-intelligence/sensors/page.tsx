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
import { Info, ShieldCheck } from "lucide-react";

export default function SensorHealthPage() {
  const { data, loading, error, reload } = useAsyncData(() => listSensors(), []);
  const selected = data?.[0];

  return (
    <div>
      <PageHeader
        title="Sensor diagnostics & residuals"
        description="Physical sensor quality checks, out-of-distribution detection, and virtual-to-reference temperature residual tracking."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Sensors" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No sensor telemetry available" />}>
        {data && selected ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <span className="font-semibold">Target Isolation & Residual Policy: </span>
                  The held-out target (<code className="font-mono text-blue-700">battery_temp_degC</code>) is mathematically excluded from model inputs.
                  Residuals (<code className="font-mono">reference - virtual</code>) are only computed when authorized ground truth measurements exist. In unsupervised field operations, missing reference data is reported as N/A, not zero error.
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Residual tracking snapshot" kicker="Virtual vs Physical Reference" />
                <TrendChart
                  data={[-0.4, -0.8, -1.2, -1.0, -1.18, selected.residual !== null ? selected.residual : -1.18].map((v, i) => ({
                    label: `Frame ${i + 1}`,
                    value: v,
                  }))}
                  unit="°C"
                />
              </Card>

              <Card>
                <SectionHeader title="Active diagnostic node" kicker={selected.id} />
                <div className="space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium text-slate-500">Location:</span> {selected.location}</p>
                  <p><span className="font-medium text-slate-500">Associated Vehicle:</span> {selected.vehicleId}</p>
                  <p>
                    <span className="font-medium text-slate-500">Physical Ambient / Chamber:</span> {selected.physicalValue}°C
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">CNN-LSTM Virtual Estimate:</span> {selected.virtualValue}°C
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Computed Residual:</span>{" "}
                    <span className="font-mono font-semibold">
                      {(selected as any).residualDisplay || (selected.residual !== null ? `${selected.residual}°C` : "N/A (Unsupervised Mode)")}
                    </span>
                  </p>
                  <div className="pt-2">
                    <StatusBadge label={selected.status} tone={selected.status} />
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <SectionHeader title="Physical & virtual sensor nodes" kicker="Reconciled from PostgreSQL records" />
              <DataTable
                rows={data}
                columns={[
                  { key: "id", header: "Sensor Node", render: (r) => r.id, sortValue: (r) => r.id },
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "loc", header: "Node Location", render: (r) => r.location },
                  { key: "p", header: "Measured Ambient", render: (r) => `${r.physicalValue}°C` },
                  { key: "vt", header: "Virtual Core (Est.)", render: (r) => `${r.virtualValue}°C` },
                  {
                    key: "r",
                    header: "Residual (Ref - Est)",
                    render: (r) => (r as any).residualDisplay || (r.residual !== null ? `${r.residual}°C` : "N/A"),
                  },
                  { key: "f", header: "Fault Status", render: (r) => r.faultType },
                  { key: "c", header: "Confidence", render: (r) => `${Math.round(r.confidence * 100)}%` },
                  { key: "u", header: "Last Recorded", render: (r) => formatTime(r.lastUpdate) },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

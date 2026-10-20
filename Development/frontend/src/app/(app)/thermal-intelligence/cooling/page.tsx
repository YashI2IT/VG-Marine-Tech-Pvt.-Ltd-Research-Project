"use client";

import { DualBarChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listCooling } from "@/services/thermal";
import { Drawer } from "@/components/ui/Overlay";
import { useState } from "react";
import type { CoolingHealth } from "@/types/domain";

export default function CoolingPage() {
  const { data, loading, error, reload } = useAsyncData(() => listCooling(), []);
  const [open, setOpen] = useState<CoolingHealth | null>(null);

  return (
    <div>
      <PageHeader
        title="Cooling health"
        description="Expected versus observed thermal response. Diagnostics are mock — cooling AI is not implemented."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Cooling" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No cooling diagnostics" />}>
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Status" value={data[0].status} />
              <KpiCard label="Effectiveness" value={`${Math.round(data[0].effectiveness * 100)}%`} />
              <KpiCard label="Confidence" value={`${Math.round(data[0].confidence * 100)}%`} />
            </div>
            <Card>
              <SectionHeader title="Expected vs observed (°C/min)" />
              <DualBarChart
                data={data.map((c) => ({
                  label: c.vehicleId,
                  expected: Math.abs(c.expectedResponse),
                  observed: Math.abs(c.observedResponse),
                }))}
              />
            </Card>
            <Card>
              <DataTable
                rows={data.map((c) => ({ ...c, id: c.vehicleId }))}
                onRowClick={(row) => setOpen(row)}
                columns={[
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "s", header: "Status", render: (r) => <StatusBadge label={r.status} tone={r.status} /> },
                  { key: "in", header: "Coolant in", render: (r) => `${r.coolantInletC}°C` },
                  { key: "out", header: "Coolant out", render: (r) => `${r.coolantOutletC}°C` },
                  { key: "i", header: "Issue", render: (r) => r.issues[0] ?? "—" },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>
      <Drawer open={!!open} title={open?.vehicleId ?? "Cooling"} onClose={() => setOpen(null)}>
        {open ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Related events: {open.relatedEventIds.join(", ") || "None"}</p>
            <p>These values are simulated for UI review.</p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

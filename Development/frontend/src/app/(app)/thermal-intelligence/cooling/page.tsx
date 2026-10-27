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
import { Fan, Info, ShieldAlert } from "lucide-react";

export default function CoolingPage() {
  const { data, loading, error, reload } = useAsyncData(() => listCooling(), []);
  const [open, setOpen] = useState<CoolingHealth | null>(null);

  const primary = data?.[0];

  return (
    <div>
      <PageHeader
        title="Cooling diagnostics"
        description="Thermal rejection efficiency and rate-of-decay analysis derived from available telemetry."
        crumbs={[{ href: "/thermal-intelligence", label: "Thermal intelligence" }, { label: "Cooling" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No cooling diagnostics available" />}>
        {data && primary ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Fleet cooling condition" value={primary.status} tone={primary.status === "healthy" ? "mint" : primary.status === "watch" ? "amber" : "rose"} />
              <KpiCard label="Thermal rejection efficiency" value={`${Math.round(primary.effectiveness * 100)}%`} hint="Observed vs nominal recovery" />
              <KpiCard label="Diagnostic confidence" value={`${Math.round(primary.confidence * 100)}%`} hint="Advisory confidence score" />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <p className="font-semibold">Telemetry Instrumentation & Diagnostic Scope:</p>
                  <p>
                    Thermal rejection rates (dT/dt) are calculated from battery temperature recovery during current-relaxation periods.
                    Physical coolant fluid sensors (flow in LPM, pump RPM, loop thermistors) are absent from the single-cell Panasonic NCR18650PF dataset.
                  </p>
                  <p className="text-amber-700">
                    <span className="font-medium">Advisory Safety Constraint: </span>
                    TrustSense-BMS is strictly advisory and does not control cooling pumps, fans, or contactors.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <SectionHeader
                title="Expected vs observed thermal dissipation rate"
                kicker="Negative °C/min (magnitude of cooling drop during rest)"
              />
              <DualBarChart
                data={data.map((c) => ({
                  label: c.vehicleId,
                  expected: Math.abs(c.expectedResponse),
                  observed: Math.abs(c.observedResponse),
                }))}
              />
            </Card>

            <Card>
              <SectionHeader title="Vehicle cooling assessments" kicker="Reconciled from PostgreSQL records" />
              <DataTable
                rows={data.map((c) => ({ ...c, id: c.vehicleId }))}
                onRowClick={(row) => setOpen(row)}
                columns={[
                  { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
                  { key: "s", header: "Condition", render: (r) => <StatusBadge label={r.status} tone={r.status} /> },
                  { key: "eff", header: "Rejection Efficiency", render: (r) => `${Math.round(r.effectiveness * 100)}%` },
                  { key: "obs", header: "Observed dT/dt", render: (r) => `${r.observedResponse}°C/min` },
                  { key: "exp", header: "Nominal Target", render: (r) => `${r.expectedResponse}°C/min` },
                  { key: "i", header: "Advisory Diagnostic", render: (r) => r.issues[0] ?? "Nominal heat rejection" },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </QueryGate>

      <Drawer open={!!open} title={open ? `Cooling Detail — ${open.vehicleId}` : "Cooling Detail"} onClose={() => setOpen(null)}>
        {open ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Diagnostic Findings:</p>
              <ul className="mt-1 list-inside list-disc text-slate-600">
                {open.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <p className="font-medium text-slate-700">Instrumentation Notice:</p>
              <p className="mt-0.5">Physical coolant loop flow rate and fluid pressure remain unmeasured on single-cell test stands. Advisory derate recommendations are computed from observed thermal rise under load.</p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

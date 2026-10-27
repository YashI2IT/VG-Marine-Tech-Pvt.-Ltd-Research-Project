"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { DemoBanner } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getSensorPlacement } from "@/services/sensors";
import { Layers, Info, CheckCircle2, AlertCircle } from "lucide-react";

export default function SensorPlacementPage() {
  const { data, loading, error, reload } = useAsyncData(() => getSensorPlacement(), []);

  return (
    <div>
      <PageHeader
        title="Sensor placement & reduction architecture"
        description="Next-generation pack sensor-reduction specifications. Research proposal and target topological design."
        crumbs={[
          { href: "/sensor-analysis", label: "Sensor analysis" },
          { label: "Placement" },
        ]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="space-y-1">
                  <p className="font-semibold">Research Study Status — Planned Architecture:</p>
                  <p>
                    The present CNN-LSTM model is experimentally trained and validated on single-cell Panasonic NCR18650PF drive cycle datasets (UDDS/US06/HWFET).
                    Full spatial sensor reduction from 96 thermistors down to 24 across an entire multi-module EV pack represents a target design proposal and requires a dedicated multi-cell hardware test bench for experimental ablation verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Baseline sensor count" value={data.currentSensors} icon={Layers} hint="Conventional 96-channel pack" />
              <KpiCard label="Target reduced count" value={data.proposedSensors} tone="mint" hint="Target topological placement" />
              <KpiCard label="Target reduction" value={`${data.reductionPct}%`} hint="BMS wiring & harness reduction" />
              <KpiCard label="Target RMSE" value={`≤ ${data.reconstructionRmseC}°C`} tone="amber" hint="Design error budget" />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Target hotspot coverage" kicker="Design Specification" />
                <p className="text-4xl font-semibold">{Math.round(data.hotspotCoverage * 100)}%</p>
                <p className="mt-2 text-sm text-slate-500">
                  Target coverage probability of localized thermal hotspots using 24 physical sensors augmented by 72 virtual sensor estimations.
                </p>
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">Model Foundation: </span>
                  Single-cell Virtual Temperature Sensor achieves MAE 1.54°C and R² 0.9736 on Panasonic NCR18650PF test data.
                </div>
              </Card>

              <Card>
                <SectionHeader title="Requirements for physical validation" kicker="Hardware Road-map" />
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Multi-cell physical pack bench (minimum 16 to 96 cells in series-parallel).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Synchronous 96-channel thermistor data acquisition hardware (CAN DAQ).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Non-uniform boundary cooling test chamber to induce spatial thermal gradients.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>Single-cell virtual sensor inference pipeline (Validated in repository).</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

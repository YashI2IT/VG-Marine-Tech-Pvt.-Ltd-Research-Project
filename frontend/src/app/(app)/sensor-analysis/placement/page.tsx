"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { DemoBanner } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getSensorPlacement } from "@/services/sensors";
import { Layers } from "lucide-react";

export default function SensorPlacementPage() {
  const { data, loading, error, reload } = useAsyncData(() => getSensorPlacement(), []);

  return (
    <div>
      <PageHeader
        title="Sensor placement"
        description="Next-generation pack sensor-reduction study. Reconstruction error is a demo placeholder, not a trained model result."
        crumbs={[
          { href: "/sensor-analysis", label: "Sensor analysis" },
          { label: "Placement" },
        ]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Current sensors" value={data.currentSensors} icon={Layers} />
              <KpiCard label="Proposed" value={data.proposedSensors} tone="mint" />
              <KpiCard label="Reduction" value={`${data.reductionPct}%`} />
              <KpiCard label="RMSE (demo)" value={`${data.reconstructionRmseC}°C`} tone="amber" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Hotspot coverage" />
                <p className="text-4xl font-semibold">{Math.round(data.hotspotCoverage * 100)}%</p>
                <p className="mt-2 text-sm text-slate-500">Coverage of known demo hotspots under the reduced layout.</p>
              </Card>
              <Card>
                <SectionHeader title="Fault isolation" />
                <p className="text-sm text-slate-600">{data.faultIsolation}</p>
                <p className="mt-3 text-xs text-slate-400">Ablation engine is not implemented. These figures are UI contracts only.</p>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

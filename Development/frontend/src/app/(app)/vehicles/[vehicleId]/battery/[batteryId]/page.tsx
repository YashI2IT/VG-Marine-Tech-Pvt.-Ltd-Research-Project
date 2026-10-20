"use client";

import { Heatmap } from "@/components/heatmap/Heatmap";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber } from "@/lib/format";
import { getBattery } from "@/services/batteries";
import type { Cell } from "@/types/domain";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function BatteryDetailPage() {
  const { vehicleId, batteryId } = useParams<{ vehicleId: string; batteryId: string }>();
  const { data, loading, error, reload } = useAsyncData(() => getBattery(batteryId), [batteryId]);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [mode, setMode] = useState("virtual");

  const module = data?.modules.find((m) => m.id === (moduleId ?? data.modules[0]?.id));

  return (
    <div>
      <PageHeader
        title={`Battery ${batteryId}`}
        description="Vehicle → battery → module → cell foundation. Values are demo."
        crumbs={[
          { href: "/vehicles", label: "Vehicles" },
          { href: `/vehicles/${vehicleId}`, label: vehicleId },
          { label: batteryId },
        ]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data} empty={<EmptyState title="Battery not found" />}>
        {data && module ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <KpiCard label="Tmax" value={`${formatNumber(data.metrics.tmax)}°C`} />
              <KpiCard label="Tmin" value={`${formatNumber(data.metrics.tmin)}°C`} />
              <KpiCard label="ΔT" value={`${formatNumber(data.metrics.deltaT)}°C`} />
              <KpiCard label="Cooling loop" value={data.coolingLoop} />
            </div>
            <div className="flex flex-wrap gap-2">
              {data.modules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModuleId(m.id);
                    setSelected(null);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${m.id === module.id ? "bg-[#2563eb] text-white" : "bg-white text-slate-600"}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <Tabs
              tabs={[
                { id: "virtual", label: "Virtual temperature" },
                { id: "physical", label: "Physical temperature" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title={module.name} />
                <Heatmap
                  cells={module.cells}
                  rows={module.rows}
                  cols={module.cols}
                  mode={mode === "physical" ? "physical" : "virtual"}
                  selectedId={selected?.id}
                  onSelect={setSelected}
                />
              </Card>
              <Card>
                <SectionHeader title="Cell detail" />
                {selected ? (
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">{selected.id}</p>
                    <p>Physical {formatNumber(selected.physicalTemp)}°C</p>
                    <p>Virtual {formatNumber(selected.virtualTemp)}°C</p>
                    <StatusBadge label={selected.status} tone={selected.status} />
                    {selected.isHotspot ? <p className="text-rose-600">Demo hotspot flag</p> : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select a cell on the heatmap.</p>
                )}
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

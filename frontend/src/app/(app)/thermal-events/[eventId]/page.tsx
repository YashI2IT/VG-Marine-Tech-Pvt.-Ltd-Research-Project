"use client";

import { TrendChart } from "@/components/charts/Charts";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { RecommendationCard } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatNumber, formatTime } from "@/lib/format";
import { getEvent } from "@/services/events";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, loading, error, reload } = useAsyncData(() => getEvent(eventId), [eventId]);

  return (
    <div>
      <PageHeader
        title={data ? `${data.type} · ${data.id}` : "Event"}
        crumbs={[
          { href: "/thermal-events", label: "Thermal events" },
          { label: eventId },
        ]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data} empty={<EmptyState title="Event not found" />}>
        {data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={data.severity} tone={data.severity} />
              <StatusBadge label={data.status} tone={data.status === "open" ? "warning" : "info"} />
            </div>
            <p className="text-sm text-slate-600">{data.summary}</p>
            <div className="grid gap-4 sm:grid-cols-4">
              <KpiCard label="Tmax" value={`${formatNumber(data.metrics.tmax)}°C`} />
              <KpiCard label="ΔT" value={`${formatNumber(data.metrics.deltaT)}°C`} />
              <KpiCard label="dT/dt" value={`${formatNumber(data.metrics.dTdt)}`} />
              <KpiCard label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Where / when" />
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>Vehicle <Link className="text-blue-600" href={`/vehicles/${data.vehicleId}`}>{data.vehicleId}</Link></li>
                  <li>Battery {data.batteryId}</li>
                  <li>Module {data.moduleId} · cell {data.cellId}</li>
                  <li>{formatTime(data.timestamp)}</li>
                  {data.sensorId ? <li>Related sensor {data.sensorId}</li> : null}
                  {data.coolingNote ? <li>{data.coolingNote}</li> : null}
                </ul>
              </Card>
              <Card>
                <SectionHeader title="Thermal trend" />
                <TrendChart data={data.trend.map((v, i) => ({ label: `${i}`, value: v }))} />
              </Card>
            </div>
            <RecommendationCard title="Next action" body={data.recommendation} />
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

"use client";

import { Card, SectionHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { RecommendationCard } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getMaintenanceItem } from "@/services/maintenance";
import { getVehicle } from "@/services/vehicles";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function MaintenanceDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { data, loading, error, reload } = useAsyncData(async () => {
    const [item, vehicle] = await Promise.all([getMaintenanceItem(vehicleId), getVehicle(vehicleId)]);
    return { item, vehicle };
  }, [vehicleId]);

  return (
    <div>
      <PageHeader
        title={`Maintenance · ${vehicleId}`}
        description="Operational next steps based on demo thermal evidence."
        crumbs={[
          { href: "/maintenance", label: "Maintenance" },
          { label: vehicleId },
        ]}
        actions={
          <Link href={`/vehicles/${vehicleId}`}>
            <Button variant="secondary">Open vehicle</Button>
          </Link>
        }
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.item} empty={<EmptyState title="No maintenance item" body="This vehicle has no open thermal work order in the demo set." />}>
        {data?.item ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionHeader title="Work order" />
              <div className="space-y-3 text-sm">
                <p className="flex items-center gap-2 font-semibold">{data.item.vehicleId} {data.vehicle ? `· ${data.vehicle.name}` : null}</p>
                <StatusBadge label={data.item.severity} tone={data.item.severity} />
                <p><span className="text-slate-400">Priority:</span> {data.item.priority}</p>
                <p><span className="text-slate-400">Status:</span> {data.item.status}</p>
                <p><span className="text-slate-400">Reason:</span> {data.item.reason}</p>
                <p><span className="text-slate-400">Thermal issue:</span> {data.item.thermalIssue}</p>
              </div>
            </Card>
            <div className="space-y-4">
              <RecommendationCard title="Recommended action" body={data.item.recommendation} />
              <Card>
                <SectionHeader title="Evidence" kicker="Demo" />
                <p className="text-sm text-slate-600">{data.item.evidence}</p>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

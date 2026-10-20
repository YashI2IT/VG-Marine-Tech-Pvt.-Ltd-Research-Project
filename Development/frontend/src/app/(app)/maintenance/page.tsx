"use client";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { SearchInput, Select } from "@/components/ui/Form";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listMaintenance } from "@/services/maintenance";
import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function MaintenancePage() {
  const { data, loading, error, reload } = useAsyncData(() => listMaintenance(), []);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("all");
  const router = useRouter();
  const rows = useMemo(
    () =>
      (data ?? []).filter((m) => {
        const mq = `${m.vehicleId} ${m.reason} ${m.thermalIssue}`.toLowerCase().includes(q.toLowerCase());
        const mp = priority === "all" || m.priority === priority;
        return mq && mp;
      }),
    [data, q, priority]
  );

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Prioritize vehicles that need thermal-related service. Recommendations are advisory."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Maintenance" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No maintenance items" body="No thermal-related work orders in the demo set." />}>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <KpiCard label="Open items" value={data?.filter((m) => m.status === "open").length ?? 0} icon={Wrench} />
          <KpiCard label="Urgent" value={data?.filter((m) => m.priority === "urgent").length ?? 0} tone="rose" />
          <KpiCard label="Scheduled" value={data?.filter((m) => m.status === "scheduled").length ?? 0} tone="mint" />
        </div>
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <SearchInput aria-label="Search maintenance" placeholder="Search vehicle or issue" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>
          <DataTable
            rows={rows}
            empty="No maintenance items match filters"
            onRowClick={(r) => router.push(`/maintenance/${r.vehicleId}`)}
            columns={[
              { key: "v", header: "Vehicle", render: (r) => r.vehicleId, sortValue: (r) => r.vehicleId },
              { key: "p", header: "Priority", render: (r) => r.priority, sortValue: (r) => r.priority },
              { key: "r", header: "Reason", render: (r) => r.reason },
              { key: "t", header: "Thermal issue", render: (r) => r.thermalIssue },
              { key: "s", header: "Severity", render: (r) => <StatusBadge label={r.severity} tone={r.severity} /> },
              { key: "st", header: "Status", render: (r) => r.status },
            ]}
          />
        </Card>
      </QueryGate>
    </div>
  );
}

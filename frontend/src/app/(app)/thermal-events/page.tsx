"use client";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { SearchInput, Select } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatTime } from "@/lib/format";
import { listEvents } from "@/services/events";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function EventsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listEvents(), []);
  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const router = useRouter();
  const rows = useMemo(
    () => (data ?? []).filter((e) => {
      const mq = `${e.id} ${e.vehicleId} ${e.type}`.toLowerCase().includes(q.toLowerCase());
      const ms = sev === "all" || e.severity === sev;
      return mq && ms;
    }),
    [data, q, sev]
  );

  return (
    <div>
      <PageHeader
        title="Thermal events"
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Thermal events" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No thermal events" />}>
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <SearchInput aria-label="Search events" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}>
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="watch">Watch</option>
            </Select>
          </div>
          <DataTable
            rows={rows}
            empty="No thermal events match filters"
            onRowClick={(r) => router.push(`/thermal-events/${r.id}`)}
            columns={[
              { key: "t", header: "Time", render: (r) => formatTime(r.timestamp), sortValue: (r) => r.timestamp },
              { key: "v", header: "Vehicle", render: (r) => r.vehicleId },
              { key: "b", header: "Battery", render: (r) => r.batteryId },
              { key: "c", header: "Cell", render: (r) => r.cellId },
              { key: "ty", header: "Type", render: (r) => r.type },
              { key: "s", header: "Severity", render: (r) => <StatusBadge label={r.severity} tone={r.severity} /> },
              { key: "st", header: "Status", render: (r) => r.status },
              { key: "cf", header: "Confidence", render: (r) => `${Math.round(r.confidence * 100)}%` },
            ]}
          />
        </Card>
      </QueryGate>
    </div>
  );
}

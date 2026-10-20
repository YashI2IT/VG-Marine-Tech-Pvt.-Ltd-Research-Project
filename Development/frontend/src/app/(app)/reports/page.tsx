"use client";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { SearchInput } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatTime } from "@/lib/format";
import { listReports } from "@/services/reports";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReportStatus } from "@/types/domain";

function tone(status: ReportStatus) {
  if (status === "ready") return "healthy" as const;
  if (status === "generating") return "watch" as const;
  return "critical" as const;
}

export default function ReportsPage() {
  const { data, loading, error, reload } = useAsyncData(() => listReports(), []);
  const [q, setQ] = useState("");
  const router = useRouter();
  const rows = useMemo(
    () => (data ?? []).filter((r) => `${r.id} ${r.type} ${r.scope}`.toLowerCase().includes(q.toLowerCase())),
    [data, q]
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Thermal intelligence report center. PDF generation is not implemented."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Reports" }]}
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data?.length} empty={<EmptyState title="No reports" />}>
        <Card>
          <div className="mb-4">
            <SearchInput aria-label="Search reports" placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <DataTable
            rows={rows}
            empty="No reports match the search"
            onRowClick={(r) => router.push(`/reports/${r.id}`)}
            columns={[
              { key: "id", header: "ID", render: (r) => r.id, sortValue: (r) => r.id },
              { key: "t", header: "Type", render: (r) => r.type },
              { key: "s", header: "Scope", render: (r) => r.scope },
              { key: "d", header: "Generated", render: (r) => formatTime(r.generatedAt), sortValue: (r) => r.generatedAt },
              { key: "st", header: "Status", render: (r) => <StatusBadge label={r.status} tone={tone(r.status)} /> },
            ]}
          />
        </Card>
      </QueryGate>
    </div>
  );
}

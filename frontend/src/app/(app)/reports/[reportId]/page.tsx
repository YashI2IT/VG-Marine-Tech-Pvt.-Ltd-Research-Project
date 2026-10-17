"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatTime } from "@/lib/format";
import { getReport } from "@/services/reports";
import { useParams } from "next/navigation";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data, loading, error, reload } = useAsyncData(() => getReport(reportId), [reportId]);

  return (
    <div>
      <PageHeader
        title={data?.type ?? "Report"}
        description="Preview and audit reference. Download is a placeholder."
        crumbs={[
          { href: "/reports", label: "Reports" },
          { label: reportId },
        ]}
        actions={
          <Button type="button" variant="secondary" disabled title="PDF generation is not implemented">
            Download PDF
          </Button>
        }
      />
      <DemoBanner />
      <QueryGate loading={loading} error={error} onRetry={reload} isEmpty={!loading && !data} empty={<EmptyState title="Report not found" />}>
        {data ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionHeader title="Preview" />
              <p className="text-sm text-slate-600">{data.summary}</p>
              <p className="mt-4 text-sm text-slate-500">Scope: {data.scope}</p>
              <p className="text-sm text-slate-500">Generated: {formatTime(data.generatedAt)}</p>
            </Card>
            <Card>
              <SectionHeader title="Audit / reference" />
              <StatusBadge label={data.status} tone={data.status === "ready" ? "healthy" : data.status === "generating" ? "watch" : "critical"} />
              <p className="mt-4 text-sm">Reference {data.reference}</p>
              <p className="mt-2 text-xs text-slate-400">Hashes and blockchain anchors are out of scope for this UI phase.</p>
            </Card>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

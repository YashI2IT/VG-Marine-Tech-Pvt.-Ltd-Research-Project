"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner, EmptyState } from "@/components/ui/States";
import { useAsyncData } from "@/hooks/useAsyncData";
import { formatTime } from "@/lib/format";
import { getReport, downloadReport } from "@/services/reports";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Download } from "lucide-react";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data, loading, error, reload } = useAsyncData(() => getReport(reportId), [reportId]);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(format: "json" | "csv") {
    try {
      setDownloading(true);
      await downloadReport(reportId, format);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={data?.type ?? "Report"}
        description="Preview and audit reference reconciled with PostgreSQL and blockchain anchors."
        crumbs={[
          { href: "/reports", label: "Reports" },
          { label: reportId },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleDownload("csv")}
              disabled={downloading || !data}
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleDownload("json")}
              disabled={downloading || !data}
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Audit JSON
            </Button>
          </div>
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

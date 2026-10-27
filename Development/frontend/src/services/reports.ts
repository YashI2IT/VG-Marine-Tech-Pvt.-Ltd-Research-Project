import { api } from "@/lib/api";
import type { ReportItem } from "@/types/domain";

export async function listReports(): Promise<ReportItem[]> {
  const res = await api.get("/reports");
  return res.data;
}

export async function getReport(id: string): Promise<ReportItem | undefined> {
  try {
    const res = await api.get(`/reports/${encodeURIComponent(id)}`);
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return undefined;
    throw err;
  }
}

export async function generateReport(params?: {
  type?: string;
  scope?: string;
  timeWindowHours?: number;
}): Promise<ReportItem> {
  const res = await api.post("/reports/generate", params || {});
  return res.data;
}

export async function downloadReport(id: string, format: "json" | "csv" = "json"): Promise<void> {
  const res = await api.get(`/reports/${encodeURIComponent(id)}/export?format=${format}`, {
    responseType: "blob",
  });
  const blob = new Blob([res.data], {
    type: format === "csv" ? "text/csv" : "application/json",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${id}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

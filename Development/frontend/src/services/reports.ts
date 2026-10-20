import { delay } from "@/lib/delay";
import { reports } from "@/data/mock";
import type { ReportItem } from "@/types/domain";

export async function listReports(): Promise<ReportItem[]> {
  await delay();
  return reports;
}

export async function getReport(id: string): Promise<ReportItem | undefined> {
  await delay();
  return reports.find((r) => r.id === id);
}

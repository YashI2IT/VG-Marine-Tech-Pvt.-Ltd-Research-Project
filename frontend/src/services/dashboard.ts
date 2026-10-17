import { delay } from "@/lib/delay";
import { dashboardSummary } from "@/data/mock";
import type { DashboardSummary } from "@/types/domain";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await delay();
  return dashboardSummary;
}

import type { DashboardSummary } from "@/types/domain";
import { api } from "@/lib/api";

/**
 * Fetches the authoritative, genuine User Dashboard summary from PostgreSQL and the CNN-LSTM pipeline.
 * Zero mock fallbacks: If the network or backend is unreachable, the error is thrown directly
 * to trigger honest error states and prevent displaying fabricated business records.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await api.get<DashboardSummary>("/dashboard");
  return res.data;
}

export type TrustSenseOverview = {
  pipelineState: {
    activeSource: string;
    processedSamples: number;
    validWindowsProcessed: number;
    quarantinedCount: number;
    latestPredictedTemp: number | null;
    latestTrustDecision: string;
    persistenceStatus: string;
    ledgerStatus: string;
  } | null;
  acquisition: { connected: boolean; deviceId: string | null; waitingForTelemetry: boolean } | null;
  model: { ready?: boolean; status?: string } | null;
  ledger: { mode?: string; livePeerVerified?: boolean } | null;
  storage: { provider?: string; awsUploadImplemented?: boolean } | null;
  counts: {
    persistenceAvailable: boolean;
    telemetryRecords: number | null;
    predictionRecords: number | null;
    quarantinedRecords: number | null;
    merkleBatches: number | null;
    ledgerAnchors: number | null;
  } | null;
};

export async function getTrustSenseOverview(): Promise<TrustSenseOverview> {
  const res = await api.get("/trustsense/status");
  return {
    pipelineState: res.data?.pipelineState ?? null,
    acquisition: res.data?.acquisition ?? null,
    model: res.data?.model ?? null,
    ledger: res.data?.ledger ?? null,
    storage: res.data?.storage ?? null,
    counts: res.data?.counts ?? null,
  };
}

/**
 * Runtime configuration. Prefer environment variables; never embed secrets here.
 */
export function thermalAiBaseUrl(): string {
  const raw = process.env.THERMAL_AI_URL || "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

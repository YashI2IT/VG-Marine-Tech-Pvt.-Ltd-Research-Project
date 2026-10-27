export interface TelemetryRuntimeConfig {
  transports: Array<"http" | "mqtt" | "serial">;
  defaultDeviceId: string;
  ingestToken: string | null;
  staleMs: number;
  futureSkewMs: number;
  maxGapS: number;
  ahSource: "payload" | "integrate";
  ahInitial: number;
  mqttBrokerUrl: string | null;
  mqttTopic: string;
  mqttUsername: string | null;
  mqttPassword: string | null;
  mqttClientId: string;
  serialPath: string | null;
  serialBaud: number;
}

function csvList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function loadTelemetryConfig(): TelemetryRuntimeConfig {
  const transports = csvList(process.env.TELEMETRY_TRANSPORT, ["http"]).filter(
    (t): t is "http" | "mqtt" | "serial" => t === "http" || t === "mqtt" || t === "serial"
  );
  if (!transports.includes("http")) transports.push("http");

  const ahSource = process.env.TELEMETRY_AH_SOURCE === "integrate" ? "integrate" : "payload";
  const ahInitialRaw = process.env.TELEMETRY_AH_INITIAL;
  const ahInitial = ahInitialRaw !== undefined && ahInitialRaw !== "" ? Number(ahInitialRaw) : 0;

  return {
    transports,
    defaultDeviceId: process.env.TELEMETRY_DEVICE_ID || "unassigned-bms",
    ingestToken: process.env.TELEMETRY_INGEST_TOKEN || null,
    staleMs: Number(process.env.TELEMETRY_STALE_MS || 5000),
    futureSkewMs: Number(process.env.TELEMETRY_FUTURE_SKEW_MS || 2000),
    maxGapS: Number(process.env.TELEMETRY_MAX_GAP_S || 2),
    ahSource,
    ahInitial: Number.isFinite(ahInitial) ? ahInitial : 0,
    mqttBrokerUrl: process.env.MQTT_BROKER_URL || null,
    mqttTopic: process.env.MQTT_TOPIC || "trustsense/bms/+/telemetry",
    mqttUsername: process.env.MQTT_USERNAME || null,
    mqttPassword: process.env.MQTT_PASSWORD || null,
    mqttClientId: process.env.MQTT_CLIENT_ID || "trustsense-bms-gateway",
    serialPath: process.env.TELEMETRY_SERIAL_PATH || null,
    serialBaud: Number(process.env.TELEMETRY_SERIAL_BAUD || 115200),
  };
}

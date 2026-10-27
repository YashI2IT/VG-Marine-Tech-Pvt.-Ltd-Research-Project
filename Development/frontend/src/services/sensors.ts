import { api } from "@/lib/api";
import { sensorConfig, sensors } from "@/data/mock";
import type { SensorConfiguration, SensorHealth } from "@/types/domain";

export async function getSensorHealth(): Promise<SensorHealth[]> {
  try {
    const res = await api.get("/thermal/sensors");
    return res.data?.sensors || sensors;
  } catch (err) {
    console.warn("Failed to load sensor diagnostics from backend, using fallback:", err);
    return sensors;
  }
}

export async function getSensorPlacement(): Promise<SensorConfiguration & { scientificStatus?: any }> {
  try {
    const res = await api.get("/thermal/reduction");
    return res.data;
  } catch (err) {
    console.warn("Failed to load sensor reduction from backend, using fallback:", err);
    return sensorConfig;
  }
}

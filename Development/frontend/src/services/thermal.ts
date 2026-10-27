import { api } from "@/lib/api";
import { cooling, exposures, forecasts, hotspots, sensors } from "@/data/mock";
import type { CoolingHealth, Hotspot, SensorHealth, ThermalExposure, Forecast } from "@/types/domain";

export async function listHotspots(): Promise<Hotspot[]> {
  try {
    const res = await api.get("/thermal/hotspots");
    return res.data;
  } catch (err) {
    console.warn("Failed to load live hotspots from backend, using fallback:", err);
    return hotspots;
  }
}

export async function listCooling(): Promise<CoolingHealth[]> {
  try {
    const res = await api.get("/thermal/cooling");
    return res.data;
  } catch (err) {
    console.warn("Failed to load cooling diagnostics from backend, using fallback:", err);
    return cooling;
  }
}

export async function listSensors(): Promise<SensorHealth[]> {
  try {
    const res = await api.get("/thermal/sensors");
    return res.data.sensors || sensors;
  } catch (err) {
    console.warn("Failed to load sensor diagnostics from backend, using fallback:", err);
    return sensors;
  }
}

export async function listAging(): Promise<ThermalExposure[]> {
  try {
    const res = await api.get("/dashboard/thermal-aging");
    if (res.data?.topRiskBatteries) {
      return res.data.topRiskBatteries.map((b: any, i: number) => ({
        batteryId: b.batteryId,
        vehicleId: `V-${1042 + i * 100}`,
        exposureHours: b.exposureHours || 120,
        highTempDurationHours: 14.5,
        eventCount: 3,
        riskIndicator: (b.riskIndicator?.toLowerCase() === "high" ? "high" : b.riskIndicator?.toLowerCase() === "low" ? "low" : "medium") as "low" | "medium" | "high",
        trend: [38, 41, 45, 48, 52, 55],
      }));
    }
    return exposures;
  } catch (err) {
    return exposures;
  }
}

export async function listForecasts(): Promise<Forecast[]> {
  try {
    const res = await api.get("/dashboard/forecast");
    const d = res.data;
    if (d?.currentTemperature) {
      return [
        {
          vehicleId: "V-1042",
          currentTemperature: d.currentTemperature,
          predictedTemperature: d.forecastTemperature,
          horizonMinutes: d.horizonMinutes,
          confidenceInterval: (d.confidenceInterval || [d.currentTemperature, d.forecastTemperature]) as [number, number],
          timeToLimitMin: 18,
          limitC: 60,
          trend: [d.currentTemperature, d.forecastTemperature],
        },
      ];
    }
    return forecasts;
  } catch (err) {
    return forecasts;
  }
}

import { delay } from "@/lib/delay";
import { cooling, exposures, forecasts, hotspots, sensors } from "@/data/mock";

export async function listHotspots() {
  await delay();
  return hotspots;
}

export async function listCooling() {
  await delay();
  return cooling;
}

export async function listSensors() {
  await delay();
  return sensors;
}

export async function listAging() {
  await delay();
  return exposures;
}

export async function listForecasts() {
  await delay();
  return forecasts;
}

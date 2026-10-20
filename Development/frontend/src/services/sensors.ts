import { delay } from "@/lib/delay";
import { sensorConfig, sensors } from "@/data/mock";

export async function getSensorHealth() {
  await delay();
  return sensors;
}

export async function getSensorPlacement() {
  await delay();
  return sensorConfig;
}

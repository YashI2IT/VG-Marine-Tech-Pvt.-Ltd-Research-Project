import { delay } from "@/lib/delay";
import { batteries } from "@/data/mock";
import type { Battery, Cell, Module } from "@/types/domain";

export async function getBattery(batteryId: string): Promise<Battery | undefined> {
  await delay();
  return batteries.find((b) => b.id === batteryId);
}

export async function getBatteryByVehicle(vehicleId: string): Promise<Battery | undefined> {
  await delay();
  return batteries.find((b) => b.vehicleId === vehicleId);
}

export function findModule(battery: Battery, moduleId: string): Module | undefined {
  return battery.modules.find((m) => m.id === moduleId);
}

export function findCell(module: Module, cellId: string): Cell | undefined {
  return module.cells.find((c) => c.id === cellId);
}

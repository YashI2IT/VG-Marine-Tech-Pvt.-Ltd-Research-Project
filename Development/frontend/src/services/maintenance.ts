import { delay } from "@/lib/delay";
import { maintenance } from "@/data/mock";
import type { MaintenanceItem } from "@/types/domain";

export async function listMaintenance(): Promise<MaintenanceItem[]> {
  await delay();
  return maintenance;
}

export async function getMaintenanceByVehicle(vehicleId: string): Promise<MaintenanceItem[]> {
  await delay();
  return maintenance.filter((m) => m.vehicleId === vehicleId);
}

export async function getMaintenanceItem(vehicleId: string): Promise<MaintenanceItem | undefined> {
  await delay();
  return maintenance.find((m) => m.vehicleId === vehicleId);
}

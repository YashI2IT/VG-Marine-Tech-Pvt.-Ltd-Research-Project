import { delay } from "@/lib/delay";
import { vehicles } from "@/data/mock";
import type { Vehicle } from "@/types/domain";

export async function listVehicles(): Promise<Vehicle[]> {
  await delay();
  return vehicles;
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  await delay();
  return vehicles.find((v) => v.id === id);
}

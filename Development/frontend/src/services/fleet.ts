import { delay } from "@/lib/delay";
import { vehicles } from "@/data/mock";
import type { Vehicle } from "@/types/domain";

export async function getFleetVehicles(): Promise<Vehicle[]> {
  await delay();
  return vehicles;
}

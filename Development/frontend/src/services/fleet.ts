import { api } from "@/lib/api";
import type { Vehicle } from "@/types/domain";

export async function getFleetVehicles(): Promise<Vehicle[]> {
  const res = await api.get("/vehicles");
  return res.data;
}

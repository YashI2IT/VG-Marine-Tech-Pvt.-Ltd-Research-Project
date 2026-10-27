import { api } from "@/lib/api";
import type { Vehicle } from "@/types/domain";

export async function listVehicles(query?: { status?: string; fleet?: string; search?: string }): Promise<Vehicle[]> {
  const params = new URLSearchParams();
  if (query?.status) params.append("status", query.status);
  if (query?.fleet) params.append("fleet", query.fleet);
  if (query?.search) params.append("search", query.search);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const res = await api.get(`/vehicles${queryStr}`);
  return res.data;
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  try {
    const res = await api.get(`/vehicles/${encodeURIComponent(id)}`);
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return undefined;
    throw err;
  }
}

export async function createVehicle(payload: Partial<Vehicle>): Promise<Vehicle> {
  const res = await api.post("/vehicles", payload);
  return res.data;
}

export async function updateVehicle(id: string, payload: Partial<Vehicle>): Promise<Vehicle> {
  const res = await api.patch(`/vehicles/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteVehicle(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/vehicles/${encodeURIComponent(id)}`);
  return res.data;
}

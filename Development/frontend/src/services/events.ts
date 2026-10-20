import { delay } from "@/lib/delay";
import { events } from "@/data/mock";
import type { ThermalEvent } from "@/types/domain";

export async function listEvents(): Promise<ThermalEvent[]> {
  await delay();
  return events;
}

export async function getEvent(id: string): Promise<ThermalEvent | undefined> {
  await delay();
  return events.find((e) => e.id === id);
}

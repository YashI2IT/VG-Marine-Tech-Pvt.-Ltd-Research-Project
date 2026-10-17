"use client";

import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatNumber, formatTime } from "@/lib/format";
import type { Vehicle } from "@/types/domain";
import { useRouter } from "next/navigation";

const columns: Column<Vehicle>[] = [
  { key: "id", header: "Vehicle", render: (r) => <span className="font-semibold">{r.id}</span>, sortValue: (r) => r.id },
  { key: "name", header: "Name", render: (r) => r.name, sortValue: (r) => r.name },
  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.status} tone={r.status} />, sortValue: (r) => r.status },
  { key: "battery", header: "Battery", render: (r) => r.batteryId, sortValue: (r) => r.batteryId },
  { key: "tmax", header: "Tmax", render: (r) => `${formatNumber(r.metrics.tmax)}°C`, sortValue: (r) => r.metrics.tmax },
  { key: "risk", header: "Thermal risk", render: (r) => <StatusBadge label={r.thermalRisk} tone={r.thermalRisk} />, sortValue: (r) => r.thermalRisk },
  { key: "cooling", header: "Cooling", render: (r) => <StatusBadge label={r.coolingHealth} tone={r.coolingHealth} />, sortValue: (r) => r.coolingHealth },
  { key: "sensors", header: "Sensors", render: (r) => <StatusBadge label={r.sensorHealth} tone={r.sensorHealth} />, sortValue: (r) => r.sensorHealth },
  { key: "maint", header: "Maintenance", render: (r) => r.maintenancePriority, sortValue: (r) => r.maintenancePriority },
  { key: "updated", header: "Last update", render: (r) => formatTime(r.lastUpdate), sortValue: (r) => r.lastUpdate },
];

export function VehicleTable({ rows }: { rows: Vehicle[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      rows={rows}
      empty="No vehicles match the current filters"
      onRowClick={(row) => router.push(`/vehicles/${row.id}`)}
    />
  );
}

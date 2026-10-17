"use client";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DemoBanner } from "@/components/ui/States";
import { dashboardSummary } from "@/data/mock";
import Link from "next/link";

const items = [
  { href: "/thermal-intelligence/hotspots", title: "Hotspots", body: "Localized cell heating and spatial ΔT.", badge: dashboardSummary.hotspot.severity },
  { href: "/thermal-intelligence/cooling", title: "Cooling health", body: "Expected vs observed thermal rejection.", badge: dashboardSummary.cooling.status },
  { href: "/thermal-intelligence/sensors", title: "Sensor health", body: "Physical vs virtual residuals.", badge: "watch" as const },
  { href: "/thermal-intelligence/aging", title: "Thermal aging", body: "Exposure hours — not capacity SOH.", badge: "warning" as const },
  { href: "/thermal-intelligence/forecast", title: "Temperature forecast", body: "Horizon, uncertainty, time-to-limit.", badge: "critical" as const },
];

export default function ThermalHubPage() {
  return (
    <div>
      <PageHeader
        title="Thermal intelligence"
        description="Analytics hub for hotspot, cooling, sensor, aging, and forecast workspaces. Engines are not implemented yet."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Thermal intelligence" }]}
      />
      <DemoBanner />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition hover:border-blue-200">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{item.title}</h2>
                <StatusBadge label={item.badge} tone={item.badge} />
              </div>
              <p className="text-sm text-slate-500">{item.body}</p>
            </Card>
          </Link>
        ))}
        <Card>
          <h2 className="font-semibold">Thermal risk</h2>
          <p className="mt-2 text-sm text-slate-500">{dashboardSummary.fleet.thermalRiskCount} vehicles currently ranked at elevated risk in the demo fleet sample.</p>
        </Card>
      </div>
    </div>
  );
}

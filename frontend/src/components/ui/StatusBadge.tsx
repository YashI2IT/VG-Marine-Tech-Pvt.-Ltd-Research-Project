import { cn } from "@/lib/utils";
import type { HealthStatus, Severity } from "@/types/domain";

const severityMap: Record<Severity, string> = {
  info: "bg-[#eff6ff] text-blue-700",
  watch: "bg-amber-50 text-amber-800",
  warning: "bg-orange-50 text-orange-800",
  critical: "bg-rose-50 text-rose-700",
};

const healthMap: Record<HealthStatus, string> = {
  healthy: "bg-[#ecfdf5] text-emerald-800",
  watch: "bg-amber-50 text-amber-800",
  warning: "bg-orange-50 text-orange-800",
  critical: "bg-rose-50 text-rose-700",
  degraded: "bg-orange-50 text-orange-800",
  faulty: "bg-rose-50 text-rose-700",
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: Severity | HealthStatus;
}) {
  const cls = tone in severityMap ? severityMap[tone as Severity] : healthMap[tone as HealthStatus];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

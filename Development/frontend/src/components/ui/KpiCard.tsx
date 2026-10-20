import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "blue" | "mint" | "rose" | "amber";
}) {
  const chip = {
    blue: "bg-[#eff6ff] text-blue-700",
    mint: "bg-[#ecfdf5] text-emerald-700",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <Card className="flex items-start gap-4">
      {Icon ? (
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${chip}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </div>
    </Card>
  );
}

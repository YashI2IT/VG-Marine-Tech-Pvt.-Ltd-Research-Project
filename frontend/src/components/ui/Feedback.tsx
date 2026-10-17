import { StatusBadge } from "./StatusBadge";
import type { Severity } from "@/types/domain";
import type { ReactNode } from "react";
import { Card } from "./Card";

export function AlertCard({
  title,
  body,
  severity,
  meta,
}: {
  title: string;
  body: string;
  severity: Severity;
  meta?: ReactNode;
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <StatusBadge label={severity} tone={severity} />
      </div>
      <p className="text-sm text-slate-500">{body}</p>
      {meta}
    </Card>
  );
}

export function RecommendationCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-emerald-100 bg-[#ecfdf5] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Recommended action</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-emerald-900/80">{body}</p>
    </div>
  );
}

export function Timeline({ items }: { items: { time: string; title: string; body?: string }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.time + item.title} className="flex gap-3">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
          <div>
            <p className="text-xs text-slate-400">{item.time}</p>
            <p className="text-sm font-medium text-slate-800">{item.title}</p>
            {item.body ? <p className="text-sm text-slate-500">{item.body}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

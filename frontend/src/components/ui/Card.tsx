import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  className,
  children,
  padding = true,
}: {
  className?: string;
  children: ReactNode;
  padding?: boolean;
}) {
  return <section className={cn("panel", padding && "p-6", className)}>{children}</section>;
}

export function SectionHeader({
  title,
  action,
  kicker,
}: {
  title: string;
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{kicker}</p> : null}
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  );
}

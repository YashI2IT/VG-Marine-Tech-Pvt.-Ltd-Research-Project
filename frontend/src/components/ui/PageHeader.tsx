import { cn } from "@/lib/utils";
import Link from "next/link";

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 ? <span className="text-slate-300">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="rounded-full px-1 hover:text-blue-600">
              {item.label}
            </Link>
          ) : (
            <span className={cn(i === items.length - 1 && "font-medium text-slate-800")}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
}: {
  title: string;
  description?: string;
  crumbs: { href?: string; label: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <Breadcrumbs items={crumbs} />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

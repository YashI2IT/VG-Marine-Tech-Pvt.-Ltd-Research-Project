"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block min-w-[180px] flex-1">
      <span className="sr-only">{props["aria-label"] ?? "Search"}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="w-full rounded-full border border-[#dbe7f5] bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
        {...props}
      />
    </label>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-full border border-[#dbe7f5] bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400",
        props.className
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-full border border-[#dbe7f5] bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400",
        props.className
      )}
      {...props}
    />
  );
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={props.type ?? "datetime-local"}
      className={cn(
        "rounded-full border border-[#dbe7f5] bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400",
        props.className
      )}
      {...props}
    />
  );
}

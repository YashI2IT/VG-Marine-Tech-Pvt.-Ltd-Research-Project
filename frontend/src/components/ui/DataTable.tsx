"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  onRowClick,
  empty = "No rows",
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [columns, dir, rows, sortKey]);

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-3 font-semibold">
                {col.sortValue ? (
                  <button
                    className="rounded-full px-1 hover:text-slate-700"
                    onClick={() => {
                      if (sortKey === col.key) setDir(dir === "asc" ? "desc" : "asc");
                      else {
                        setSortKey(col.key);
                        setDir("asc");
                      }
                    }}
                    type="button"
                  >
                    {col.header}
                    {sortKey === col.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-slate-400" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={cn(
                  "border-t border-[#eef3f9] text-slate-700",
                  onRowClick && "cursor-pointer hover:bg-[#eff6ff]/70"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-3.5">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

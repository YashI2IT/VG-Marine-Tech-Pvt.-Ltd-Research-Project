"use client";

import { cn } from "@/lib/utils";
import type { Cell } from "@/types/domain";
import { useState } from "react";

function colorFor(temp: number, min: number, max: number) {
  const t = (temp - min) / Math.max(max - min, 0.1);
  if (t > 0.85) return "bg-rose-500";
  if (t > 0.65) return "bg-orange-400";
  if (t > 0.45) return "bg-amber-300";
  if (t > 0.25) return "bg-emerald-300";
  return "bg-sky-300";
}

export function Heatmap({
  cells,
  rows,
  cols,
  mode = "virtual",
  selectedId,
  onSelect,
  timestamp,
}: {
  cells: Cell[];
  rows: number;
  cols: number;
  mode?: "physical" | "virtual";
  selectedId?: string;
  onSelect?: (cell: Cell) => void;
  timestamp?: string;
}) {
  const [hover, setHover] = useState<Cell | null>(null);
  const temps = cells.map((c) => (mode === "physical" ? c.physicalTemp : c.virtualTemp));
  const min = Math.min(...temps);
  const max = Math.max(...temps);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{mode === "physical" ? "Physical temperature" : "Virtual temperature"} grid</span>
        {timestamp ? <span>{timestamp}</span> : null}
      </div>
      <div
        className="relative grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Pack cell heatmap"
      >
        {cells.map((cell) => {
          const temp = mode === "physical" ? cell.physicalTemp : cell.virtualTemp;
          return (
            <button
              key={cell.id}
              type="button"
              role="gridcell"
              aria-label={`${cell.id} ${temp.toFixed(1)} degrees`}
              className={cn(
                "aspect-square rounded-2xl transition",
                colorFor(temp, min, max),
                selectedId === cell.id && "ring-2 ring-slate-900 ring-offset-2",
                cell.isHotspot && "outline outline-offset-1 outline-rose-600"
              )}
              onMouseEnter={() => setHover(cell)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(cell)}
              onClick={() => onSelect?.(cell)}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{min.toFixed(1)}°C</span>
        <div className="mx-3 h-1.5 flex-1 rounded-full bg-gradient-to-r from-sky-300 via-emerald-300 to-rose-500" />
        <span>{max.toFixed(1)}°C</span>
      </div>
      {hover ? (
        <div className="rounded-full bg-slate-900 px-4 py-2 text-xs text-white">
          {hover.id} · phys {hover.physicalTemp.toFixed(1)}°C · virt {hover.virtualTemp.toFixed(1)}°C
          {hover.isHotspot ? " · hotspot" : ""}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Select a cell for detail. Outline marks a demo hotspot.</p>
      )}
    </div>
  );
}

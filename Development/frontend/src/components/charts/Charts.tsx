"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Series = { label: string; value: number; extra?: number };

const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid #dbe7f5",
  fontSize: 12,
};

export function TrendChart({ data, unit = "°C" }: { data: Series[]; unit?: string }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#eef3f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} ${unit}`, "Value"]} />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastChart({ data }: { data: { label: string; value: number; lower: number; upper: number }[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke="#eef3f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="upper" stroke="none" fill="#dbeafe" />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#eff6ff" />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionChart({ data }: { data: Series[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="#eef3f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" fill="#2563eb" radius={[12, 12, 12, 12]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResidualChart({ data }: { data: Series[] }) {
  return <DistributionChart data={data} />;
}

export function DualBarChart({ data }: { data: { label: string; expected: number; observed: number }[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="#eef3f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="expected" fill="#93c5fd" radius={[12, 12, 12, 12]} />
          <Bar dataKey="observed" fill="#34d399" radius={[12, 12, 12, 12]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

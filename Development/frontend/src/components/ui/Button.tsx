import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "mint";

const styles: Record<Variant, string> = {
  primary: "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm shadow-blue-200",
  secondary: "bg-white text-slate-700 border border-[#dbe7f5] hover:bg-[#eff6ff]",
  ghost: "bg-transparent text-slate-600 hover:bg-[#eff6ff]",
  danger: "bg-[#e11d48] text-white hover:bg-[#be123c]",
  mint: "bg-[#ecfdf5] text-emerald-800 hover:bg-emerald-100",
};

export function Button({
  className,
  variant = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

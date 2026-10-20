import { cn } from "@/lib/utils";

export function BrandMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/eculytics-mark.svg"
      alt="ECUlytics"
      width={size}
      height={size}
      className={cn("rounded-full", className)}
    />
  );
}

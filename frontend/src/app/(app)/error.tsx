"use client";

import { ErrorState } from "@/components/ui/States";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || "Something went wrong"} onRetry={reset} />;
}

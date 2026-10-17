import { ErrorState, LoadingState } from "@/components/ui/States";
import type { ReactNode } from "react";

export function QueryGate({
  loading,
  error,
  onRetry,
  isEmpty,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: ReactNode;
  children: ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}

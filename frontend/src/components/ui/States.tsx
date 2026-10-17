import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm text-slate-500 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff] text-blue-600">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {body ? <p className="mt-1 max-w-md text-sm text-slate-500">{body}</p> : null}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">Unable to load this view</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="secondary">
          Retry
        </Button>
      ) : null}
    </Card>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-5 rounded-full border border-blue-100 bg-[#eff6ff] px-4 py-2 text-center text-xs font-medium text-blue-800">
      Demo / mock values — not measured scientific results.
    </div>
  );
}

"use client";

import { Button } from "./Button";
import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-900/30" aria-label="Close dialog" onClick={onClose} />
      <div role="dialog" aria-modal className="panel relative z-10 w-full max-w-md p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          {onConfirm ? (
            <Button onClick={onConfirm} type="button">
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-900/30" aria-label="Close panel" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-auto bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} type="button">
            Close
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

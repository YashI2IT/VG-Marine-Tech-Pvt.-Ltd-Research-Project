"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getAdminBilling } from "@/services/admin";
import {
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Key,
  Layers,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function AdminBillingPage() {
  const { data, loading, error, reload } = useAsyncData(() => getAdminBilling(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing, Quotas & Blockchain Ledger"
        description="Monitor enterprise subscription tier, API credit meters, monthly invoices, and immutable Hyperledger Fabric transaction commits."
        crumbs={[
          { href: "/admin", label: "Admin Hub" },
          { href: "/admin", label: "Admin Hub" },
          { label: "Billing & Ledger" },
        ]}
      />

      <QueryGate loading={loading} error={error} onRetry={reload}>
        {data ? (
          <div className="space-y-6">
            {/* Top Plan Overview Banner */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="panel p-6 bg-gradient-to-br from-slate-900 to-blue-950 text-white lg:col-span-2 rounded-[28px]">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
                    Active Subscription
                  </span>
                  <span className="text-xs text-slate-400">{data.subscription.billingCycle}</span>
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight">{data.subscription.planName}</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Full battery telemetry ingestion, hybrid CNN-LSTM inference pipeline, and SHA-256 Merkle tree verification.
                </p>
                <div className="mt-6 flex flex-wrap items-baseline gap-4">
                  <span className="text-3xl font-extrabold">${data.subscription.amountMonthly}</span>
                  <span className="text-sm text-slate-400">/ month billed recurringly</span>
                  <span className="ml-auto text-xs text-slate-400">{data.subscription.paymentMethod}</span>
                </div>
              </div>

              <Card className="flex flex-col justify-between">
                <div>
                  <SectionHeader title="Payment Method" kicker="Billing Account" />
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Corporate Wire Transfer</p>
                      <p className="text-xs text-slate-400">Primary payment channel</p>
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <Button variant="secondary" className="w-full text-xs">
                    Update Payment Details
                  </Button>
                </div>
              </Card>
            </div>

            {/* Quota & Usage Progress Bars */}
            <Card>
              <SectionHeader title="Monthly Telemetry & Platform Usage Quotas" kicker="Resource Consumption" />
              <div className="grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.quotas.map((quota, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-100 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>{quota.name}</span>
                      <span className="font-bold text-slate-900">{quota.percentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${
                          quota.percentage > 80 ? "bg-amber-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${quota.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {quota.used.toLocaleString()} / {quota.total.toLocaleString()} {quota.unit}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Split Section: Invoices & Hyperledger Ledger Transactions */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Invoices & Statements" kicker="Tax Receipts" />
                <div className="divide-y divide-slate-100 pt-1">
                  {data.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-mono text-xs">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{inv.id}</p>
                          <p className="text-xs text-slate-400">{inv.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">{inv.amount}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {inv.status}
                        </span>
                        <button
                          title="Download Invoice"
                          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeader
                  title="Blockchain Provenance Transactions"
                  kicker="Hyperledger Fabric Ledger"
                  action={<StatusBadge label="All Validated" tone="healthy" />}
                />
                <div className="divide-y divide-slate-100 pt-1">
                  {data.blockchainTransactions.map((tx, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-blue-600">{tx.txId}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                            Block #{tx.blockHeight}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tx.type} · {tx.timestamp}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {tx.status}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Gas: {tx.gasFee}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </QueryGate>
    </div>
  );
}

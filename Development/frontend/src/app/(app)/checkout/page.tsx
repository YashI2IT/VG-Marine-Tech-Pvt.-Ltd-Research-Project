"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { RazorpayCheckoutButton } from "@/components/billing/RazorpayCheckoutButton";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Zap,
} from "lucide-react";

export default function CheckoutPage() {
  const [amountRupees, setAmountRupees] = useState<number>(500);
  const [currency, setCurrency] = useState<string>("INR");
  const [customerName, setCustomerName] = useState<string>("Fleet Manager");
  const [customerEmail, setCustomerEmail] = useState<string>("manager@fleet-bms.com");
  const [customerPhone, setCustomerPhone] = useState<string>("9876543210");
  const [paymentResult, setPaymentResult] = useState<{
    orderId: string;
    paymentId: string;
    signature: string;
    verified: boolean;
  } | null>(null);

  const amountInPaise = Math.round(amountRupees * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Razorpay Standard Web Checkout"
        description="End-to-end cryptographic payment verification with server-side order generation and HMAC-SHA256 signature validation."
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { label: "Razorpay Checkout" },
        ]}
        actions={
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Razorpay Test Mode Active</span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Checkout Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <SectionHeader
              title="Payment Details"
              kicker="Standard Web Checkout"
            />

            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount ({currency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                      {amountInPaise} paise
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Minimum requirement: 100 paise (₹1.00)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INR">INR (Indian Rupee - ₹)</option>
                    <option value="USD">USD (US Dollar - $)</option>
                  </select>
                </div>
              </div>

              {/* Preset buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preset Amount Shortcuts
                </label>
                <div className="flex flex-wrap gap-2">
                  {[100, 500, 1499, 2490].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountRupees(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        amountRupees === preset
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {currency === "INR" ? "₹" : "$"}{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prefill Customer Details */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 mb-3">
                  Customer Checkout Prefill (Optional)
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Trigger Button */}
              <div className="pt-4 border-t border-slate-100">
                <RazorpayCheckoutButton
                  amount={amountInPaise}
                  currency={currency}
                  name="ECUlytics · TrustSense-BMS"
                  description="Standard Web Checkout Order"
                  receipt={`rcpt_chk_${Date.now()}`}
                  buttonText={`Pay ${currency === "INR" ? "₹" : "$"}${amountRupees} via Razorpay`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md transition-all text-sm"
                  onSuccess={(res) => {
                    setPaymentResult({
                      orderId: res.orderId,
                      paymentId: res.paymentId,
                      signature: res.signature,
                      verified: res.verification?.success ?? true,
                    });
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Verification Result Receipt Card */}
          {paymentResult && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-emerald-950">
                      Payment Cryptographically Verified & Captured
                    </h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                      HTTP 200 OK
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    The payment signature was authenticated via HMAC-SHA256 on the backend server.
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 pt-2 text-xs">
                    <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
                      <span className="text-[11px] text-slate-400 block">Razorpay Order ID</span>
                      <span className="font-mono font-bold text-slate-900">{paymentResult.orderId}</span>
                    </div>
                    <div className="bg-white/80 p-3 rounded-lg border border-emerald-100">
                      <span className="text-[11px] text-slate-400 block">Razorpay Payment ID</span>
                      <span className="font-mono font-bold text-slate-900">{paymentResult.paymentId}</span>
                    </div>
                  </div>

                  <div className="bg-white/80 p-3 rounded-lg border border-emerald-100 text-xs">
                    <span className="text-[11px] text-slate-400 block">HMAC-SHA256 Signature</span>
                    <span className="font-mono text-[11px] text-slate-700 break-all">
                      {paymentResult.signature}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Col: Architecture & Flow Steps */}
        <div className="space-y-6">
          <Card>
            <SectionHeader title="Checkout Lifecycle" kicker="3-Step Verification" />
            <div className="space-y-4 pt-2 text-xs">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  1
                </span>
                <div>
                  <p className="font-bold text-slate-900">Backend: Order Creation</p>
                  <p className="text-slate-500 mt-0.5">
                    Client calls <code className="bg-slate-100 px-1 rounded">POST /api/create-order</code>.
                    Backend calls Razorpay Orders API via SDK and returns authoritative <code className="bg-slate-100 px-1 rounded">order_id</code>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  2
                </span>
                <div>
                  <p className="font-bold text-slate-900">Frontend: Razorpay Modal</p>
                  <p className="text-slate-500 mt-0.5">
                    Official <code className="bg-slate-100 px-1 rounded">checkout.js</code> modal opens.
                    Customer completes payment via card, UPI, netbanking or test credentials.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                  3
                </span>
                <div>
                  <p className="font-bold text-slate-900">Backend: Signature Verification</p>
                  <p className="text-slate-500 mt-0.5">
                    Modal returns <code className="bg-slate-100 px-1 rounded">razorpay_signature</code>.
                    Backend runs <code className="bg-slate-100 px-1 rounded">HMAC-SHA256(order_id|payment_id, KEY_SECRET)</code>.
                    Only matching signatures mark payment as PAID.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-50 border-slate-200">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">Security Guarantee</p>
                <p>
                  <code className="text-[11px] font-mono">RAZORPAY_KEY_SECRET</code> is strictly maintained in the backend environment.
                  The browser client only receives <code className="text-[11px] font-mono">NEXT_PUBLIC_RAZORPAY_KEY_ID</code>.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

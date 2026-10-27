"use client";

import { useState } from "react";
import { CreditCard, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { launchRazorpayCheckout, StandardCheckoutOptions } from "@/lib/razorpay";

export interface RazorpayCheckoutButtonProps {
  amount: number; // in paise (e.g., 50000 = 500.00)
  currency?: string; // default "INR"
  name?: string;
  description?: string;
  receipt?: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (result: {
    paymentId: string;
    orderId: string;
    signature: string;
    verification: any;
  }) => void;
  onError?: (error: any) => void;
}

export function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  name = "ECUlytics · TrustSense-BMS",
  description = "Enterprise Telemetry & Thermal Diagnostics",
  receipt,
  buttonText,
  className,
  disabled = false,
  onSuccess,
  onError,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const formattedAmount = (amount / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: currency,
  });

  const handleCheckout = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      await launchRazorpayCheckout({
        amount,
        currency,
        name,
        description,
        receipt,
        onSuccess: (result) => {
          setLoading(false);
          setSuccessInfo(`Payment verified! ID: ${result.paymentId}`);
          if (onSuccess) {
            onSuccess(result);
          }
        },
        onError: (err) => {
          setLoading(false);
          const msg = err.message || "Payment was unsuccessful or failed signature check.";
          setErrorMessage(msg);
          if (onError) {
            onError(err);
          }
        },
        onDismiss: () => {
          setLoading(false);
          console.log("[Razorpay Checkout] Checkout modal dismissed by user.");
        },
      });
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err.message || "Failed to initialize payment gateway.");
      if (onError) {
        onError(err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={disabled || loading}
        className={
          className ||
          "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing Order...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            <span>{buttonText || `Pay ${formattedAmount} via Razorpay`}</span>
          </>
        )}
      </button>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successInfo && (
        <div className="flex items-start gap-2 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>{successInfo}</span>
        </div>
      )}
    </div>
  );
}

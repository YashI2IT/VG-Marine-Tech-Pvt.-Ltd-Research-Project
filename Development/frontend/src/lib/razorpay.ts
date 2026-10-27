import { api } from "@/lib/api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/**
 * Suppresses Indian banking / Razorpay DSC USB token port probes (ports 7070, 7071, 37857)
 * to prevent browser Mixed Content warnings and Private Network Access (PNA) CORS loopback violations.
 */
function installDscProbeInterceptor() {
  if (typeof window === "undefined" || (window as any).__pna_dsc_probe_guarded) {
    return;
  }
  (window as any).__pna_dsc_probe_guarded = true;

  try {
    const isProbeUrl = (url: any) => {
      if (typeof url !== "string") return false;
      return (
        url.includes("localhost:7070") ||
        url.includes("localhost:7071") ||
        url.includes("localhost:37857") ||
        url.includes("127.0.0.1:7070") ||
        url.includes("127.0.0.1:7071") ||
        url.includes("127.0.0.1:37857")
      );
    };

    // 1. Intercept Image src assignments (new Image().src = "http://localhost:7070/...")
    const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src"
    );
    if (originalImageSrcDescriptor && originalImageSrcDescriptor.set) {
      const originalSet = originalImageSrcDescriptor.set;
      Object.defineProperty(HTMLImageElement.prototype, "src", {
        set(url: string) {
          if (isProbeUrl(url)) {
            // Silently dispatch standard error event so Razorpay knows no hardware token is attached
            setTimeout(() => {
              this.dispatchEvent(new Event("error"));
            }, 0);
            return;
          }
          originalSet.call(this, url);
        },
        get() {
          return originalImageSrcDescriptor.get?.call(this) || "";
        },
        configurable: true,
        enumerable: true,
      });
    }

    // 2. Intercept fetch probes if any
    if (typeof window.fetch === "function") {
      const originalFetch = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        const urlString = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (isProbeUrl(urlString)) {
          return Promise.reject(new TypeError("Blocked insecure local hardware probe"));
        }
        return originalFetch.apply(this, arguments as any);
      };
    }
  } catch (e) {
    // Graceful fallback if DOM prototypes cannot be overridden
  }
}

/**
 * Dynamically loads the official Razorpay Checkout SDK if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    installDscProbeInterceptor();
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface CreateOrderParams {
  amount: number; // in paise (e.g. 100 paise = 1 INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}

export interface VerifyPaymentParams {
  order_id: string;
  payment_id: string;
  signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  order_id: string;
  payment_id: string;
}

/**
 * STEP 1: Calls backend endpoint POST /api/create-order
 */
export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<CreateOrderResponse> {
  if (!params.amount || params.amount < 100) {
    throw new Error("Amount must be at least 100 paise.");
  }
  const { data } = await api.post<CreateOrderResponse>("/create-order", params);
  return data;
}

/**
 * STEP 3: Calls backend endpoint POST /api/verify-payment
 */
export async function verifyRazorpayPayment(
  params: VerifyPaymentParams
): Promise<VerifyPaymentResponse> {
  const { data } = await api.post<VerifyPaymentResponse>("/verify-payment", params);
  return data;
}

export interface StandardCheckoutOptions {
  amount: number; // in paise (>= 100)
  currency?: string; // e.g. "INR", "USD"
  name?: string;
  description?: string;
  receipt?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
  onSuccess?: (result: {
    paymentId: string;
    orderId: string;
    signature: string;
    verification: VerifyPaymentResponse;
  }) => void;
  onError?: (error: any) => void;
  onDismiss?: () => void;
}

/**
 * STEP 2: Opens Razorpay Standard Checkout modal with full error handling.
 */
export async function launchRazorpayCheckout(
  options: StandardCheckoutOptions
): Promise<void> {
  // 1. Ensure Razorpay checkout script is loaded
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    const errorMsg =
      "Unable to load Razorpay Checkout SDK. Please check your network connection.";
    options.onError?.({ message: errorMsg });
    throw new Error(errorMsg);
  }

  // 2. Fetch order_id from backend (Step 1)
  let orderData: CreateOrderResponse;
  try {
    orderData = await createRazorpayOrder({
      amount: options.amount,
      currency: options.currency || "INR",
      receipt: options.receipt,
      notes: options.notes,
    });
  } catch (err: any) {
    const errorMsg =
      err.response?.data?.error || err.message || "Failed to create Razorpay order.";
    options.onError?.({ message: errorMsg, originalError: err });
    throw new Error(errorMsg);
  }

  // 3. Resolve public key ID (never secret key)
  const keyId =
    orderData.key_id ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    "";

  // 4. Construct Razorpay modal options
  const rzpOptions = {
    key: keyId,
    amount: orderData.amount,
    currency: orderData.currency,
    name: options.name || "ECUlytics · TrustSense-BMS",
    description: options.description || "Secure Battery Telemetry & Diagnostics Tier",
    order_id: orderData.order_id,
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      try {
        // Send payment_id, order_id, signature to backend verify endpoint (Step 3)
        const verification = await verifyRazorpayPayment({
          order_id: response.razorpay_order_id,
          payment_id: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });

        options.onSuccess?.({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          verification,
        });
      } catch (verifyErr: any) {
        const errorMsg =
          verifyErr.response?.data?.error ||
          verifyErr.message ||
          "Payment signature verification failed on server.";
        options.onError?.({ message: errorMsg, originalError: verifyErr });
      }
    },
    prefill: options.prefill || {
      name: "Fleet Administrator",
      email: "admin@trustsense-fleet.com",
      contact: "9876543210",
    },
    theme: {
      color: options.themeColor || "#0284c7",
    },
    send_sms_hash: false,
    retry: {
      enabled: false,
    },
    modal: {
      escape: true,
      backdropclose: true,
      handleback: true,
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      },
    },
  };

  const rzp = new window.Razorpay(rzpOptions);

  // Handle payment.failed event
  rzp.on("payment.failed", (response: any) => {
    console.error("[Razorpay Checkout] Payment failed event:", response.error);
    options.onError?.({
      message: response.error?.description || "Payment failed at checkout gateway.",
      code: response.error?.code,
      reason: response.error?.reason,
      step: response.error?.step,
      source: response.error?.source,
    });
  });

  // Open modal
  rzp.open();
}

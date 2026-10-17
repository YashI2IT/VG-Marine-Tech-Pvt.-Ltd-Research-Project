"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Form";
import { classifyAuthError, login } from "@/services/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.includes("@")) next.email = "Enter a valid email";
    if (password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login({ email, password, rememberMe });
      router.push("/dashboard");
    } catch (err) {
      const classified = classifyAuthError(err);
      setErrors({ form: classified.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[32px] bg-white shadow-[0_20px_60px_rgba(15,39,68,0.08)] lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-[#eff6ff] p-10 lg:flex">
          <BrandMark size={48} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">TrustSense-BMS</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Battery thermal intelligence</h1>
            <p className="mt-3 max-w-sm text-sm text-slate-500">See thermal state, risk, diagnostics, and recommended action — without claiming live ML results.</p>
          </div>
          <div className="rounded-full bg-[#ecfdf5] px-4 py-2 text-sm text-emerald-800">Advisory only · no BMS control</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 p-8 sm:p-10" noValidate>
          <div className="lg:hidden">
            <BrandMark size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">ECUlytics fleet workspace</p>
          </div>
          {errors.form ? (
            <div className="rounded-full bg-rose-50 px-4 py-2 text-sm text-rose-700" role="alert">
              {errors.form}
            </div>
          ) : null}
          <Field label="Email / username" error={errors.email}>
            <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" error={errors.password}>
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <Link href="/forgot-password" className="font-medium text-blue-600 hover:underline">
              Forgot password
            </Link>
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <div className="pt-2 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-blue-600 hover:underline">
              Create an account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

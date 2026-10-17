"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Form";
import { classifyAuthError, register } from "@/services/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};

    if (!name.trim() || name.trim().length < 2) {
      next.name = "Full name must be at least 2 characters";
    }
    if (!email.includes("@") || !email.includes(".")) {
      next.email = "Enter a valid email address";
    }
    if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }
    if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
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
        {/* Left Informational Panel */}
        <div className="hidden flex-col justify-between bg-[#eff6ff] p-10 lg:flex">
          <BrandMark size={48} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
              ECUlytics & TrustSense-BMS
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Create your fleet account
            </h1>
            <p className="mt-3 max-w-sm text-sm text-slate-500">
              Gain instant access to real-time virtual temperature sensing, 5-sigma out-of-distribution validation, and immutable data provenance.
            </p>
            <div className="mt-6 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                <span>Hybrid CNN-LSTM virtual thermal modeling</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                <span>Physics-informed residual plausibility bounds</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                <span>SHA-256 Merkle tree ledger verification</span>
              </div>
            </div>
          </div>
          <div className="rounded-full bg-[#ecfdf5] px-4 py-2 text-sm text-emerald-800">
            Secure Platform · Zero Telemetry Tampering
          </div>
        </div>

        {/* Right Registration Form */}
        <form onSubmit={onSubmit} className="space-y-4 p-8 sm:p-10" noValidate>
          <div className="lg:hidden">
            <BrandMark size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Register Account</h2>
            <p className="mt-1 text-sm text-slate-500">Set up your operator or researcher profile</p>
          </div>

          {errors.form ? (
            <div className="rounded-full bg-rose-50 px-4 py-2 text-sm text-rose-700" role="alert">
              {errors.form}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800" role="status">
              Account created successfully! Redirecting to dashboard…
            </div>
          ) : null}

          <Field label="Full Name" error={errors.name}>
            <TextInput
              type="text"
              autoComplete="name"
              placeholder="e.g. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Work Email" error={errors.email}>
            <TextInput
              type="email"
              autoComplete="email"
              placeholder="name@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password}>
              <TextInput
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Field label="Confirm Password" error={errors.confirmPassword}>
              <TextInput
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          </div>

          <Field label="User Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-full border border-[#dbe7f5] bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="user">Fleet Operator</option>
              <option value="viewer">Technical Analyst / Viewer</option>
              <option value="operator">BMS Safety Engineer</option>
              <option value="admin">Platform Administrator</option>
            </select>
          </Field>

          <Button className="w-full mt-2" disabled={loading || success} type="submit">
            {loading ? "Creating Account…" : "Create Account"}
          </Button>

          <div className="pt-2 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

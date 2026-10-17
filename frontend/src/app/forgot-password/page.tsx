"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Form";
import { classifyAuthError, requestPasswordReset } from "@/services/auth";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setFieldError("Enter a valid email");
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(classifyAuthError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandMark size={48} />
          </div>
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="mt-1 text-sm text-slate-500">We will not reveal whether an account exists.</p>
        </div>
        <div className="panel p-8">
          {success ? (
            <div className="rounded-[24px] bg-[#ecfdf5] px-4 py-5 text-center text-sm text-emerald-800">
              If an account exists for that email, a reset link has been queued. Email delivery is not configured yet.
            </div>
          ) : (
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              {error ? (
                <div className="rounded-full bg-rose-50 px-4 py-2 text-sm text-rose-700" role="alert">
                  {error}
                </div>
              ) : null}
              <Field label="Email" error={fieldError}>
                <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Submitting…" : "Send reset link"}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

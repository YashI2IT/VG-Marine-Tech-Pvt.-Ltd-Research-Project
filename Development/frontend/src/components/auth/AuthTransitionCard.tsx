"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ChevronRight, ArrowLeft, AlertCircle, Check } from "lucide-react";
import { login, register, classifyAuthError } from "@/services/auth";

interface AuthTransitionCardProps {
  initialMode?: "signin" | "register";
}

export function AuthTransitionCard({ initialMode = "signin" }: AuthTransitionCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">(initialMode);

  // Sync mode with prop change
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/register") {
          setMode("register");
        } else if (window.location.pathname === "/login") {
          setMode("signin");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form State
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI Feedback State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Smooth switch mode and synchronize URL
  const switchMode = (newMode: "signin" | "register") => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setMode(newMode);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", newMode === "signin" ? "/login" : "/register");
    }
  };

  // Handle Login Submit
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Please enter a valid company email address");
      return;
    }
    if (loginPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        rememberMe: true,
      });
      if (res.user.role === "admin") {
        router.push("/admin");
      } else if (!res.user.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      const classified = classifyAuthError(err);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle Register Submit
  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!regUsername.trim() || regUsername.trim().length < 2) {
      setErrorMessage("Please enter a valid username");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@") || !regEmail.includes(".")) {
      setErrorMessage("Please enter a valid company email address");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        name: regUsername.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: "user",
      });
      if (res.user.role === "admin") {
        setSuccessMessage("Account created! Redirecting to admin console...");
        setTimeout(() => {
          router.push("/admin");
        }, 1000);
      } else {
        setSuccessMessage("Account created successfully! Redirecting...");
        setTimeout(() => {
          router.push("/onboarding");
        }, 1000);
      }
    } catch (err) {
      const classified = classifyAuthError(err);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center py-8 px-4 sm:px-6 bg-[#f4f6fa] text-slate-800 antialiased font-sans">
      
      {/* Top Bar Link */}
      <div className="w-full max-w-[480px] flex items-center justify-start mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to ECUlytics</span>
        </Link>
      </div>

      {/* Main Authentic Card */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] sm:rounded-[36px] shadow-[0_10px_35px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between overflow-hidden">
        
        {/* Card Main Body */}
        <div className="px-6 sm:px-10 pt-10 pb-8">
          
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2.5 select-none">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-sm">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M12 2L2 22h5l2.5-5.5h5L17 22h5L12 2zm0 6l2 4.5h-4L12 8z" />
                </svg>
              </div>
              <span className="text-2xl font-black tracking-tight text-[#0f172a]">ECUlytics</span>
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="text-center mb-7">
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 leading-snug">
              {mode === "signin" ? "Sign in to your account" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm sm:text-[15px] text-slate-500 font-normal">
              {mode === "signin"
                ? "Sign in with your company credentials"
                : "Register a new company account"}
            </p>
          </div>

          {/* Error / Success Notifications */}
          {errorMessage && (
            <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200/90 px-4 py-3 text-sm text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-200/90 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Google SSO Button */}
          <button
            type="button"
            onClick={() => {
              setErrorMessage("Google SSO is configured in production. Please enter your credentials below.");
            }}
            className="w-full py-3.5 px-4 bg-white border border-slate-200/90 hover:bg-slate-50 rounded-2xl text-sm sm:text-[15px] font-medium text-slate-700 transition-all flex items-center justify-center gap-3 shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Right-Aligned "or" Divider matching user reference */}
          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-slate-200/80" />
            <span className="flex-shrink-0 pl-3 text-xs sm:text-sm text-slate-400 font-normal select-none">
              or
            </span>
          </div>

          {/* Dynamic Forms */}
          {mode === "signin" ? (
            /* ================= SIGN IN FORM ================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              
              {/* Company Email */}
              <div>
                <label className="block text-sm sm:text-[15px] font-normal text-slate-800 mb-2">
                  Company Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-150"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm sm:text-[15px] font-normal text-slate-800 mb-2">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-5 h-5 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-5 h-5 stroke-[1.75]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#181d27] hover:bg-[#0f131a] active:bg-[#000000] text-white font-medium text-sm sm:text-[15px] rounded-2xl shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer mt-6 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                ) : null}
                <span>{loading ? "Signing In…" : "Sign In"}</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>
          ) : (
            /* ================= REGISTER FORM ================= */
            <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
              
              {/* Username */}
              <div>
                <label className="block text-sm sm:text-[15px] font-normal text-slate-800 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-150"
                />
              </div>

              {/* Company Email */}
              <div>
                <label className="block text-sm sm:text-[15px] font-normal text-slate-800 mb-2">
                  Company Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Enter your company email"
                  className="w-full px-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-150"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm sm:text-[15px] font-normal text-slate-800 mb-2">
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 font-normal focus:outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-5 h-5 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-5 h-5 stroke-[1.75]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#181d27] hover:bg-[#0f131a] active:bg-[#000000] text-white font-medium text-sm sm:text-[15px] rounded-2xl shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer mt-6 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />
                ) : null}
                <span>{loading ? "Registering…" : "Register"}</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>
          )}

        </div>

        {/* Card Footer Switcher */}
        <div className="w-full bg-[#fcfdfe] border-t border-slate-100 py-5 px-6 text-center text-sm sm:text-[15px] text-slate-600">
          {mode === "signin" ? (
            <span>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-bold text-slate-900 hover:underline transition-all cursor-pointer ml-0.5"
              >
                Register Here
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-bold text-slate-900 hover:underline transition-all cursor-pointer ml-0.5"
              >
                Sign In
              </button>
            </span>
          )}
        </div>

      </div>

      {/* Bottom Secured Badge */}
      <div className="mt-8 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-500 select-none">
        <span>Secured by</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span>ECUlytics · TrustSense-BMS</span>
        </span>
      </div>

    </div>
  );
}

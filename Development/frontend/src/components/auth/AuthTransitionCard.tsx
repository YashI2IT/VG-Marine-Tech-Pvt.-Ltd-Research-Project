"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  Check, 
  ChevronDown
} from "lucide-react";
import { login, register, classifyAuthError } from "@/services/auth";

interface AuthTransitionCardProps {
  initialMode?: "signin" | "register";
}

export function AuthTransitionCard({ initialMode = "signin" }: AuthTransitionCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">(initialMode);
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState("");
  const [regWorkEmail, setRegWorkEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState("Fleet Operator");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

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

  // Role mapping for backend enum ["user", "admin", "operator", "viewer"]
  const mapRoleToBackend = (roleLabel: string): string => {
    switch (roleLabel) {
      case "Fleet Operator":
        return "user";
      case "Technical Analyst / Viewer":
        return "viewer";
      case "BMS Safety Engineer":
        return "operator";
      case "Platform Administrator":
        return "admin";
      default:
        return "user";
    }
  };

  // Handle Login Submit
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      return;
    }
    if (loginPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
        rememberMe,
      });
      router.push("/dashboard");
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

    if (!regFullName.trim() || regFullName.trim().length < 2) {
      setErrorMessage("Please enter your full name");
      return;
    }
    if (!regWorkEmail.trim() || !regWorkEmail.includes("@") || !regWorkEmail.includes(".")) {
      setErrorMessage("Please enter a valid work email address");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: regFullName.trim(),
        email: regWorkEmail.trim().toLowerCase(),
        password: regPassword,
        role: mapRoleToBackend(regRole),
      });
      setSuccessMessage("Account created successfully! Taking you to the fleet workspace...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      const classified = classifyAuthError(err);
      setErrorMessage(classified.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 lg:p-10 bg-[#f4f5f8]">
      {/* Outer Card with Arcana-style rounded contours and shadow */}
      <div className="w-full max-w-5xl bg-white rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border border-slate-100">
        
        {/* Left Form Area */}
        <div className="lg:col-span-6 px-2 sm:px-6 lg:px-8 py-3 sm:py-6 flex flex-col justify-between min-h-[580px]">
          
          <div>
            {/* Top Brand Logo and Transition Pills */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                {/* Arcana-style Geometric Monogram */}
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-md">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                    <path d="M12 2L2 22h5l2.5-5.5h5L17 22h5L12 2zm0 6l2 4.5h-4L12 8z" />
                  </svg>
                </div>
                <div className="leading-tight">
                  <span className="text-lg font-bold tracking-tight text-slate-900 block">ECUlytics</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Fleet Workspace</span>
                </div>
              </div>

              {/* Seamless Pill Transition Switcher */}
              <div className="flex items-center p-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={`px-3.5 py-1.5 rounded-full transition-all duration-300 ${
                    mode === "signin"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={`px-3.5 py-1.5 rounded-full transition-all duration-300 ${
                    mode === "register"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Header Titles */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {mode === "signin" ? "Sign in" : "Register Account"}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {mode === "signin"
                  ? "ECUlytics fleet workspace"
                  : "Set up your operator or researcher profile"}
              </p>
            </div>

            {/* Error / Success Banners */}
            {errorMessage && (
              <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200/80 px-4 py-3 text-sm text-rose-700 flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">!</span>
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Dynamic Animated Form */}
            {mode === "signin" ? (
              /* ================= SIGN IN FORM ================= */
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                {/* Email / Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email / username
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="johndoe@gmail.com"
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-11 py-3 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                    />
                    <span>Remember me</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-slate-700 hover:text-slate-900 hover:underline transition-colors"
                  >
                    Forgot password
                  </Link>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#111215] hover:bg-black text-white font-medium text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  <span>{loading ? "Signing in…" : "Sign in"}</span>
                </button>

                {/* Switch to Register */}
                <div className="text-center text-xs text-slate-500 pt-2">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-bold text-slate-900 hover:underline transition-colors"
                  >
                    Create an account
                  </button>
                </div>
              </form>
            ) : (
              /* ================= REGISTER FORM ================= */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Work Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={regWorkEmail}
                      onChange={(e) => setRegWorkEmail(e.target.value)}
                      placeholder="name@organization.com"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                    />
                  </div>
                </div>

                {/* Password & Confirm Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        type={showRegPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Toggle password"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        type={showRegConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Toggle password"
                      >
                        {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* User Role Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    User Role
                  </label>
                  <div className="relative flex items-center">
                    <Shield className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full pl-11 pr-10 py-2.5 bg-white border border-slate-200/90 rounded-2xl text-sm text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5 transition-all appearance-none cursor-pointer"
                    >
                      <option value="Fleet Operator">Fleet Operator</option>
                      <option value="Technical Analyst / Viewer">Technical Analyst / Viewer</option>
                      <option value="BMS Safety Engineer">BMS Safety Engineer</option>
                      <option value="Platform Administrator">Platform Administrator</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 pointer-events-none" />
                  </div>
                </div>

                {/* Create Account Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[#111215] hover:bg-black text-white font-medium text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  <span>{loading ? "Creating Account…" : "Create Account"}</span>
                </button>

                {/* Switch to Sign In */}
                <div className="text-center text-xs text-slate-500 pt-1.5">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="font-bold text-slate-900 hover:underline transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bottom Social Auth (Only Google as requested) */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-center mt-6">
            {/* Google */}
            <button
              type="button"
              className="w-11 h-11 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm hover:scale-105 active:scale-95"
              aria-label="Sign in with Google"
              title="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Right Hero / Showcase Card (Identical Aesthetic to Reference Photo) */}
        <div className="lg:col-span-6 h-full min-h-[580px] bg-[#0c0d12] rounded-[28px] sm:rounded-[36px] p-8 sm:p-10 lg:p-12 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl border border-white/5">
          
          {/* Subtle Ambient Radial Lighting & Diagonal Translucent Beam */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-slate-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-900/15 rounded-full blur-3xl pointer-events-none" />
          
          {/* The signature diagonal glowing beam cutting across the dark backdrop */}
          <div 
            className="absolute top-0 right-0 w-[160%] h-32 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none transform -rotate-45 origin-top-right blur-md"
            style={{ filter: "drop-shadow(0 0 15px rgba(255,255,255,0.15))" }}
          />

          {/* Top Section: 3D Faceted Metallic Chevron Monogram */}
          <div className="relative z-10 flex flex-col items-start">
            {/* The 3D Emblem with faceted metallic shading */}
            <div className="w-28 h-28 relative flex items-center justify-center mb-8">
              <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]">
                <defs>
                  {/* Left Facet Gradient */}
                  <linearGradient id="facetLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a4e59" />
                    <stop offset="50%" stopColor="#2b2e36" />
                    <stop offset="100%" stopColor="#14161a" />
                  </linearGradient>
                  {/* Right Facet Gradient */}
                  <linearGradient id="facetRight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#696f7d" />
                    <stop offset="50%" stopColor="#383d47" />
                    <stop offset="100%" stopColor="#1a1c22" />
                  </linearGradient>
                  {/* Center Cross Bevel */}
                  <linearGradient id="facetCross" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#262930" />
                    <stop offset="100%" stopColor="#0e0f12" />
                  </linearGradient>
                </defs>

                {/* Left Leg of 3D A-Chevron */}
                <polygon points="100,20 40,165 72,165 100,85" fill="url(#facetLeft)" />
                {/* Right Leg of 3D A-Chevron */}
                <polygon points="100,20 160,165 128,165 100,85" fill="url(#facetRight)" />
                {/* Center Cross Beam */}
                <polygon points="68,125 132,125 120,145 80,145" fill="url(#facetCross)" />
                {/* Beveled Top Crown Highlight */}
                <polygon points="96,20 100,16 104,20 100,28" fill="#8b93a4" />
              </svg>
            </div>

            {/* Arcana-Style Subtitle */}
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-3">
              ECUlytics Fleet Platform
            </p>

            {/* Headline */}
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
              Welcome to ECUlytics
            </h2>

            {/* Description */}
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-sm mb-4">
              ECUlytics helps fleet operators and safety engineers monitor, validate, and secure battery thermal intelligence in real-time. Join us and verify your mission-critical energy storage.
            </p>

            {/* Stats count */}
            <p className="text-[11px] font-medium text-slate-500">
              More than 1,240+ battery modules verified across marine fleets.
            </p>
          </div>

          {/* Bottom Floating Rounded Dark Badge (Exact shape and avatars from image) */}
          <div className="relative z-10 mt-8 bg-[#18191f]/95 border border-white/10 rounded-2xl sm:rounded-3xl p-5 backdrop-blur-md shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="max-w-xs">
                <h3 className="text-sm sm:text-base font-semibold text-white leading-snug">
                  Mission-critical safety at sea
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Be among the first engineers to experience verifiable deep learning virtual temperature sensing.
                </p>
              </div>

              {/* Avatar Pile with +4 Badge */}
              <div className="flex items-center -space-x-2 flex-shrink-0">
                {/* Avatar 1 */}
                <div className="w-8 h-8 rounded-full border-2 border-[#18191f] bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shadow-sm">
                  <span className="bg-emerald-600 w-full h-full flex items-center justify-center">YB</span>
                </div>
                {/* Avatar 2 */}
                <div className="w-8 h-8 rounded-full border-2 border-[#18191f] bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shadow-sm">
                  <span className="bg-blue-600 w-full h-full flex items-center justify-center">SD</span>
                </div>
                {/* Avatar 3 */}
                <div className="w-8 h-8 rounded-full border-2 border-[#18191f] bg-violet-700 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shadow-sm">
                  <span className="bg-purple-600 w-full h-full flex items-center justify-center">KS</span>
                </div>
                {/* +4 Badge */}
                <div className="w-8 h-8 rounded-full border-2 border-[#18191f] bg-[#2d3039] flex items-center justify-center text-[10px] font-bold text-slate-200 shadow-sm">
                  +4
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  LogOut,
  ShieldAlert,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import { getSession, logout, AuthUser } from "@/services/auth";
import {
  getOnboardingStatus,
  saveOnboardingDraft,
  completeOnboarding,
  CompanyProfile,
} from "@/services/onboarding";

// Indian GSTIN regular expression
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const INDUSTRIES = [
  "Marine",
  "Automotive",
  "Energy",
  "Battery Manufacturing",
  "Fleet Operations",
  "Other",
];

const ORGANIZATION_TYPES = [
  "Company",
  "Fleet Operator",
  "Manufacturer",
  "Service Provider",
  "Other",
];

const FLEET_SIZES = [
  "1 - 10 systems",
  "11 - 50 systems",
  "51 - 200 systems",
  "201 - 500 systems",
  "500+ systems",
];

const PRIMARY_APPLICATIONS = [
  "Fleet Management & Telematics",
  "Battery Monitoring & Diagnostics",
  "Thermal Intelligence & Hotspot Prevention",
  "Marine Safety & Vessel Compliance",
  "Other Industrial Storage",
];

const COUNTRIES = [
  "India",
  "United States",
  "Germany",
  "Singapore",
  "United Kingdom",
  "United Arab Emirates",
  "Australia",
  "Japan",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();

  // Authentication & Initial Loading
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState<CompanyProfile>({
    companyName: "",
    industry: "Marine",
    website: "",
    contactEmail: "",
    organizationType: "Fleet Operator",
    isGstRegistered: true,
    gstin: "",
    country: "India",
    state: "",
    city: "",
    postalCode: "",
    address: "",
    fleetSize: "11 - 50 systems",
    primaryApplication: "Marine Safety & Vessel Compliance",
    description: "",
  });

  // UI States
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);

  // 1. Initial Load & Route Guard
  useEffect(() => {
    async function init() {
      try {
        const user = await getSession();
        setCurrentUser(user);

        // If admin, redirect to admin console
        if (user.role === "admin") {
          router.replace("/admin");
          return;
        }

        // If user already completed onboarding, proceed directly to dashboard
        if (user.onboardingCompleted) {
          router.replace("/dashboard");
          return;
        }

        // Load existing draft or company data from PostgreSQL
        try {
          const status = await getOnboardingStatus();
          if (status.company) {
            setFormData((prev) => ({
              ...prev,
              companyName: status.company?.companyName || prev.companyName,
              industry: status.company?.industry || prev.industry,
              website: status.company?.website || prev.website,
              contactEmail: status.company?.contactEmail || user.email || prev.contactEmail,
              organizationType: status.company?.organizationType || prev.organizationType,
              isGstRegistered: status.company?.isGstRegistered ?? prev.isGstRegistered,
              gstin: status.company?.gstin || prev.gstin,
              country: status.company?.country || prev.country,
              state: status.company?.state || prev.state,
              city: status.company?.city || prev.city,
              postalCode: status.company?.postalCode || prev.postalCode,
              address: status.company?.address || prev.address,
              fleetSize: status.company?.fleetSize || prev.fleetSize,
              primaryApplication: status.company?.primaryApplication || prev.primaryApplication,
              description: status.company?.description || prev.description,
            }));
          } else {
            // Default contact email to user's registered email
            if (user.email) {
              setFormData((prev) => ({ ...prev, contactEmail: user.email }));
            }
          }
        } catch {
          // Fallback to user email if draft load fails
          if (user.email) {
            setFormData((prev) => ({ ...prev, contactEmail: user.email }));
          }
        }
      } catch {
        router.replace("/login");
      } finally {
        setInitialLoading(false);
      }
    }

    init();
  }, [router]);

  // Handle Input Changes
  const handleChange = (
    field: keyof CompanyProfile,
    value: string | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error upon edit
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Step Validations
  const validateStep = (stepNumber: number): boolean => {
    const errors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.companyName.trim() || formData.companyName.trim().length < 2) {
        errors.companyName = "Company name must be at least 2 characters";
      }
      if (!formData.industry) {
        errors.industry = "Please select an industry";
      }
      if (!formData.contactEmail.trim() || !formData.contactEmail.includes("@") || !formData.contactEmail.includes(".")) {
        errors.contactEmail = "Please enter a valid business contact email";
      }
      if (!formData.organizationType) {
        errors.organizationType = "Please select an organization type";
      }
      if (formData.website && formData.website.trim() !== "") {
        const web = formData.website.trim();
        if (!/^https?:\/\/.+/i.test(web) && !/^[\w-]+\.[\w.-]+/i.test(web)) {
          errors.website = "Please enter a valid website address (e.g., https://example.com)";
        }
      }
    }

    if (stepNumber === 2) {
      if (formData.isGstRegistered) {
        if (!formData.gstin || formData.gstin.trim() === "") {
          errors.gstin = "GSTIN is required for GST-registered companies. If exempt, check the box below.";
        } else {
          const cleanGstin = formData.gstin.trim().toUpperCase();
          if (!GSTIN_REGEX.test(cleanGstin)) {
            errors.gstin = "Invalid GSTIN format (15 characters expected, e.g., 27AABCV1234F1Z5)";
          }
        }
      }
    }

    if (stepNumber === 3) {
      if (!formData.country.trim()) {
        errors.country = "Country is required";
      }
      if (!formData.state?.trim()) {
        errors.state = "State or region is required";
      }
      if (!formData.city.trim()) {
        errors.city = "City is required";
      }
      if (!formData.postalCode.trim() || formData.postalCode.trim().length < 3) {
        errors.postalCode = "Please enter a valid postal code (e.g., 400001)";
      }
      if (!formData.address.trim() || formData.address.trim().length < 5) {
        errors.address = "Please enter your registered street address";
      }
    }

    if (stepNumber === 4) {
      if (!formData.fleetSize) {
        errors.fleetSize = "Please select approximate fleet or battery system count";
      }
      if (!formData.primaryApplication) {
        errors.primaryApplication = "Please select a primary application";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Draft (Available anytime)
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    setFeedbackMessage(null);
    try {
      await saveOnboardingDraft(formData);
      setFeedbackMessage({
        type: "success",
        text: "Draft progress safely saved to PostgreSQL. You can resume anytime.",
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err?.response?.data?.error || "Failed to save draft progress to database.",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Next Step with Auto-Save
  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    // Proactively save draft to PostgreSQL when advancing steps
    try {
      await saveOnboardingDraft(formData);
    } catch {
      // Non-blocking draft save
    }

    setFeedbackMessage(null);
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrev = () => {
    setFeedbackMessage(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Complete Onboarding Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      setFeedbackMessage({
        type: "error",
        text: "Please resolve the highlighted field errors before completing onboarding.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const res = await completeOnboarding(formData);
      setIsCompletedModalOpen(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to complete onboarding. Please check all fields.";
      setFeedbackMessage({
        type: "error",
        text: msg,
      });
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600">Verifying onboarding profile...</p>
      </div>
    );
  }

  const steps = [
    { num: 1, label: "Company Information", icon: Building2 },
    { num: 2, label: "Business Registration", icon: FileText },
    { num: 3, label: "Registered Address", icon: MapPin },
    { num: 4, label: "Fleet Profile", icon: Truck },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-slate-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-md">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M12 2L2 22h5l2.5-5.5h5L17 22h5L12 2zm0 6l2 4.5h-4L12 8z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">ECUlytics</span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                Onboarding
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              TrustSense-BMS Industrial Fleet Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-slate-800">{currentUser.name || currentUser.email}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Banner Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Company Onboarding
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Please provide your company details to set up your dedicated tenant workspace, configure your fleet boundaries, and unlock the ECUlytics user dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {isSavingDraft ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Save className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{isSavingDraft ? "Saving..." : "Save Progress"}</span>
            </button>
          </div>

          {/* Stepper Indicator */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {steps.map((s) => {
                const IconComponent = s.icon;
                const isActive = currentStep === s.num;
                const isPassed = currentStep > s.num;

                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (isPassed) setCurrentStep(s.num);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      isActive
                        ? "border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600/20"
                        : isPassed
                        ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        : "border-slate-200 bg-white opacity-60 cursor-default"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : isPassed
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <IconComponent className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                        Step 0{s.num}
                      </p>
                      <p className={`text-xs font-bold truncate ${isActive ? "text-blue-950" : "text-slate-700"}`}>
                        {s.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-3 border ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : feedbackMessage.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedbackMessage.text}</div>
          </div>
        )}

        {/* Form Body */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <form onSubmit={handleSubmit} noValidate>
            {/* ======================================================== */}
            {/* STEP 1: Company Information                              */}
            {/* ======================================================== */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Section A — Company Information
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Basic identification details for your organization.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Company Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company / Organization Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleChange("companyName", e.target.value)}
                      placeholder="e.g. VG Marine Tech Pvt. Ltd"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.companyName
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.companyName && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.companyName}</p>
                    )}
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Industry Sector <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.industry}
                      onChange={(e) => handleChange("industry", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Organization Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Organization Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.organizationType}
                      onChange={(e) => handleChange("organizationType", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {ORGANIZATION_TYPES.map((org) => (
                        <option key={org} value={org}>
                          {org}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Contact Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company Contact Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleChange("contactEmail", e.target.value)}
                      placeholder="contact@vgmarine.com"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.contactEmail
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.contactEmail && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.contactEmail}</p>
                    )}
                  </div>

                  {/* Company Website */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Company Website <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="url"
                      value={formData.website || ""}
                      onChange={(e) => handleChange("website", e.target.value)}
                      placeholder="https://vgmarine.com"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.website
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.website && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.website}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: Business Registration & Tax ID                   */}
            {/* ======================================================== */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Section B — Business Registration & Tax ID
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    GSTIN tax identification and entity registration.
                  </p>
                </div>

                {/* Disclaimer Alert */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Notice on Tax ID Verification:</p>
                    <p className="mt-0.5 text-amber-800">
                      The GSTIN format is cryptographically validated according to the official Indian standard (15 characters: State Code + PAN + Entity ID + Z + Checksum). Direct live government GST portal validation is not connected in this tier.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* GST Registration Checkbox Toggle */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!formData.isGstRegistered}
                        onChange={(e) => {
                          const isExempt = e.target.checked;
                          handleChange("isGstRegistered", !isExempt);
                          if (isExempt) {
                            handleChange("gstin", "");
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">
                          This company is not GST-registered
                        </span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Check this box if your organization is exempt, overseas, or operates below the mandatory GST turnover threshold.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* GSTIN Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GST Identification Number (GSTIN){" "}
                      {formData.isGstRegistered ? (
                        <span className="text-rose-500">*</span>
                      ) : (
                        <span className="text-slate-400 font-normal">(Exempt)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      disabled={!formData.isGstRegistered}
                      value={formData.gstin || ""}
                      onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
                      placeholder={
                        formData.isGstRegistered
                          ? "e.g. 27AABCV1234F1Z5"
                          : "Not Applicable (Company is not GST-registered)"
                      }
                      maxLength={15}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 outline-none uppercase font-mono tracking-wider transition ${
                        !formData.isGstRegistered
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : fieldErrors.gstin
                          ? "border-rose-400 bg-rose-50/20 focus:ring-2 focus:ring-rose-500/20"
                          : "bg-white border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      }`}
                    />
                    {fieldErrors.gstin && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.gstin}</p>
                    )}
                    {formData.isGstRegistered && formData.gstin && formData.gstin.length === 15 && (
                      <p
                        className={`text-xs mt-1.5 flex items-center gap-1 font-medium ${
                          GSTIN_REGEX.test(formData.gstin)
                            ? "text-emerald-700"
                            : "text-rose-600"
                        }`}
                      >
                        {GSTIN_REGEX.test(formData.gstin) ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valid 15-character GSTIN structure format
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Format does not match standard GSTIN pattern
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 3: Business Address                                 */}
            {/* ======================================================== */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Section C — Business Address
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical registered headquarters or principal place of business.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Country */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleChange("country", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* State / Region */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State / Region / Province <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.state || ""}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="e.g. Maharashtra"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.state
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.state && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.state}</p>
                    )}
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="e.g. Mumbai"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.city
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.city && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.city}</p>
                    )}
                  </div>

                  {/* Postal Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Postal Code / PIN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleChange("postalCode", e.target.value)}
                      placeholder="e.g. 400001"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.postalCode
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.postalCode && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.postalCode}</p>
                    )}
                  </div>

                  {/* Registered Address */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Street Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      placeholder="e.g. Plot No. 42, Marine Industrial Estate, Off Harbor Expressway"
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-900 bg-white outline-none transition focus:ring-2 focus:ring-blue-500/20 ${
                        fieldErrors.address
                          ? "border-rose-400 bg-rose-50/20"
                          : "border-slate-200 focus:border-blue-500"
                      }`}
                    />
                    {fieldErrors.address && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.address}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 4: Fleet Profile & Operations                       */}
            {/* ======================================================== */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Section D — Fleet Profile & Use Case
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vehicle and battery management scope for ECUlytics telematics configuration.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Fleet Size */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Approximate Systems / Vehicles Monitored <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.fleetSize}
                      onChange={(e) => handleChange("fleetSize", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {FLEET_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Application */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Application Use Case <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.primaryApplication}
                      onChange={(e) => handleChange("primaryApplication", e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {PRIMARY_APPLICATIONS.map((app) => (
                        <option key={app} value={app}>
                          {app}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Operational Requirements & Use Case Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description || ""}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder="e.g. Electric marine passenger vessel fleet operating on inland waterways with 18650 NCA lithium packs."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80">
                  <div className="flex items-center gap-2 text-blue-900 text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Ready to Activate ECUlytics Workspace
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    By submitting this profile, your organization entity <strong className="text-blue-950 font-semibold">{formData.companyName || "Your Company"}</strong> will be initialized in PostgreSQL, assigned appropriate tenant governance boundaries, and connected to the TrustSense-BMS predictive telematics engine.
                  </p>
                </div>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                ) : (
                  <div />
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] px-5 py-2.5 rounded-xl transition shadow-sm shadow-blue-200"
                  >
                    Continue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-xl transition shadow-sm shadow-emerald-200 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving & Finalizing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Onboarding & Enter Dashboard
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Completion Modal Popup */}
      {isCompletedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Onboarding Complete!
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              Your company profile for <strong className="text-slate-900">{formData.companyName}</strong> has been registered successfully in PostgreSQL.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to ECUlytics Dashboard...
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        © 2026 ECUlytics & VG Marine Tech Pvt. Ltd. All rights reserved.
      </footer>
    </div>
  );
}

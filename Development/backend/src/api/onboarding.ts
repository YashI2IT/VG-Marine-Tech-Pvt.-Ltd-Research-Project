import { Router, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { requireAuth, AuthenticatedRequest, getJwtSecret, AuthenticatedUser } from "../middleware/auth";

const router = Router();

// Require authentication for all onboarding routes
router.use(requireAuth);

// Indian GSTIN validation regex: 15 alphanumeric characters
// 2 state digits, 10 PAN characters (5 letters, 4 digits, 1 letter), 1 entity digit, 'Z', 1 checksum char
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const INDUSTRY_OPTIONS = [
  "Marine",
  "Automotive",
  "Energy",
  "Battery Manufacturing",
  "Fleet Operations",
  "Other",
] as const;

export const ORG_TYPE_OPTIONS = [
  "Company",
  "Fleet Operator",
  "Manufacturer",
  "Service Provider",
  "Other",
] as const;

export const PRIMARY_APPLICATION_OPTIONS = [
  "Fleet Management & Telematics",
  "Battery Monitoring & Diagnostics",
  "Thermal Intelligence & Hotspot Prevention",
  "Marine Safety & Vessel Compliance",
  "Other Industrial Storage",
] as const;

// Zod Schema for Complete Onboarding Submission
export const completeOnboardingSchema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(255),
  industry: z.string().refine((val) => INDUSTRY_OPTIONS.includes(val as any), {
    message: "Please select a valid industry",
  }),
  website: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || val === "" || /^https?:\/\/.+/i.test(val) || /^[\w-]+\.[\w.-]+/i.test(val), {
      message: "Please enter a valid website URL",
    }),
  contactEmail: z.string().trim().email("Please enter a valid contact email address"),
  organizationType: z.string().refine((val) => ORG_TYPE_OPTIONS.includes(val as any), {
    message: "Please select an organization type",
  }),
  isGstRegistered: z.boolean().default(true),
  gstin: z.string().trim().optional(),
  country: z.string().trim().min(2, "Country is required").max(100),
  state: z.string().trim().min(2, "State or region is required").max(100),
  city: z.string().trim().min(2, "City is required").max(100),
  postalCode: z.string().trim().min(3, "Valid postal code is required").max(20),
  address: z.string().trim().min(5, "Registered address must be at least 5 characters"),
  fleetSize: z.string().trim().min(1, "Please specify your approximate fleet or battery system count"),
  primaryApplication: z.string().trim().min(2, "Please select a primary application"),
  description: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.isGstRegistered) {
    if (!data.gstin || data.gstin.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "GSTIN is required when company is marked as GST-registered. Alternatively, check 'Company is not GST-registered'.",
      });
    } else {
      const normalizedGstin = data.gstin.trim().toUpperCase();
      if (!GSTIN_REGEX.test(normalizedGstin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gstin"],
          message: "Invalid GSTIN format. Standard Indian GSTIN must be 15 alphanumeric characters (e.g., 27AABCV1234F1Z5).",
        });
      }
    }
  }
});

// Zod Schema for Saving Draft Progress
export const draftOnboardingSchema = z.object({
  companyName: z.string().trim().max(255).optional(),
  industry: z.string().trim().max(100).optional(),
  website: z.string().trim().max(255).optional(),
  contactEmail: z.string().trim().optional().refine((val) => !val || z.string().email().safeParse(val).success, {
    message: "Invalid email format in draft",
  }),
  organizationType: z.string().trim().max(100).optional(),
  isGstRegistered: z.boolean().optional(),
  gstin: z.string().trim().max(50).optional(),
  country: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(50).optional(),
  address: z.string().trim().optional(),
  fleetSize: z.string().trim().max(50).optional(),
  primaryApplication: z.string().trim().max(100).optional(),
  description: z.string().trim().optional(),
});

// --- GET /api/onboarding ---
// Returns existing company profile, onboarding status, and tenant details
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenantId || 1;

    // Fetch tenant
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    // Fetch company profile for this tenant
    const [profile] = await db
      .select()
      .from(schema.companyProfiles)
      .where(eq(schema.companyProfiles.tenantId, tenantId))
      .limit(1);

    // Fetch user for latest onboarding status
    const [dbUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);

    const onboardingCompleted = dbUser?.onboardingCompleted ?? (user.role === "admin");

    res.json({
      onboardingCompleted,
      company: profile || null,
      tenant: tenant || { id: tenantId, name: "Default Organization" },
    });
  } catch (err: any) {
    console.error("Error retrieving onboarding profile:", err);
    res.status(500).json({ error: "Failed to load onboarding status from database" });
  }
});

// --- POST /api/onboarding/draft ---
// Saves intermediate form values so progress is preserved across refreshes/re-logins
router.post("/draft", async (req: AuthenticatedRequest, res: Response) => {
  const result = draftOnboardingSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid draft values",
      details: result.error.issues,
    });
  }

  try {
    const user = req.user!;
    const tenantId = user.tenantId || 1;
    const data = result.data;

    const values = {
      tenantId,
      userId: user.id,
      companyName: data.companyName || "Draft Company",
      industry: data.industry || "Other",
      website: data.website || null,
      contactEmail: data.contactEmail || user.email,
      organizationType: data.organizationType || "Company",
      gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
      isGstRegistered: data.isGstRegistered ?? true,
      country: data.country || "India",
      state: data.state || null,
      city: data.city || "Mumbai",
      postalCode: data.postalCode || "400001",
      address: data.address || "Pending Address",
      fleetSize: data.fleetSize || "1 - 10 systems",
      primaryApplication: data.primaryApplication || "Battery Monitoring & Diagnostics",
      description: data.description || null,
      isCompleted: false,
      updatedAt: new Date(),
    };

    const [saved] = await db
      .insert(schema.companyProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: schema.companyProfiles.tenantId,
        set: values,
      })
      .returning();

    if (data.companyName && data.companyName.trim().length >= 2) {
      await db
        .update(schema.tenants)
        .set({ name: data.companyName.trim() })
        .where(eq(schema.tenants.id, tenantId));
    }

    res.json({
      message: "Onboarding draft saved successfully",
      company: saved,
    });
  } catch (err: any) {
    console.error("Error saving onboarding draft:", err);
    res.status(500).json({ error: "Failed to persist onboarding draft" });
  }
});

// --- POST /api/onboarding/complete ---
// Validates all required fields, saves company profile, updates tenant and user status
router.post("/complete", async (req: AuthenticatedRequest, res: Response) => {
  const result = completeOnboardingSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Please complete all required fields",
      details: result.error.issues,
    });
  }

  const data = result.data;

  try {
    const user = req.user!;
    const tenantId = user.tenantId || 1;
    const normalizedGstin = data.isGstRegistered && data.gstin ? data.gstin.trim().toUpperCase() : null;

    const values = {
      tenantId,
      userId: user.id,
      companyName: data.companyName,
      industry: data.industry,
      website: data.website || null,
      contactEmail: data.contactEmail,
      organizationType: data.organizationType,
      gstin: normalizedGstin,
      isGstRegistered: data.isGstRegistered,
      country: data.country,
      state: data.state,
      city: data.city,
      postalCode: data.postalCode,
      address: data.address,
      fleetSize: data.fleetSize,
      primaryApplication: data.primaryApplication,
      description: data.description || null,
      isCompleted: true,
      updatedAt: new Date(),
    };

    // Upsert company profile (prevent duplicates on repeated submission)
    const [savedProfile] = await db
      .insert(schema.companyProfiles)
      .values(values)
      .onConflictDoUpdate({
        target: schema.companyProfiles.tenantId,
        set: values,
      })
      .returning();

    // Update tenant name
    await db
      .update(schema.tenants)
      .set({ name: data.companyName })
      .where(eq(schema.tenants.id, tenantId));

    // Update user onboardingCompleted flag
    await db
      .update(schema.users)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // Re-issue updated JWT token with onboardingCompleted: true
    const updatedUserPayload: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenantId,
      onboardingCompleted: true,
    };

    const secret = getJwtSecret();
    const refreshedToken = jwt.sign(updatedUserPayload, secret, { expiresIn: "1d" });

    res.cookie("token", refreshedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Company onboarding completed successfully! Welcome to ECUlytics.",
      user: updatedUserPayload,
      company: savedProfile,
      token: refreshedToken,
    });
  } catch (err: any) {
    console.error("Error completing company onboarding:", err);
    res.status(500).json({ error: "Failed to finalize company onboarding in database" });
  }
});

export default router;

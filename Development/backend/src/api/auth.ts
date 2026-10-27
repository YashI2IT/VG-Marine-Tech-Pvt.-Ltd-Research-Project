import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { requireAuth, AuthenticatedRequest, getJwtSecret } from "../middleware/auth";

const router = Router();

// Zod schemas
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["user", "admin", "operator", "viewer"]).optional().default("user"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

// Helper to hash password with salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Helper to verify password (supports both salt:hash and legacy plain text fallback)
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, originalHash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(testHash, "hex"));
}

// --- POST /register ---
router.post("/register", async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid input data",
      details: result.error.issues,
    });
  }

  const { name, email, password, role } = result.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if user already exists in PostgreSQL
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Insert new user into PostgreSQL
    const isOnboardingComplete = role === "admin";
    const [newUser] = await db
      .insert(schema.users)
      .values({
        name: name?.trim() || normalizedEmail.split("@")[0] || "User",
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        role: role || "user",
        status: "active",
        onboardingCompleted: isOnboardingComplete,
      })
      .returning();

    // If role is admin, assign to default platform tenant 1; otherwise create dedicated organization tenant
    let tenantId = 1;
    if (role === "admin") {
      const [assignedTenant] = await db
        .insert(schema.tenantUsers)
        .values({
          tenantId: 1,
          userId: newUser.id,
        })
        .onConflictDoNothing()
        .returning();
      tenantId = assignedTenant?.tenantId || 1;
    } else {
      const orgName = name?.trim() ? `${name.trim()}'s Organization` : "New Organization";
      const [newTenant] = await db
        .insert(schema.tenants)
        .values({
          name: orgName,
        })
        .returning();
      
      await db
        .insert(schema.tenantUsers)
        .values({
          tenantId: newTenant.id,
          userId: newUser.id,
        })
        .onConflictDoNothing();
      
      tenantId = newTenant.id;
    }

    // Issue JWT token and set authentication cookie
    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name || undefined,
      tenantId,
      onboardingCompleted: newUser.onboardingCompleted,
    };

    const secret = getJwtSecret();
    const token = jwt.sign(payload, secret, { expiresIn: "1d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: "Registration successful",
      user: payload,
      token,
    });
  } catch (err) {
    console.error("Registration error in PostgreSQL:", err);
    return res.status(500).json({ error: "Failed to register user. Database error." });
  }
});

// --- POST /login ---
router.post("/login", async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid input",
      details: result.error.issues,
    });
  }

  const { email, password, rememberMe } = result.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Find user in PostgreSQL
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    // Fallback seed ONLY in non-production environments if credentials match standard defaults
    if (!user && process.env.NODE_ENV !== "production") {
      if (normalizedEmail === "admin@eculytics.com" && password === "password123") {
        [user] = await db
          .insert(schema.users)
          .values({
            name: "System Administrator",
            email: "admin@eculytics.com",
            passwordHash: hashPassword("password123"),
            role: "admin",
            status: "active",
          })
          .returning();
      } else if (normalizedEmail === "user@vgmarine.com" && password === "password123") {
        [user] = await db
          .insert(schema.users)
          .values({
            name: "VG Marine Operator",
            email: "user@vgmarine.com",
            passwordHash: hashPassword("password123"),
            role: "user",
            status: "active",
          })
          .returning();
      }
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Determine tenantId
    const [tenantAssoc] = await db
      .select()
      .from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, user.id))
      .limit(1);

    const tenantId = tenantAssoc?.tenantId || 1;
    const onboardingCompleted = user.onboardingCompleted ?? (user.role === "admin");

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || undefined,
      tenantId,
      onboardingCompleted,
    };

    const secret = getJwtSecret();
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const token = jwt.sign(payload, secret, { expiresIn: rememberMe ? "7d" : "1d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
    });

    return res.json({
      message: "Login successful",
      user: payload,
      token,
    });
  } catch (err) {
    console.error("Login error in PostgreSQL:", err);
    return res.status(500).json({ error: "Database authentication failure." });
  }
});

// --- POST /logout ---
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// --- POST /forgot-password ---
router.post("/forgot-password", (req: Request, res: Response) => {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid email",
      details: result.error.issues,
    });
  }

  res.json({ message: "If the email exists, a password reset link has been sent." });
});

// --- GET /me ---
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const [dbUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user.id))
      .limit(1);

    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const [tenantAssoc] = await db
      .select()
      .from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, dbUser.id))
      .limit(1);

    const tenantId = tenantAssoc?.tenantId || req.user.tenantId || 1;
    const onboardingCompleted = dbUser.onboardingCompleted ?? (dbUser.role === "admin");

    res.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        name: dbUser.name,
        tenantId,
        onboardingCompleted,
      },
    });
  } catch (err) {
    console.error("Error retrieving user session:", err);
    res.status(500).json({ error: "Failed to load session profile" });
  }
});

export default router;

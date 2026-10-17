import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// Zod schemas (using .issues in Zod 4)
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

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
}

// Ensure persistent data directory
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const usersFilePath = path.join(dataDir, "users.json");

// Helper to hash password with salt
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Helper to verify password (supports both salt:hash and legacy plain text fallback)
function verifyPassword(password: string, stored: string): boolean {
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, originalHash] = stored.split(":");
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(testHash, "hex"));
}

// In-memory user cache with file persistence
let usersStore: StoredUser[] = [];

function loadUsers(): void {
  try {
    if (fs.existsSync(usersFilePath)) {
      const data = fs.readFileSync(usersFilePath, "utf-8");
      usersStore = JSON.parse(data);
    } else {
      // Default initial seed users
      usersStore = [
        {
          id: 1,
          name: "System Administrator",
          email: "admin@eculytics.com",
          passwordHash: hashPassword("password123"),
          role: "admin",
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: "VG Marine Operator",
          email: "user@vgmarine.com",
          passwordHash: hashPassword("password123"),
          role: "user",
          createdAt: new Date().toISOString(),
        },
      ];
      saveUsers();
    }
  } catch (err) {
    console.error("Error loading users store:", err);
  }
}

function saveUsers(): void {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(usersStore, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving users store:", err);
  }
}

// Initialize store
loadUsers();

// --- POST /register ---
router.post("/register", (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid input data",
      details: result.error.issues,
    });
  }

  const { name, email, password, role } = result.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existingUser = usersStore.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  // Create new user
  const newId = usersStore.length > 0 ? Math.max(...usersStore.map((u) => u.id)) + 1 : 1;
  const newUser: StoredUser = {
    id: newId,
    name: name?.trim() || normalizedEmail.split("@")[0] || "User",
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: role || "user",
    createdAt: new Date().toISOString(),
  };

  usersStore.push(newUser);
  saveUsers();

  // Issue JWT token and set authentication cookie
  const payload = {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    name: newUser.name,
  };

  const secret = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";
  const token = jwt.sign(payload, secret, { expiresIn: "1d" });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  return res.status(201).json({
    message: "Registration successful",
    user: payload,
  });
});

// --- POST /login ---
router.post("/login", (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues[0]?.message || "Invalid input",
      details: result.error.issues,
    });
  }

  const { email, password, rememberMe } = result.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Find user in user store
  let user = usersStore.find((u) => u.email.toLowerCase() === normalizedEmail);

  // Fallback for hardcoded credentials if store was missing them
  if (!user) {
    if (normalizedEmail === "admin@eculytics.com" && password === "password123") {
      user = {
        id: 1,
        name: "Administrator",
        email: "admin@eculytics.com",
        passwordHash: hashPassword("password123"),
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      usersStore.push(user);
      saveUsers();
    } else if (normalizedEmail === "user@vgmarine.com" && password === "password123") {
      user = {
        id: 2,
        name: "Operator",
        email: "user@vgmarine.com",
        passwordHash: hashPassword("password123"),
        role: "user",
        createdAt: new Date().toISOString(),
      };
      usersStore.push(user);
      saveUsers();
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const secret = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";
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
  });
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

  // Do not expose whether the email exists
  res.json({ message: "If the email exists, a password reset link has been sent." });
});

// --- GET /me ---
router.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;

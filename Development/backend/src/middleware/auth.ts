import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  name?: string;
  tenantId?: number;
  onboardingCompleted?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Returns JWT secret with strict production security enforcement.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    if (!secret || secret.trim() === "" || secret.includes("supersecretkey") || secret.length < 32) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production mode, JWT_SECRET must be set and contain at least 32 characters without placeholder values."
      );
    }
    return secret;
  }
  return secret || "supersecretkey_change_me_in_production";
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: No authenticated user session" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient privileges for this resource" });
    }
    next();
  };
};

export const requireAdmin = requireRole(["admin"]);

export const requireOnboardingComplete = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const proceed = () => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: No authenticated user session" });
    }
    // Admins bypass onboarding
    if (req.user.role === "admin") {
      return next();
    }
    // If explicitly flagged incomplete, block with 403 ONBOARDING_REQUIRED
    if (req.user.onboardingCompleted === false) {
      return res.status(403).json({
        error: "Company onboarding incomplete. Please complete company onboarding to access dashboard resources.",
        code: "ONBOARDING_REQUIRED",
        redirect: "/onboarding",
      });
    }
    next();
  };

  if (!req.user) {
    return requireAuth(req, res, proceed);
  }
  proceed();
};


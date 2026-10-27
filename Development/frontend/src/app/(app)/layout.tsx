"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/States";
import { getSession, AuthUser } from "@/services/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    getSession()
      .then((currentUser) => {
        setUser(currentUser);
        const isAdmin = currentUser.role === "admin";
        const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

        if (isAdmin && !isAdminRoute) {
          // Admin can only see and access the admin dashboard
          router.replace("/admin");
        } else if (!isAdmin && isAdminRoute) {
          // Regular users can only see and access user workspace
          router.replace("/dashboard");
        } else if (!isAdmin && !currentUser.onboardingCompleted) {
          // Incomplete users must complete company onboarding before accessing user dashboard
          router.replace("/onboarding");
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router, pathname]);

  if (loading) return <LoadingState label="Authenticating session..." />;
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  // Block displaying unauthorized area during navigation
  if (isAdmin && !isAdminRoute) {
    return <LoadingState label="Redirecting to Admin Console..." />;
  }
  if (!isAdmin && isAdminRoute) {
    return <LoadingState label="Redirecting to User Workspace..." />;
  }
  if (!isAdmin && !user.onboardingCompleted) {
    return <LoadingState label="Redirecting to Company Onboarding..." />;
  }

  return <AppShell user={user}>{children}</AppShell>;
}

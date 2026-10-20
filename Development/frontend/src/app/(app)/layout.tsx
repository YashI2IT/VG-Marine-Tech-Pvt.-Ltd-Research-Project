"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/States";
import { getSession } from "@/services/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getSession()
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <LoadingState label="Checking session" />;
  if (!user) return null;

  return <AppShell user={user}>{children}</AppShell>;
}

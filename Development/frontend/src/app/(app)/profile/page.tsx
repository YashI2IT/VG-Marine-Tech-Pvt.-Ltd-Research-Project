"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Overlay";
import { DemoBanner } from "@/components/ui/States";
import { currentUser } from "@/data/mock";
import { getSession, logout } from "@/services/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSession()
      .then((u) => {
        setEmail(u.email);
        setRole(u.role);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Signed-in identity for this tenant workspace."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Profile" }]}
      />
      <DemoBanner />
      <Card>
        <div className="flex items-center gap-4">
          <BrandMark size={56} />
          <div>
            <p className="text-lg font-semibold">{currentUser.name}</p>
            <p className="text-sm text-slate-500">{email}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <SectionHeader title="Role" />
            <p className="capitalize text-sm">{role}</p>
          </div>
          <div>
            <SectionHeader title="Tenant" />
            <p className="text-sm">Global Fleet Ops</p>
          </div>
        </div>
        <div className="mt-8">
          <Button variant="danger" type="button" onClick={() => setOpen(true)}>
            Sign out
          </Button>
        </div>
      </Card>
      <Modal
        open={open}
        title="Sign out?"
        confirmLabel="Sign out"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await logout();
          router.push("/login");
        }}
      >
        This ends the current session cookie.
      </Modal>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, Select, TextInput } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { DemoBanner } from "@/components/ui/States";
import { currentUser } from "@/data/mock";
import { useState } from "react";

export default function SettingsPage() {
  const [tab, setTab] = useState("account");
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Workspace preferences. Changes stay in this browser until account APIs exist."
        crumbs={[{ href: "/dashboard", label: "Home" }, { label: "Settings" }]}
        actions={
          <Button type="button" onClick={() => setSaved(true)}>
            Save
          </Button>
        }
      />
      <DemoBanner />
      <Tabs
        tabs={[
          { id: "account", label: "Account" },
          { id: "tenant", label: "Tenant" },
          { id: "alerts", label: "Alert preferences" },
          { id: "display", label: "Display" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Card className="mt-5">
        {saved ? <p className="mb-4 rounded-full bg-[#ecfdf5] px-4 py-2 text-sm text-emerald-800">Preferences stored locally in this session only.</p> : null}
        {tab === "account" ? (
          <div className="max-w-lg space-y-4">
            <SectionHeader title="Account" />
            <Field label="Display name"><TextInput defaultValue={currentUser.name} /></Field>
            <Field label="Email"><TextInput defaultValue={currentUser.email} disabled /></Field>
          </div>
        ) : null}
        {tab === "tenant" ? (
          <div className="max-w-lg space-y-4">
            <SectionHeader title="Tenant" />
            <Field label="Workspace"><TextInput defaultValue="Global Fleet Ops" disabled /></Field>
          </div>
        ) : null}
        {tab === "alerts" ? (
          <div className="max-w-lg space-y-4">
            <SectionHeader title="Alert preferences" />
            <Field label="Critical thermal alerts">
              <Select defaultValue="email">
                <option value="email">Email + in-app</option>
                <option value="inapp">In-app only</option>
              </Select>
            </Field>
            <Field label="Watch-band notifications">
              <Select defaultValue="digest">
                <option value="digest">Daily digest</option>
                <option value="off">Off</option>
              </Select>
            </Field>
          </div>
        ) : null}
        {tab === "display" ? (
          <div className="max-w-lg space-y-4">
            <SectionHeader title="Display" />
            <Field label="Temperature unit">
              <Select defaultValue="c">
                <option value="c">Celsius</option>
                <option value="f">Fahrenheit (display only)</option>
              </Select>
            </Field>
            <p className="text-sm text-slate-500">Light theme is the current product default.</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Form";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryGate } from "@/components/ui/QueryGate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
  type AdminUser,
} from "@/services/admin";
import {
  Key,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useState } from "react";

export default function UserPoolPage() {
  const { data, loading, error, reload } = useAsyncData(() => getAdminUsers(), []);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create User Modal State
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const users = data?.users || [];

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.includes("@") || newPassword.length < 6) {
      setModalError("Please provide a valid email and password (min 6 characters).");
      return;
    }
    setModalLoading(true);
    setModalError(null);
    try {
      await createAdminUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setShowModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      reload();
    } catch (err: any) {
      setModalError(err.response?.data?.error || "Failed to create user.");
    } finally {
      setModalLoading(false);
    }
  }

  async function handleToggleStatus(u: AdminUser) {
    const nextStatus = u.status === "active" ? "suspended" : "active";
    try {
      await updateAdminUser(u.id, { status: nextStatus });
      reload();
    } catch (err) {
      alert("Failed to update status");
    }
  }

  async function handleRoleChange(u: AdminUser, role: string) {
    try {
      await updateAdminUser(u.id, { role });
      reload();
    } catch (err) {
      alert("Failed to update role");
    }
  }

  async function handleDelete(u: AdminUser) {
    if (confirm(`Are you sure you want to remove ${u.email} from the user pool?`)) {
      try {
        await deleteAdminUser(u.id);
        reload();
      } catch (err) {
        alert("Failed to delete user");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="User Pool Management"
          description="View, provision, and audit authenticated operator, analyst, and administrator accounts."
          crumbs={[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/admin", label: "Admin Hub" },
            { label: "User Pool" },
          ]}
        />
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 self-start">
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <QueryGate loading={loading} error={error} onRetry={reload}>
        <div className="space-y-6">
          {/* User Pool KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Registered Users" value={users.length} icon={Users} tone="mint" />
            <KpiCard
              label="Administrators"
              value={users.filter((u) => u.role === "admin").length}
              icon={Shield}
            />
            <KpiCard
              label="Fleet Operators"
              value={users.filter((u) => u.role === "operator" || u.role === "user").length}
              icon={UserCheck}
              tone="mint"
            />
            <KpiCard
              label="Suspended Accounts"
              value={users.filter((u) => u.status === "suspended").length}
              icon={UserX}
              tone={users.some((u) => u.status === "suspended") ? "rose" : undefined}
            />
          </div>

          {/* User Pool Filter & Table */}
          <Card>
            <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-full border border-[#dbe7f5] bg-white py-2 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-blue-400"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-full border border-[#dbe7f5] bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-full border border-[#dbe7f5] bg-white px-3 py-2 text-sm text-slate-700 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <span className="text-xs text-slate-400">Showing {filteredUsers.length} users</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                    <th className="pb-3">User Profile</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Registered Date</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-blue-400"
                        >
                          <option value="admin">admin</option>
                          <option value="operator">operator</option>
                          <option value="user">user</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                      <td className="py-3.5">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                            u.status === "active"
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          {u.status}
                        </button>
                      </td>
                      <td className="py-3.5 text-xs text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(u)}
                          title="Delete User"
                          className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Modal for adding user */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900">Add New User to Pool</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Provision an account with instant platform and telemetry access.
                </p>

                {modalError && (
                  <div className="mt-3 rounded-full bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                    {modalError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
                  <Field label="Full Name">
                    <TextInput
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Jessica Chen"
                      required
                    />
                  </Field>
                  <Field label="Email Address">
                    <TextInput
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jessica@eculytics.com"
                      required
                    />
                  </Field>
                  <Field label="Initial Password">
                    <TextInput
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </Field>
                  <Field label="Assigned Role">
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full rounded-full border border-[#dbe7f5] bg-white px-4 py-2 text-sm text-slate-700 outline-none"
                    >
                      <option value="user">Fleet Operator (user)</option>
                      <option value="operator">BMS Safety Engineer (operator)</option>
                      <option value="viewer">Technical Viewer (viewer)</option>
                      <option value="admin">System Administrator (admin)</option>
                    </select>
                  </Field>

                  <div className="mt-5 flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowModal(false)}
                      disabled={modalLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={modalLoading}>
                      {modalLoading ? "Creating…" : "Save User"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </QueryGate>
    </div>
  );
}

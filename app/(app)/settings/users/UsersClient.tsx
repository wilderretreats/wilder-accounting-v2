"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { Profile, Role } from "@/types";

export function UsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("ops");
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to invite user");
      return;
    }
    setInviteEmail("");
    load();
  }

  async function handleRoleChange(id: string, role: Role) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function handleToggleActive(user: Profile) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.is_active }),
    });
    load();
  }

  async function handleResendInvite(user: Profile) {
    setResendingId(user.id);
    setError(null);
    const res = await fetch(`/api/users/${user.id}/resend-invite`, { method: "POST" });
    const data = await res.json();
    setResendingId(null);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Failed to resend invite");
      return;
    }
    alert(`Sent a new sign-in link to ${user.email}.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Invite a user</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
            <Input
              type="email"
              placeholder="email@wilderretreats.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-64"
            />
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
              <option value="admin">Admin</option>
              <option value="ops">Ops</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-4">
                    <p className="text-zinc-900">{u.full_name ?? u.email}</p>
                    {u.full_name && <p className="text-xs text-zinc-400">{u.email}</p>}
                    {!u.is_active && <Badge tone="red">Deactivated</Badge>}
                  </td>
                  <td className="py-2 pr-4">
                    <Select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      disabled={u.id === currentUserId}
                    >
                      <option value="admin">Admin</option>
                      <option value="ops">Ops</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleResendInvite(u)}
                        disabled={resendingId === u.id}
                        className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
                      >
                        {resendingId === u.id ? "Sending…" : "Resend invite"}
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className="text-xs text-zinc-400 hover:text-zinc-700"
                        >
                          {u.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

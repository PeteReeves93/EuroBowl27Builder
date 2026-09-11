"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string; name: string | null; image: string | null; discordId: string | null;
  role: "MEMBER" | "ADMIN"; accessStatus: "PENDING" | "APPROVED" | "DENIED";
  autoAdmitted: boolean; _count: { rosters: number };
}
interface Settings { accessGateEnabled: boolean; autoAdmitEnabled: boolean; autoAdmitGuildId: string }

export default function AdminConsole() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [u, s] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ]);
    setUsers(u.users ?? []); setSettings(s.settings ?? null); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function patchUser(id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    load();
  }
  async function saveSettings(next: Partial<Settings>) {
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const data = await res.json();
    setSettings(data.settings);
  }

  if (loading) return <p className="text-gray-500">Loading…</p>;

  const pending = users.filter((u) => u.accessStatus === "PENDING");

  return (
    <div className="space-y-6">
      {/* Settings */}
      {settings && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Access settings</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.accessGateEnabled}
              onChange={(e) => saveSettings({ accessGateEnabled: e.target.checked })} />
            <span><b>Require approval</b> — when off, anyone who signs in with Discord gets straight in.</span>
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.autoAdmitEnabled}
              onChange={(e) => saveSettings({ autoAdmitEnabled: e.target.checked })} />
            <span><b>Auto-admit by Discord server</b> — members of the server below are approved automatically.</span>
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Auto-admit server (guild) ID</span>
            <input className="input w-72" defaultValue={settings.autoAdmitGuildId}
              onBlur={(e) => saveSettings({ autoAdmitGuildId: e.target.value.trim() })}
              placeholder="e.g. 123456789012345678" />
          </label>
          <p className="mt-1 text-xs text-gray-400">Tip: right-click your server in Discord (with Developer Mode on) → Copy Server ID.</p>
        </div>
      )}

      {/* Pending */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Pending approvals ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-sm text-gray-500">Nobody waiting.</p> : (
          <ul className="space-y-2">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center gap-3 text-sm">
                <span className="font-medium">{u.name ?? "Unknown"}</span>
                <span className="text-xs text-gray-400">{u.discordId}</span>
                <span className="ml-auto flex gap-2">
                  <button className="btn btn-primary py-1" onClick={() => patchUser(u.id, { accessStatus: "APPROVED" })}>Approve</button>
                  <button className="btn btn-ghost py-1 text-red-600" onClick={() => patchUser(u.id, { accessStatus: "DENIED" })}>Deny</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* All users */}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">All users ({users.length})</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-gray-400">
            <th className="py-1">Name</th><th>Status</th><th>Role</th><th>Rosters</th><th></th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-1.5">{u.name ?? "—"} {u.autoAdmitted && <span className="text-xs text-gray-400">(auto)</span>}</td>
                <td>
                  <select className="input py-0.5 text-xs" value={u.accessStatus} onChange={(e) => patchUser(u.id, { accessStatus: e.target.value })}>
                    <option>PENDING</option><option>APPROVED</option><option>DENIED</option>
                  </select>
                </td>
                <td>
                  <select className="input py-0.5 text-xs" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                    <option>MEMBER</option><option>ADMIN</option>
                  </select>
                </td>
                <td>{u._count.rosters}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

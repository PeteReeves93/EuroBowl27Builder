"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteRosterButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm("Delete this roster? This can't be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/rosters/${id}`, { method: "DELETE" });
    if (res.ok) { router.push("/"); router.refresh(); } else { setBusy(false); alert("Delete failed"); }
  }
  return <button className="btn btn-ghost text-red-600" onClick={del} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>;
}

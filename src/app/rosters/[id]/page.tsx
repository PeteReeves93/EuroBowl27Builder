import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getLatestRulepack, getTeamsData, getSkillsData, getTeam } from "@/lib/data";
import { checkStoredRoster } from "@/lib/roster-validity";
import RosterBuilder from "@/components/RosterBuilder";
import DeleteRosterButton from "@/components/DeleteRosterButton";
import type { RosterPayload } from "@/types";

export const dynamic = "force-dynamic";

export default async function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus !== "APPROVED") redirect("/pending");

  const roster = await prisma.roster.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true } } } });
  if (!roster) notFound();

  const payload = roster.payload as unknown as RosterPayload;
  const canEdit = roster.ownerId === user.id || user.role === "ADMIN";
  const v = checkStoredRoster(payload);

  if (canEdit) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{roster.name}</h1>
            <p className="text-sm text-gray-500">Editing · {roster.teamName} · by {roster.owner.name}</p>
          </div>
          <DeleteRosterButton id={roster.id} />
        </div>
        {v.stale && <div className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">Built on {v.builtEdition}; now shown against the latest ruleset {v.latestEdition}. Re-save to re-stamp it.</div>}
        <RosterBuilder teamsData={getTeamsData()} rulepack={getLatestRulepack()} skills={getSkillsData()}
          existing={{ id: roster.id, name: roster.name, payload }} />
      </div>
    );
  }

  // Read-only view for other squad members.
  const team = getTeam(payload.teamName);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{roster.name}</h1>
          <p className="text-sm text-gray-500">{roster.teamName} · by {roster.owner.name} · built {v.builtEdition}</p>
        </div>
        {v.result.valid ? <span className="badge badge-valid">Valid vs {v.latestEdition}</span> : <span className="badge badge-invalid">{v.result.errors.length} issue{v.result.errors.length === 1 ? "" : "s"}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Players ({payload.players.length})</h2>
          <ul className="divide-y">
            {payload.players.map((pl, i) => {
              const pos = team?.positionals.find((p) => p.pos === pl.pos);
              return (
                <li key={pl.id ?? i} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="text-xs text-gray-400">{i + 1}</span>
                  <span className="font-medium">{pl.pos}</span>
                  <span className="text-xs text-gray-500">{pos?.cost.toLocaleString("en-GB")} gp</span>
                  {pl.skills.length > 0 && <span className="text-xs text-lion-dark">+ {pl.skills.join(", ")}</span>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 text-sm text-gray-600">
            {payload.rerolls > 0 && <div>Re-rolls: {payload.rerolls}</div>}
            {payload.apothecary && <div>Apothecary</div>}
            {payload.stars.length > 0 && <div>Stars: {payload.stars.map((st) => st.name).join(", ")}</div>}
            {Object.entries(payload.inducements ?? {}).filter(([, q]) => q > 0).map(([k, q]) => <div key={k}>{k}: {q}</div>)}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Validation</h2>
          <div className="text-sm">Gold {v.result.summary.goldSpent.toLocaleString("en-GB")} / {v.result.summary.goldBudget.toLocaleString("en-GB")}</div>
          <div className="text-sm">SPP {v.result.summary.sppSpent} / {v.result.summary.sppBudget}</div>
          {v.result.errors.map((e, i) => <div key={i} className="mt-1 text-sm text-red-700">• {e.message}</div>)}
          {v.result.warnings.map((w, i) => <div key={i} className="mt-1 text-sm text-amber-700">• {w.message}</div>)}
        </div>
      </div>
      <div className="mt-4"><Link href="/" className="text-sm text-lion-red">← All rosters</Link></div>
    </div>
  );
}

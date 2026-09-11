import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { checkStoredRoster } from "@/lib/roster-validity";
import { getLatestRulepack } from "@/lib/data";
import type { RosterPayload } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus !== "APPROVED") redirect("/pending");

  const rosters = await prisma.roster.findMany({
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true, image: true, id: true } } },
  });
  const latest = getLatestRulepack();

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Squad rosters</h1>
          <p className="text-sm text-gray-500">
            Shared across the squad · validating against <span className="font-semibold">{latest.name} ({latest.edition})</span>
          </p>
        </div>
        <Link href="/rosters/new" className="btn btn-primary">New roster</Link>
      </div>

      {rosters.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          No rosters yet. <Link href="/rosters/new" className="font-semibold text-lion-red">Build the first one →</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rosters.map((r) => {
            const v = checkStoredRoster(r.payload as unknown as RosterPayload);
            return (
              <Link key={r.id} href={`/rosters/${r.id}`} className="card block p-4 hover:ring-lion-red">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{r.name}</div>
                  {v.result.valid ? (
                    <span className="badge badge-valid">Valid</span>
                  ) : (
                    <span className="badge badge-invalid">{v.result.errors.length} issue{v.result.errors.length === 1 ? "" : "s"}</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-600">{r.teamName}{r.coachName ? ` · ${r.coachName}` : ""}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    {r.owner.image && <Image src={r.owner.image} alt="" width={16} height={16} className="rounded-full" />}
                    {r.owner.name ?? "Unknown"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span>{r.rulepackEdition}</span>
                    {v.stale && <span className="badge badge-stale">was {v.builtEdition}</span>}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

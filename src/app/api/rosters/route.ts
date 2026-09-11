import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getLatestRulepack } from "@/lib/data";
import type { RosterPayload } from "@/types";

// GET /api/rosters  -> list ALL rosters (shared resource, every approved user sees them)
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const rosters = await prisma.roster.findMany({
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true, image: true, id: true } } },
  });
  return NextResponse.json({ rosters, latestRulepackId: getLatestRulepack().id });
}

// POST /api/rosters  -> create a roster
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const payload = body.payload as RosterPayload;
  const name = (body.name as string)?.trim();
  if (!name || !payload?.teamName) return NextResponse.json({ error: "name and team required" }, { status: 400 });

  const roster = await prisma.roster.create({
    data: {
      name,
      teamName: payload.teamName,
      rulepackId: payload.rulepackId,
      rulepackEdition: payload.rulepackEdition,
      payload: payload as never,
      coachName: payload.coachName ?? null,
      ownerId: user.id,
    },
  });
  return NextResponse.json({ roster });
}

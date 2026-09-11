import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import type { RosterPayload } from "@/types";

async function loadOwnedOrAdmin(id: string) {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") return { error: 403 as const };
  const roster = await prisma.roster.findUnique({ where: { id } });
  if (!roster) return { error: 404 as const };
  const canEdit = roster.ownerId === user.id || user.role === "ADMIN";
  return { user, roster, canEdit };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const roster = await prisma.roster.findUnique({
    where: { id },
    include: { owner: { select: { name: true, image: true, id: true } } },
  });
  if (!roster) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ roster });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwnedOrAdmin(id);
  if ("error" in res) return NextResponse.json({ error: "forbidden" }, { status: res.error });
  if (!res.canEdit) return NextResponse.json({ error: "not your roster" }, { status: 403 });

  const body = await req.json();
  const payload = body.payload as RosterPayload;
  const name = (body.name as string)?.trim();
  const updated = await prisma.roster.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(payload
        ? {
            teamName: payload.teamName,
            rulepackId: payload.rulepackId,
            rulepackEdition: payload.rulepackEdition,
            payload: payload as never,
            coachName: payload.coachName ?? null,
          }
        : {}),
    },
  });
  return NextResponse.json({ roster: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await loadOwnedOrAdmin(id);
  if ("error" in res) return NextResponse.json({ error: "forbidden" }, { status: res.error });
  if (!res.canEdit) return NextResponse.json({ error: "not your roster" }, { status: 403 });
  await prisma.roster.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

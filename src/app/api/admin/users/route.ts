import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

// GET /api/admin/users -> list users (admin only)
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: [{ accessStatus: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, image: true, discordId: true, role: true,
      accessStatus: true, autoAdmitted: true, createdAt: true, approvedAt: true,
      _count: { select: { rosters: true } },
    },
  });
  return NextResponse.json({ users });
}

// PATCH /api/admin/users -> { id, accessStatus?, role? }
export async function PATCH(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, accessStatus, role } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === admin.id && role && role !== "ADMIN")
    return NextResponse.json({ error: "you can't remove your own admin role" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (accessStatus && ["PENDING", "APPROVED", "DENIED"].includes(accessStatus)) {
    data.accessStatus = accessStatus;
    if (accessStatus === "APPROVED") data.approvedAt = new Date();
  }
  if (role && ["MEMBER", "ADMIN"].includes(role)) data.role = role;

  const updated = await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ user: updated });
}

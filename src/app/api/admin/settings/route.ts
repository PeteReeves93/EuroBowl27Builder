import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAllSettings, setSetting, SettingKey } from "@/lib/settings";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ settings: await getAllSettings() });
}

// PUT /api/admin/settings -> { accessGateEnabled?, autoAdmitEnabled?, autoAdmitGuildId? }
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed: SettingKey[] = ["accessGateEnabled", "autoAdmitEnabled", "autoAdmitGuildId"];
  for (const key of allowed) {
    if (key in body) await setSetting(key, body[key]);
  }
  return NextResponse.json({ settings: await getAllSettings() });
}

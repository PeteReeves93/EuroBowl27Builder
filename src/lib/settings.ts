// Live app settings, stored in the AppSetting table so the admin can change them
// without a redeploy. Falls back to env defaults if a key isn't set yet.

import { prisma } from "@/lib/prisma";

export type SettingKey = "accessGateEnabled" | "autoAdmitEnabled" | "autoAdmitGuildId";

const DEFAULTS: Record<SettingKey, unknown> = {
  accessGateEnabled: true,
  autoAdmitEnabled: true,
  autoAdmitGuildId: process.env.AUTO_ADMIT_GUILD_ID ?? "",
};

export async function getSetting<T = unknown>(key: SettingKey): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value as T;
  return DEFAULTS[key] as T;
}

export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  const rows = await prisma.appSetting.findMany();
  const map: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map as Record<SettingKey, unknown>;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

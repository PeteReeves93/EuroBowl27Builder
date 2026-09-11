// Seeds default app settings. Safe to run repeatedly (upserts).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaults: Record<string, unknown> = {
    accessGateEnabled: true,
    autoAdmitEnabled: true,
    autoAdmitGuildId: process.env.AUTO_ADMIT_GUILD_ID ?? "",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {}, // don't clobber an existing admin-changed value
    });
    console.log(`seeded setting: ${key}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

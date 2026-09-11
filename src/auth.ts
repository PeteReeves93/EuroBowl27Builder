import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { isMemberOfGuild } from "@/lib/discord";

function adminIds(): string[] {
  return (process.env.ADMIN_DISCORD_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Discord({
      // "guilds" is required for server auto-admit; "identify" for the profile.
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const u = user as unknown as {
          id: string;
          role?: "MEMBER" | "ADMIN";
          accessStatus?: "PENDING" | "APPROVED" | "DENIED";
        };
        session.user.id = u.id;
        session.user.role = u.role ?? "MEMBER";
        session.user.accessStatus = u.accessStatus ?? "PENDING";
      }
      return session;
    },
  },
  events: {
    // Runs on every sign-in (after the adapter has created/linked the user).
    async signIn({ user, account }) {
      try {
        if (!user?.id) return;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (!dbUser) return;

        const discordId = account?.providerAccountId ?? undefined;
        const isAdmin = !!discordId && adminIds().includes(discordId);
        const data: Record<string, unknown> = {};

        if (discordId && dbUser.discordId !== discordId) data.discordId = discordId;

        if (isAdmin) {
          if (dbUser.role !== "ADMIN") data.role = "ADMIN";
          if (dbUser.accessStatus !== "APPROVED") { data.accessStatus = "APPROVED"; data.approvedAt = new Date(); }
        }

        // Auto-admit only upgrades a PENDING, non-admin user. Never overrides DENIED
        // or an existing APPROVED (which may have been set manually by an admin).
        if (!isAdmin && dbUser.accessStatus === "PENDING") {
          const gateEnabled = await getSetting<boolean>("accessGateEnabled");
          if (!gateEnabled) {
            data.accessStatus = "APPROVED";
            data.approvedAt = new Date();
          } else {
            const autoEnabled = await getSetting<boolean>("autoAdmitEnabled");
            const guildId = await getSetting<string>("autoAdmitGuildId");
            if (autoEnabled && guildId && account?.access_token && (await isMemberOfGuild(account.access_token, guildId))) {
              data.accessStatus = "APPROVED";
              data.autoAdmitted = true;
              data.approvedAt = new Date();
            }
          }
        }

        if (Object.keys(data).length) await prisma.user.update({ where: { id: user.id }, data });
      } catch (e) {
        console.error("[auth] signIn event error:", e);
      }
    },
  },
});

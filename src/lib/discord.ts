// Minimal Discord API helper: check whether the signed-in user belongs to a guild.
// Uses the OAuth access token from sign-in (requires the "guilds" scope).

interface DiscordGuild { id: string; name: string }

export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Discord rate-limits; a single call per sign-in is fine.
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as DiscordGuild[];
  } catch {
    return [];
  }
}

export async function isMemberOfGuild(accessToken: string, guildId: string): Promise<boolean> {
  if (!guildId) return false;
  const guilds = await fetchUserGuilds(accessToken);
  return guilds.some((g) => g.id === guildId);
}

# Team England Pathway Pals — Roster Builder

A shared Blood Bowl roster builder and validator for the **NAF World Cup 2027** ruleset.
Coaches log in with Discord, build rosters for their team, and every approved member can
see everyone's rosters. Each roster is stamped with the rulepack edition it was built
against (currently **v2.1**) and shows whether it is still valid against the latest
loaded ruleset.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Prisma** + **Postgres** (Neon / Supabase / Vercel Postgres)
- **Auth.js (NextAuth v5)** with the Discord provider
- **Tailwind CSS**
- Deploys to **Vercel**

## Rulepacks

Tournament rules live as versioned JSON in `data/rulepacks/`. The current one is
`naf-wc-2027-v2.1.json`. To load a new ruleset later, drop a new file in that folder
(e.g. `...-v2.2.json`), mark it `"isLatest": true`, and set the old one to `false`.
The validator re-checks every saved roster against whichever pack is `isLatest`, so
older rosters automatically show as valid / invalid against the new rules.

Team roster data (positionals, costs, stats, skill access) and the skills list live in
`data/teams/` and `data/skills.json`, extracted from the Blood Bowl (BB2025) rules
database.

## First-time setup (Windows)

1. Install **Node.js 20+** and have a Postgres database ready (Neon free tier is easiest).
2. Create a **Discord application** at <https://discord.com/developers/applications>:
   - OAuth2 → add redirect URL `http://localhost:3000/api/auth/callback/discord`
     (and later your Vercel URL + `/api/auth/callback/discord`).
   - Copy the **Client ID** and **Client Secret**.
3. Run `scripts\setup.bat` (installs deps, creates `.env`, generates Prisma client).
4. Edit `.env` — fill in `DATABASE_URL`, `AUTH_SECRET`, the two `AUTH_DISCORD_*`
   values, your `ADMIN_DISCORD_IDS`, and (optionally) `AUTO_ADMIT_GUILD_ID`.
5. Run `scripts\db-push.bat` (creates tables + seeds default settings).
6. Run `scripts\dev.bat` and open <http://localhost:3000>.

## Access control

- New Discord logins land in a **pending** state until an admin approves them.
- If `AUTO_ADMIT_GUILD_ID` is set, anyone who is a member of that Discord server is
  **auto-approved** on first login (uses the `guilds` OAuth scope).
- Admins (listed in `ADMIN_DISCORD_IDS`) get an **/admin** page to approve/deny users
  and to toggle the whole gate off — flip `accessGateEnabled` to `false` and any Discord
  login is allowed straight in.

## Git

Personal project → GitHub. `scripts\init-git.bat` initialises the repo and makes the
first commit; then add your GitHub remote and push. Commit each change with
`scripts\commit.bat "message"`.

## Deploy

Push to GitHub, import the repo in Vercel, set the same env vars in the Vercel project
settings (with `AUTH_URL` = your Vercel URL), and add the production redirect URL to the
Discord app. Vercel runs `npm run build` which generates the Prisma client automatically.

# Deploying to Vercel

One-pass checklist. No local app run required — the only thing you run locally is `git` to push the code.

## 1. Push the code to GitHub

```
scripts\init-git.bat
```
Then create an **empty** repo on GitHub (no README/gitignore) and:
```
git remote add origin https://github.com/<you>/EuroBowl27Builder.git
git push -u origin main
```

## 2. Supabase database

- Use your (renamed) `bloodbowl` project. **Use the POOLER host for both URLs** — the
  direct host (`db.<ref>.supabase.co`) is IPv6-only and Vercel can't reach it (causes
  `P1001: Can't reach database server`).
- Easiest source: Supabase → **Connect** (top bar) → **ORMs → Prisma**. It shows a
  `DATABASE_URL` (transaction pooler, 6543) and a `DIRECT_URL` (session pooler, 5432),
  both on `aws-0-<region>.pooler.supabase.com` with username `postgres.<ref>`.
  Copy them, then append **`&schema=eurobowl`** to each (they already start with `?`).
- The `schema=eurobowl` keeps these tables separate from Fall Cup (which stays in `public`).
- You do **not** need to create tables by hand — the Vercel build runs `prisma db push`, which creates the `eurobowl` schema and all tables on first deploy.

## 3. Discord application

- discord.com/developers/applications → **New Application**.
- **OAuth2** → copy **Client ID** (`AUTH_DISCORD_ID`) and **Client Secret** (`AUTH_DISCORD_SECRET`).
- **OAuth2 → Redirects**, add (fill in your Vercel domain once you have it in step 4):
  ```
  https://<your-app>.vercel.app/api/auth/callback/discord
  ```
  You can add `http://localhost:3000/api/auth/callback/discord` too if you ever run it locally.

## 4. Import into Vercel

- vercel.com → **Add New → Project** → import the GitHub repo. Framework auto-detects as Next.js.
- Before the first deploy, add **Environment Variables** (Production):

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **pooled** string (`...:6543/postgres?sslmode=require&pgbouncer=true&schema=eurobowl`) |
| `DIRECT_URL` | Supabase **direct** string (`...:5432/postgres?sslmode=require&schema=eurobowl`) |
| `AUTH_SECRET` | run `npx auth secret` locally to generate one, or any 32-byte base64 string |
| `AUTH_URL` | `https://<your-app>.vercel.app` |
| `AUTH_DISCORD_ID` | Discord Client ID |
| `AUTH_DISCORD_SECRET` | Discord Client Secret |
| `ADMIN_DISCORD_IDS` | your Discord user ID (so you land as admin) |
| `AUTO_ADMIT_GUILD_ID` | your squad's Discord server ID (optional; can set later in /admin) |

- Deploy. The build runs `prisma generate && prisma db push && next build`, so the database schema is created automatically.

## 5. First sign-in

- Open your Vercel URL → **Sign in with Discord**. Because your Discord ID is in `ADMIN_DISCORD_IDS`, you're approved and made admin on first login.
- Go to **/admin** to set the auto-admit server ID, approve pending members, or turn the gate off entirely.

## Notes

- After the first successful deploy you can change `build` back to `prisma generate && next build` if you'd rather not run `db push` on every deploy — but leaving it is harmless (it's a no-op when the schema hasn't changed).
- Redeploys happen automatically on every push to `main`. Branch pushes get preview URLs.

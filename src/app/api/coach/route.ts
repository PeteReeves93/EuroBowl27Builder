import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getLatestRulepack, getTeam, getSkillsData } from "@/lib/data";
import { validateRoster } from "@/lib/validation";
import type { RosterPayload } from "@/types";

const MODEL = process.env.COACH_MODEL || "claude-haiku-4-5-20251001";
const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT || "30");

function gp(n: number) { return `${n.toLocaleString("en-GB")} gp`; }

function buildContext(payload: RosterPayload): string {
  const rp = getLatestRulepack();
  const team = getTeam(payload.teamName);
  const skills = getSkillsData();
  const rpTeam = rp.teams.find((t) => t.name.toLowerCase() === payload.teamName.toLowerCase());
  const v = validateRoster(payload, team, rp, skills);

  const lines: string[] = [];
  lines.push(`TOURNAMENT: ${rp.name} (${rp.edition}). Resurrection tournament; squads of 6 coaches; one race per coach; each Star Player unique across the 6-team squad.`);
  if (rpTeam) lines.push(`TEAM: ${payload.teamName} — Gold budget ${gp(rpTeam.gold)}, SPP budget ${rpTeam.spp}, skill stacking "${rpTeam.stacking}", star-eligible: ${rpTeam.starEligible ? "yes" : "no"}.`);
  lines.push(`SKILL COSTS (SPP): 1st Primary ${rp.skillCosts.primaryFirst} / 1st Secondary ${rp.skillCosts.secondaryFirst} / 2nd Primary ${rp.skillCosts.primarySecond} / 2nd Secondary ${rp.skillCosts.secondarySecond}; Elite +${rp.skillCosts.eliteSurcharge} (${rp.eliteSkills.list.join(", ")}). Stacking "${rpTeam?.stacking}" => at most ${rpTeam ? { none: 0, one: 1, two: 2 }[rpTeam.stacking] : 0} player(s) may take a 2nd skill.`);
  if (team) {
    lines.push(`POSITIONALS (qty, cost, MA/ST/AG/PA/AV, start skills; access Prim/Sec):`);
    for (const p of team.positionals) {
      lines.push(`  - 0-${p.max} ${p.pos} ${gp(p.cost)} ${p.ma}/${p.st}/${p.ag}/${p.pa}/${p.av} [${p.skills.join(", ") || "no skills"}] access ${p.prim.join("")}/${p.sec.join("") || "-"}`);
    }
    lines.push(`  Team re-roll: ${team.rerollCost ? gp(team.rerollCost) : "?"} each (0-${rp.rosterRules.rerolls.max}). Apothecary: ${team.apothecary ? "allowed" : "not allowed"}.`);
  }
  lines.push(`INDUCEMENTS: ${rp.inducements.map((i) => `${i.name} ${gp(i.cost)}`).join("; ")}.`);
  if (rpTeam?.starEligible) lines.push(`STARS: allowed after 11 regulars. Star tax by cumulative cost: ${rp.starPlayers.starTaxSpp.map((b) => `${gp(b.minCumulativeCost)}${b.maxCumulativeCost != null ? `-${gp(b.maxCumulativeCost)}` : "+"}=${b.taxSpp}SPP`).join(", ")}. Banned: ${rp.starPlayers.banned.join(", ")}.`);

  // Skill category reference (authoritative — stops the model guessing categories/costs).
  const eliteSet = new Set(skills.eliteSkills.map((s) => s.toLowerCase()));
  const catName: Record<string, string> = { G: "General", A: "Agility", P: "Passing", S: "Strength", D: "Devious", M: "Mutation" };
  const byCat: Record<string, string[]> = { General: [], Agility: [], Passing: [], Strength: [], Devious: [], Mutation: [] };
  for (const s of skills.skills) {
    if (!s.purchasable || s.cat === "Trait") continue;
    const isElite = eliteSet.has(s.name.toLowerCase()) || s.elite;
    byCat[catName[s.cat]]?.push(s.name + (isElite ? "*" : ""));
  }
  lines.push(`\nSKILL CATEGORIES (* = Elite, +${rp.skillCosts.eliteSurcharge} SPP):`);
  for (const [c, arr] of Object.entries(byCat)) if (arr.length) lines.push(`  ${c}: ${arr.join(", ")}`);

  // Exact buyable skills + first-skill cost, per distinct position on the roster.
  if (team) {
    const distinct = [...new Set(payload.players.map((p) => p.pos))];
    lines.push(`BUYABLE SKILLS by position — FIRST skill cost shown. A player's 2nd skill costs +${rp.skillCosts.primarySecond - rp.skillCosts.primaryFirst} SPP more, and the stacking limit "${rpTeam?.stacking}" caps how many players may take a 2nd skill at all:`);
    for (const posName of distinct) {
      const pos = team.positionals.find((p) => p.pos === posName);
      if (!pos) continue;
      const starting = new Set(pos.skills.map((s) => s.toLowerCase()));
      const opts: { name: string; cost: number }[] = [];
      for (const s of skills.skills) {
        if (!s.purchasable || s.cat === "Trait") continue;
        if (starting.has(s.name.toLowerCase())) continue;
        const cat = s.cat;
        const isPrim = pos.prim.includes(cat as never);
        const isSec = pos.sec.includes(cat as never);
        if (!isPrim && !isSec) continue;
        let cost = isPrim ? rp.skillCosts.primaryFirst : rp.skillCosts.secondaryFirst;
        if (eliteSet.has(s.name.toLowerCase()) || s.elite) cost += rp.skillCosts.eliteSurcharge;
        opts.push({ name: s.name, cost });
      }
      opts.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
      lines.push(`  ${pos.pos} (access ${pos.prim.join("")}/${pos.sec.join("") || "-"}): ${opts.map((o) => `${o.name} ${o.cost}`).join(", ")}`);
    }
  }

  lines.push(`\nCURRENT ROSTER "${payload.teamName}":`);
  const grouped = new Map<string, number>();
  for (const pl of payload.players) {
    const key = pl.pos + (pl.skills.length ? ` +${pl.skills.join("/")}` : "");
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  for (const [k, n] of grouped) lines.push(`  ${n}x ${k}`);
  if (payload.rerolls) lines.push(`  Re-rolls: ${payload.rerolls}`);
  if (payload.apothecary) lines.push(`  Apothecary`);
  for (const [k, n] of Object.entries(payload.inducements ?? {})) if (n > 0) lines.push(`  Inducement ${k}: ${n}`);
  for (const s of payload.stars) lines.push(`  Star: ${s.name} (${gp(s.cost)})`);

  lines.push(`\nBUDGET: Gold ${gp(v.summary.goldSpent)} / ${gp(v.summary.goldBudget)} (${gp(v.summary.goldRemaining)} left). SPP ${v.summary.sppSpent} / ${v.summary.sppBudget} (${v.summary.sppRemaining} left). Players: ${v.summary.regularPlayers} regular + ${v.summary.starPlayers} star.`);
  lines.push(`VALIDATION: ${v.valid ? "LEGAL" : "ILLEGAL"}.`);
  if (v.errors.length) lines.push(`ERRORS: ${v.errors.map((e) => e.message).join(" | ")}`);
  if (v.warnings.length) lines.push(`NOTES: ${v.warnings.map((w) => w.message).join(" | ")}`);
  return lines.join("\n");
}

const SYSTEM = `You are the assistant coach for "Team England Pathway Pals", helping coaches build rosters for the NAF World Cup 2027 — a RESURRECTION tournament. These format rules are absolute; never contradict them:
- This is NOT a league. A roster is built ONCE from a fixed Gold budget and SPP budget, and is FINAL for the whole tournament.
- Players do NOT gain SPP or level up during play. There is no progression, no advancement, no "skilling up over the season", no trades, no mid-season recruitment, no buying more re-rolls or players between games. NEVER suggest any of these.
- Every skill a player will ever have is either a free starting skill or a skill bought NOW from the team's SPP budget at roster creation. Injuries/casualties/deaths do not carry over.

Use ONLY the data provided below for skill categories, costs, access, inducements and star players. Do NOT rely on your own Blood Bowl memory — it may be wrong or from an older edition. Specifically:
- A skill's SPP cost depends on whether that skill's CATEGORY is in the player's Primary or Secondary access, plus the Elite +2 surcharge. Read categories from the SKILL CATEGORIES block and exact costs from the BUYABLE SKILLS block — do not guess (e.g. Guard is a Strength skill, so it is only cheap for players with Strength access).
- Only recommend inducements or star players that appear in the data AND that plausibly help THIS team. Do not push generic "meta" buys that don't fit (e.g. never suggest Bribes for a team with no secret weapons).

Be friendly and concise — a short paragraph or a tight list. Ground advice in this specific roster: unspent gold/SPP, the stacking limit (how many players may take a 2nd skill), sensible skill buys, and explaining any validation errors with legal fixes. For tactics, give your view but flag it as a suggestion; if unsure, say so. The VALIDATION block is authoritative on legal/illegal.`;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "The coach isn't configured yet (no API key)." }, { status: 503 });

  // Daily cap.
  const day = new Date().toISOString().slice(0, 10);
  const usage = await prisma.coachUsage.upsert({
    where: { userId_day: { userId: user.id, day } },
    create: { userId: user.id, day, count: 0 },
    update: {},
  });
  if (usage.count >= DAILY_LIMIT) return NextResponse.json({ error: `Daily coach limit reached (${DAILY_LIMIT}). Try again tomorrow.` }, { status: 429 });

  const body = await req.json();
  const payload = body.payload as RosterPayload;
  const messages = (body.messages as { role: "user" | "assistant"; content: string }[]) ?? [];
  if (!payload?.teamName || messages.length === 0) return NextResponse.json({ error: "roster and message required" }, { status: 400 });

  const context = buildContext(payload);
  const trimmed = messages.slice(-10);
  // Attach the CURRENT roster context to the latest question, so advice always
  // reflects the live roster even if it changed mid-conversation.
  const apiMessages = trimmed.map((m, i) =>
    i === trimmed.length - 1 && m.role === "user"
      ? { role: m.role, content: `My current roster and its rules context:\n\n${context}\n\n---\n\nMy question: ${m.content}` }
      : m,
  );

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages: apiMessages }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[coach] anthropic error", res.status, t);
      let detail = t;
      try { detail = JSON.parse(t)?.error?.message ?? t; } catch { /* keep raw */ }
      return NextResponse.json(
        { error: `Coach error (${res.status}): ${String(detail).slice(0, 300)}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    const reply = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();

    await prisma.coachUsage.update({ where: { userId_day: { userId: user.id, day } }, data: { count: { increment: 1 } } });
    return NextResponse.json({ reply: reply || "(no response)" });
  } catch (e) {
    console.error("[coach] error", e);
    return NextResponse.json({ error: "The coach couldn't respond just now." }, { status: 502 });
  }
}

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

const SYSTEM = `You are the assistant coach for "Team England Pathway Pals", a Blood Bowl squad playing the NAF World Cup 2027 (a resurrection tournament). You help coaches build and improve their rosters.

Be friendly, concise and practical — a couple of short paragraphs at most, or a tight list. You are given the tournament rules and the coach's CURRENT roster with its validation. Ground every answer in that data:
- If the roster is illegal, explain the errors in plain English and suggest specific legal fixes.
- Point out unspent gold/SPP, missing key skills (e.g. no Guard, no Tackle, no ball-handling), and efficient buys given this team's budgets and stacking limit.
- Only reference positions, skills, inducements and star players that appear in the provided data. Do NOT invent rules, costs, or players. If unsure, say so.
- For tactics/meta, give your view but make clear it's a suggestion, not a rule.
Never claim a roster is legal/illegal contrary to the VALIDATION block — that check is authoritative.`;

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
      return NextResponse.json({ error: "The coach couldn't respond just now." }, { status: 502 });
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

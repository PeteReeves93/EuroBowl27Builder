// Loads rulepacks + team/skill data from the /data JSON files.
// Server-side only (reads the filesystem). Cached in module scope.

import fs from "node:fs";
import path from "node:path";
import type { Rulepack, TeamsData, SkillsData, TeamDef, SkillDef, StarsData, StarPlayerDef } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(rel: string): T {
  const full = path.join(DATA_DIR, rel);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

let _rulepacks: Rulepack[] | null = null;
let _teams: TeamsData | null = null;
let _skills: SkillsData | null = null;
let _stars: StarsData | null = null;

export function getRulepacks(): Rulepack[] {
  if (!_rulepacks) {
    const dir = path.join(DATA_DIR, "rulepacks");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    _rulepacks = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Rulepack);
  }
  return _rulepacks;
}

export function getRulepack(id: string): Rulepack | undefined {
  return getRulepacks().find((r) => r.id === id);
}

export function getLatestRulepack(): Rulepack {
  const packs = getRulepacks();
  const latest = packs.find((r) => r.isLatest);
  if (latest) return latest;
  // Fallback: highest edition string.
  return [...packs].sort((a, b) => b.edition.localeCompare(a.edition))[0];
}

export function getTeamsData(): TeamsData {
  if (!_teams) _teams = readJson<TeamsData>("teams.json");
  return _teams;
}

export function getTeam(name: string): TeamDef | undefined {
  return getTeamsData().teams.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

export function getSkillsData(): SkillsData {
  if (!_skills) _skills = readJson<SkillsData>("skills.json");
  return _skills;
}

export function getStarsData(): StarsData {
  if (!_stars) _stars = readJson<StarsData>("starplayers.json");
  return _stars;
}

export function getStarsForTeam(teamName: string): StarPlayerDef[] {
  const byTeam = getStarsData().byTeam;
  const key = Object.keys(byTeam).find((k) => k.toLowerCase() === teamName.toLowerCase());
  return key ? byTeam[key] : [];
}

// Optional: per-race archetypes distilled from last year's tournament.
// File may not exist until scripts/build-archetypes has been run.
let _archetypes: Record<string, { summary?: string }> | null = null;
export function getArchetypes(): Record<string, { summary?: string }> {
  if (_archetypes === null) {
    try {
      _archetypes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "archetypes.json"), "utf8"));
    } catch {
      _archetypes = {};
    }
  }
  return _archetypes;
}

export function getArchetypeSummary(teamName: string): string | null {
  const a = getArchetypes();
  const key = Object.keys(a).find((k) => k.toLowerCase() === teamName.toLowerCase());
  return key ? a[key]?.summary ?? null : null;
}

/** Build a lookup: skill name (and aliases), lowercased -> SkillDef. */
let _skillIndex: Map<string, SkillDef> | null = null;
export function getSkillIndex(): Map<string, SkillDef> {
  if (!_skillIndex) {
    _skillIndex = new Map();
    for (const s of getSkillsData().skills) {
      _skillIndex.set(s.name.toLowerCase(), s);
      for (const a of s.aliases ?? []) _skillIndex.set(a.toLowerCase(), s);
    }
  }
  return _skillIndex;
}

/** Resolve a skill by name or alias (handles "Loner (4+)" -> "Loner", "Pogo Stick" -> "Pogo"). */
export function resolveSkill(name: string): SkillDef | undefined {
  const idx = getSkillIndex();
  const key = name.toLowerCase().trim();
  if (idx.has(key)) return idx.get(key);
  // Strip parenthetical qualifier, e.g. "Animosity (all)" -> "Animosity".
  const base = key.replace(/\s*\(.*\)\s*$/, "").trim();
  return idx.get(base);
}

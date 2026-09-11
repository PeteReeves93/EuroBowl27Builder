// Digests the raw tourplay_rosters.json (from last year's Home Nations Open)
// into a compact data/archetypes.json: per-race typical builds + popular skills.
//
// Usage:  node scripts/build-archetypes.mjs [path-to-tourplay_rosters.json]
// Default input: ./tourplay_rosters.json (drop the downloaded file in the repo root).
// Output: data/archetypes.json  (this small file is what gets committed & used).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const inputPath = process.argv[2] || path.join(root, "tourplay_rosters.json");
const outPath = path.join(root, "data", "archetypes.json");

// Map tourplay race strings -> our team names (must match data/teams.json / rulepack).
const OUR_TEAMS = [
  "Amazon","Black Orc","Bretonnia","Chaos Chosen","Chaos Dwarf","Chaos Renegade","Dark Elf","Dwarf",
  "Elven Union","Gnomes","Goblins","Halflings","High Elf","Human","Imperial Nobility","Khorne","Lizardmen",
  "Necromantic Horror","Norse","Nurgle","Ogres","Old World Alliance","Orc","Shambling Undead","Skaven",
  "Slann","Snotlings","Tomb Kings","Underworld","Vampire","Wood Elf",
];
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS = {
  bretonnian: "Bretonnia", blackorc: "Black Orc", blackorcs: "Black Orc", chaosdwarves: "Chaos Dwarf",
  chaosdwarf: "Chaos Dwarf", chaosrenegades: "Chaos Renegade", chaosrenegade: "Chaos Renegade",
  darkelf: "Dark Elf", darkelves: "Dark Elf", dwarves: "Dwarf", elfunion: "Elven Union", elvenunion: "Elven Union",
  gnome: "Gnomes", gnomes: "Gnomes", goblin: "Goblins", goblins: "Goblins", halfling: "Halflings", halflings: "Halflings",
  highelf: "High Elf", highelves: "High Elf", humans: "Human", imperialnobility: "Imperial Nobility",
  necromantic: "Necromantic Horror", necromantichorror: "Necromantic Horror", necromantics: "Necromantic Horror",
  ogre: "Ogres", ogres: "Ogres", oldworldalliance: "Old World Alliance", orcs: "Orc",
  shamblingundead: "Shambling Undead", slanns: "Slann", slann: "Slann", snotling: "Snotlings", snotlings: "Snotlings",
  tombkings: "Tomb Kings", underworlddenizens: "Underworld", underworld: "Underworld", vampires: "Vampire",
  woodelf: "Wood Elf", woodelves: "Wood Elf",
};
const teamByNorm = new Map(OUR_TEAMS.map((t) => [norm(t), t]));
function ourRace(raceStr) {
  const base = norm(String(raceStr).replace(/_?bb?20?25$/i, ""));
  if (teamByNorm.has(base)) return teamByNorm.get(base);
  if (ALIAS[base]) return ALIAS[base];
  return null; // unknown / not one of ours
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const topN = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

// ---- Load ----
if (!fs.existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}\nDrop tourplay_rosters.json in the repo root or pass its path.`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
console.log(`Loaded ${data.length} coaches from ${path.basename(inputPath)}`);

// ---- Aggregate per race ----
const races = new Map();
for (const coach of data) {
  const race = ourRace(coach.teamRace);
  if (!race) continue;
  const rd = coach.rosterData;
  if (!rd || !Array.isArray(rd.lineUps)) continue;

  if (!races.has(race)) races.set(race, {
    coaches: 0, finishes: [], rerolls: [], apo: 0, assistantCoaches: [], cheerleaders: [],
    posCounts: [], skillOverall: new Map(), skillByPos: new Map(), stars: new Map(), inducements: new Map(),
  });
  const R = races.get(race);
  R.coaches++;
  if (typeof coach.position === "number") R.finishes.push(coach.position);
  R.rerolls.push(rd.reRolls ?? 0);
  if (rd.apothecary) R.apo++;
  R.assistantCoaches.push(rd.assistantCoaches ?? 0);
  R.cheerleaders.push(rd.cheerLeaders ?? 0);

  const posCount = new Map();
  for (const p of rd.lineUps) {
    if (p.isStarPlayer) { R.stars.set(p.position, (R.stars.get(p.position) ?? 0) + 1); continue; }
    posCount.set(p.position, (posCount.get(p.position) ?? 0) + 1);
    for (const sk of p.skills ?? []) {
      const nm = sk.skillMaster?.name;
      if (!nm) continue;
      R.skillOverall.set(nm, (R.skillOverall.get(nm) ?? 0) + 1);
      if (!R.skillByPos.has(p.position)) R.skillByPos.set(p.position, new Map());
      const bp = R.skillByPos.get(p.position);
      bp.set(nm, (bp.get(nm) ?? 0) + 1);
    }
  }
  R.posCounts.push(posCount);
  for (const ind of rd.inducements ?? []) {
    const nm = ind.inducementMaster?.name;
    if (nm) R.inducements.set(nm, (R.inducements.get(nm) ?? 0) + (ind.quantity ?? 1));
  }
}

// ---- Build compact output ----
const out = {};
for (const [race, R] of [...races.entries()].sort((a, b) => b[1].coaches - a[1].coaches)) {
  // typical positional split: median count per position across coaches that took it
  const allPositions = new Set();
  R.posCounts.forEach((m) => m.forEach((_, k) => allPositions.add(k)));
  const positions = {};
  for (const pos of allPositions) {
    const counts = R.posCounts.map((m) => m.get(pos) ?? 0);
    const taken = counts.filter((c) => c > 0);
    positions[pos] = { typical: median(taken), takenPct: Math.round((taken.length / R.coaches) * 100) };
  }
  const skillByPos = {};
  for (const [pos, m] of R.skillByPos) skillByPos[pos] = topN(m, 3).map(([n, c]) => `${n} (${c})`);

  out[race] = {
    sample: R.coaches,
    avgFinish: R.finishes.length ? Math.round(R.finishes.reduce((a, b) => a + b, 0) / R.finishes.length) : null,
    rerollsTypical: median(R.rerolls),
    apothecaryPct: Math.round((R.apo / R.coaches) * 100),
    assistantCoachesTypical: median(R.assistantCoaches),
    cheerleadersTypical: median(R.cheerleaders),
    positions,
    topSkills: topN(R.skillOverall, 12).map(([n, c]) => `${n} (${c})`),
    topSkillsByPosition: skillByPos,
    starsUsed: topN(R.stars, 6).map(([n, c]) => `${n} (${c})`),
    inducements: topN(R.inducements, 6).map(([n, c]) => `${n} (${c})`),
  };
}

// ---- Natural-language summary per race (what the coach reads) ----
for (const [race, a] of Object.entries(out)) {
  const posBits = Object.entries(a.positions)
    .filter(([, v]) => v.takenPct >= 25 && v.typical >= 1)
    .sort((x, y) => y[1].takenPct - x[1].takenPct)
    .map(([p, v]) => `${v.typical} ${p}`);
  const skills = a.topSkills.slice(0, 8).map((s) => s.replace(/\s*\(\d+\)$/, "")).join(", ");
  const stars = a.starsUsed.length ? ` Popular stars: ${a.starsUsed.map((s) => s.replace(/\s*\(\d+\)$/, "")).join(", ")}.` : "";
  a.summary =
    `From last year's Home Nations Open (${a.sample} ${race} coaches, avg finish ${a.avgFinish ?? "n/a"}): ` +
    `typical build ${posBits.join(", ")}, ~${a.rerollsTypical} re-rolls, apothecary ${a.apothecaryPct}% of the time. ` +
    `Most-bought skills: ${skills}.${stars} ` +
    `(Note: last year used a gold-for-skills format, so treat skill/positional CHOICES as the signal, not exact costs.)`;
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} race archetypes -> ${path.relative(root, outPath)}`);
for (const [race, a] of Object.entries(out)) console.log(`  ${race}: ${a.sample} coaches`);

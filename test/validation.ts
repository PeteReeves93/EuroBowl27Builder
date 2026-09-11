// Validation engine tests. Run:  npm run test:validation  (or scripts\test.bat)
// Exercises the V2.1 rules against known-good and known-bad rosters.

import { validateRoster } from "../src/lib/validation";
import { getLatestRulepack, getTeam, getSkillsData } from "../src/lib/data";
import type { RosterPayload, RosterPlayer } from "../src/types";

const rulepack = getLatestRulepack();
const skills = getSkillsData();

let passed = 0;
let failed = 0;

function player(pos: string, skills: string[] = []): RosterPlayer {
  return { id: Math.random().toString(36).slice(2), pos, skills };
}
function roster(teamName: string, players: RosterPlayer[], extra: Partial<RosterPayload> = {}): RosterPayload {
  return {
    teamName, rulepackId: rulepack.id, rulepackEdition: rulepack.edition,
    players, rerolls: 0, apothecary: false, inducements: {}, stars: [], ...extra,
  };
}
function run(payload: RosterPayload) {
  return validateRoster(payload, getTeam(payload.teamName), rulepack, skills);
}
function expect(label: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}
function codes(r: ReturnType<typeof run>) { return r.errors.map((e) => e.code); }

console.log("\nNAF World Cup 2027 — validation tests\n");

// 1. Valid Orc: 11 linemen, no skills, no stars.
{
  const r = run(roster("Orc", Array.from({ length: 11 }, () => player("Orc Lineman"))));
  expect("valid 11-lineman Orc roster is legal", r.valid, codes(r).join(","));
  expect("  gold spent = 550,000", r.summary.goldSpent === 550000, `got ${r.summary.goldSpent}`);
}

// 2. Under minimum players.
{
  const r = run(roster("Orc", Array.from({ length: 5 }, () => player("Orc Lineman"))));
  expect("5 players flags players.min", codes(r).includes("players.min"));
}

// 3. Over gold budget (16 players + 8 rerolls).
{
  const players = [
    ...Array.from({ length: 11 }, () => player("Orc Lineman")),
    player("Orc Blitzer"), player("Orc Blitzer"),
    player("Big Un Blocker"), player("Big Un Blocker"),
    player("Troll"),
  ];
  const r = run(roster("Orc", players, { rerolls: 8 }));
  expect("over-budget Orc flags gold.over", codes(r).includes("gold.over"), `spent ${r.summary.goldSpent}`);
}

// 4. Elite skill cost: Block on an Orc Lineman = 6 (primary first) + 2 elite = 8 SPP.
{
  const players = [player("Orc Lineman", ["Block"]), ...Array.from({ length: 10 }, () => player("Orc Lineman"))];
  const r = run(roster("Orc", players));
  expect("Block (elite, primary, 1st) costs 8 SPP", r.summary.sppSpent === 8, `got ${r.summary.sppSpent}`);
  expect("  roster still legal", r.valid, codes(r).join(","));
}

// 5. Stacking: Orc is 'none' — no player may take a 2nd skill.
{
  const players = [player("Orc Lineman", ["Block", "Tackle"]), ...Array.from({ length: 10 }, () => player("Orc Lineman"))];
  const r = run(roster("Orc", players));
  expect("Orc (stacking none) with a 2-skill player flags skill.stack", codes(r).includes("skill.stack"));
}

// 6. Skill access: Orc Lineman has no Passing access -> buying Pass is illegal.
{
  const players = [player("Orc Lineman", ["Pass"]), ...Array.from({ length: 10 }, () => player("Orc Lineman"))];
  const r = run(roster("Orc", players));
  expect("buying a no-access skill flags skill.access", codes(r).includes("skill.access"));
}

// 7. SPP overspend: 6 Blocks (8 each = 48) > 44 budget.
{
  const players = [
    ...Array.from({ length: 6 }, () => player("Orc Lineman", ["Block"])),
    ...Array.from({ length: 5 }, () => player("Orc Lineman")),
  ];
  const r = run(roster("Orc", players));
  expect("48 SPP of skills on a 44 budget flags spp.over", codes(r).includes("spp.over"), `spent ${r.summary.sppSpent}`);
}

// 8. Positional maximum: 3 Orc Blitzers (max 2).
{
  const players = [
    player("Orc Blitzer"), player("Orc Blitzer"), player("Orc Blitzer"),
    ...Array.from({ length: 8 }, () => player("Orc Lineman")),
  ];
  const r = run(roster("Orc", players));
  expect("3 Orc Blitzers (max 2) flags pos.max", codes(r).includes("pos.max"));
}

// 9. Stars on a non-eligible team (Orc).
{
  const players = Array.from({ length: 11 }, () => player("Orc Lineman"));
  const r = run(roster("Orc", players, { stars: [{ name: "Some Star", cost: 100000 }] }));
  expect("star on non-eligible Orc flags star.ineligible", codes(r).includes("star.ineligible"));
}

// 10. Banned star on an eligible team (Ogres), with 11 regulars.
{
  const players = Array.from({ length: 11 }, () => player("Gnoblar Lineman"));
  const r = run(roster("Ogres", players, { stars: [{ name: "Morg N Thorg", cost: 340000 }] }));
  expect("banned star flags star.banned", codes(r).includes("star.banned"));
  expect("  star tax applied (>=300 band = 32 SPP)", r.summary.starTax === 32, `got ${r.summary.starTax}`);
}

// 11. Stars before 11 regulars.
{
  const players = Array.from({ length: 9 }, () => player("Gnoblar Lineman"));
  const r = run(roster("Ogres", players, { stars: [{ name: "Zolcath the Zoat", cost: 220000 }] }));
  expect("star with <11 regulars flags star.min11", codes(r).includes("star.min11"));
}

// 12. Stacking allowed: Norse is 'two' — two 2-skill players is OK, three is not.
{
  const base = Array.from({ length: 9 }, () => player("Norse Raider"));
  const two = run(roster("Norse", [player("Norse Raider", ["Guard", "Tackle"]), player("Norse Raider", ["Dodge", "Tackle"]), ...base]));
  expect("Norse (two) with two 2-skill players is OK on stacking", !codes(two).includes("skill.stack"), codes(two).join(","));
  const three = run(roster("Norse", [
    player("Norse Raider", ["Guard", "Tackle"]), player("Norse Raider", ["Dodge", "Tackle"]), player("Norse Raider", ["Frenzy", "Tackle"]),
    ...Array.from({ length: 8 }, () => player("Norse Raider")),
  ]));
  expect("Norse with three 2-skill players flags skill.stack", codes(three).includes("skill.stack"));
}

// 13. Bribes discount for Bribery & Corruption team (Goblins): 50k not 100k.
{
  const players = Array.from({ length: 11 }, () => player("Goblin Lineman"));
  const r = run(roster("Goblins", players, { inducements: { bribes: 1 } }));
  // 11 * 40,000 = 440,000 + 1 bribe @ 50,000 (B&C) = 490,000
  expect("Goblins bribe costs 50,000 (B&C discount)", r.summary.goldSpent === 490000, `got ${r.summary.goldSpent}`);
}

// 14. Valid star induction: Ogres + Grim Ironjaw (200k) => 24 SPP star tax, legal.
{
  const players = Array.from({ length: 11 }, () => player("Gnoblar Lineman"));
  const r = run(roster("Ogres", players, { stars: [{ name: "Grim Ironjaw", cost: 200000 }] }));
  expect("legal Ogres + 200k star is valid", r.valid, codes(r).join(","));
  expect("  star tax = 24 (200-299 band)", r.summary.starTax === 24, `got ${r.summary.starTax}`);
}

// 15. Secret-weapon star drops the Bribes cap to 2.
{
  const players = Array.from({ length: 11 }, () => player("Snotling Lineman"));
  const r = run(roster("Snotlings", players, {
    stars: [{ name: "Fungus the Loon", cost: 80000, secretWeapon: true }],
    inducements: { bribes: 3 },
  }));
  expect("3 bribes with a secret-weapon star flags ind.max (cap 2)", codes(r).includes("ind.max"));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

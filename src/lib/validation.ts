// The roster validation engine for the NAF World Cup ruleset.
// Pure function: given a roster payload + the team data + the rulepack, returns
// a structured result (errors block validity; warnings are advisory).

import type {
  RosterPayload, Rulepack, TeamDef, SkillsData, ValidationResult,
  ValidationIssue, RulepackTeam, Positional, SkillDef,
} from "@/types";

function gp(n: number): string {
  return `${n.toLocaleString("en-GB")} gp`;
}

/** Build a name/alias -> SkillDef resolver from the skills data (pure; no fs). */
function makeSkillResolver(skills: SkillsData): (name: string) => SkillDef | undefined {
  const idx = new Map<string, SkillDef>();
  for (const s of skills.skills) {
    idx.set(s.name.toLowerCase(), s);
    for (const a of s.aliases ?? []) idx.set(a.toLowerCase(), s);
  }
  return (name: string) => {
    const key = name.toLowerCase().trim();
    if (idx.has(key)) return idx.get(key);
    const base = key.replace(/\s*\(.*\)\s*$/, "").trim();
    return idx.get(base);
  };
}

export function validateRoster(
  roster: RosterPayload,
  team: TeamDef | undefined,
  rulepack: Rulepack,
  skills: SkillsData,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string) => errors.push({ code, message });
  const warn = (code: string, message: string) => warnings.push({ code, message });
  const resolveSkill = makeSkillResolver(skills);

  const rpTeam: RulepackTeam | undefined = rulepack.teams.find(
    (t) => t.name.toLowerCase() === roster.teamName.toLowerCase(),
  );

  // Budgets (0 if we can't resolve the team in the rulepack).
  const goldBudget = rpTeam?.gold ?? 0;
  const sppBudget = rpTeam?.spp ?? 0;

  if (!rpTeam) err("team.unknown", `"${roster.teamName}" is not a team in rulepack ${rulepack.edition}.`);
  if (!team) err("team.nodata", `No roster data found for "${roster.teamName}".`);
  if (team && team._status) err("team.placeholder", `${roster.teamName}: ${team._status}`);

  const posByName = new Map<string, Positional>();
  if (team) for (const p of team.positionals) posByName.set(p.pos.toLowerCase(), p);

  // ---------- Players & gold on players ----------
  let playerGold = 0;
  const countByPos = new Map<string, number>();
  const countByGroup = new Map<string, number>();

  for (const pl of roster.players) {
    const pos = posByName.get(pl.pos.toLowerCase());
    if (!pos) {
      err("pos.unknown", `Unknown position "${pl.pos}" for ${roster.teamName}.`);
      continue;
    }
    playerGold += pos.cost;
    countByPos.set(pos.pos, (countByPos.get(pos.pos) ?? 0) + 1);
    if (pos.bigGuyGroup) countByGroup.set(pos.bigGuyGroup, (countByGroup.get(pos.bigGuyGroup) ?? 0) + 1);
  }

  // Positional maximums.
  for (const [posName, n] of countByPos) {
    const pos = posByName.get(posName.toLowerCase())!;
    if (n > pos.max) err("pos.max", `Too many ${pos.pos}: ${n} taken, max ${pos.max}.`);
  }
  // Big Guy group maximums (mutually-exclusive Big Guy choices sharing a cap).
  if (team?.bigGuyGroups) {
    for (const [group, n] of countByGroup) {
      const g = team.bigGuyGroups[group];
      if (g && n > g.max) err("pos.grouptmax", `Too many Big Guys: ${n} taken, max ${g.max}. ${g.note ?? ""}`.trim());
    }
  }

  const regularCount = roster.players.length;
  const starCount = roster.stars.length;
  const totalCount = regularCount + starCount;

  if (regularCount < rulepack.rosterRules.minPlayers)
    err("players.min", `A team needs at least ${rulepack.rosterRules.minPlayers} regular players (have ${regularCount}).`);
  if (totalCount > rulepack.rosterRules.maxPlayers)
    err("players.max", `A roster may have at most ${rulepack.rosterRules.maxPlayers} players (have ${totalCount}).`);

  // ---------- Re-rolls, apothecary ----------
  let otherGold = 0;
  const { min: rrMin, max: rrMax } = rulepack.rosterRules.rerolls;
  if (roster.rerolls < rrMin || roster.rerolls > rrMax)
    err("reroll.range", `Team re-rolls must be between ${rrMin} and ${rrMax} (have ${roster.rerolls}).`);
  if (team?.rerollCost != null) otherGold += roster.rerolls * team.rerollCost;
  else if (roster.rerolls > 0) err("reroll.nocost", `No re-roll cost defined for ${roster.teamName}.`);

  if (roster.apothecary) {
    if (!rulepack.rosterRules.apothecary.allowed) err("apo.disallowed", "Apothecaries are not allowed by this rulepack.");
    else if (team && !team.apothecary) err("apo.team", `${roster.teamName} teams may not take an Apothecary.`);
    else otherGold += rulepack.rosterRules.apothecary.cost;
  }

  // ---------- Stars ----------
  let starGold = 0;
  let hasSecretWeaponStar = false;
  const bannedLower = new Set(rulepack.starPlayers.banned.map((b) => b.toLowerCase()));
  const seenStars = new Set<string>();
  for (const s of roster.stars) {
    starGold += s.cost;
    if (s.secretWeapon) hasSecretWeaponStar = true;
    if (bannedLower.has(s.name.toLowerCase())) err("star.banned", `${s.name} is a banned Star Player.`);
    if (seenStars.has(s.name.toLowerCase())) err("star.dupe", `${s.name} is listed twice on this roster.`);
    seenStars.add(s.name.toLowerCase());
  }
  if (starCount > 0) {
    if (rpTeam && !rpTeam.starEligible) err("star.ineligible", `${roster.teamName} may not induce Star Players.`);
    if (regularCount < rulepack.rosterRules.minRegularPlayersBeforeStars)
      err("star.min11", `You must hire at least ${rulepack.rosterRules.minRegularPlayersBeforeStars} regular players before inducing any Star Players.`);
    warn("star.squad", "Star Players must be unique across your 6-team squad — this can't be checked on a single roster. Make sure no team-mate has the same star.");
  }

  // Star tax (SPP), based on cumulative star gold cost.
  let starTax = 0;
  if (starGold > 0) {
    const band = rulepack.starPlayers.starTaxSpp.find(
      (b) => starGold >= b.minCumulativeCost && (b.maxCumulativeCost == null || starGold <= b.maxCumulativeCost),
    );
    if (band) starTax = band.taxSpp;
  }

  // ---------- Inducements ----------
  let inducementGold = 0;
  const indByKey = new Map(rulepack.inducements.map((i) => [i.key, i]));
  for (const [key, qtyRaw] of Object.entries(roster.inducements ?? {})) {
    const qty = qtyRaw || 0;
    if (qty <= 0) continue;
    const ind = indByKey.get(key);
    if (!ind) { err("ind.unknown", `Inducement "${key}" is not permitted by this rulepack.`); continue; }

    // Per-item cost with team discounts.
    let unit = ind.cost;
    if (key === "bribes" && team?.briberyAndCorruption && ind.costBriberyCorruption != null) unit = ind.costBriberyCorruption;
    if (key === "halfling_master_chef" && team?.halflingTeam && ind.costHalflingTeams != null) unit = ind.costHalflingTeams;
    inducementGold += unit * qty;

    // Caps.
    let cap = ind.max ?? ind.maxDefault ?? Infinity;
    if (key === "bribes" && hasSecretWeaponStar && ind.maxIfSecretWeaponStar != null) cap = ind.maxIfSecretWeaponStar;
    if (qty > cap) err("ind.max", `Too many ${ind.name}: ${qty} taken, max ${cap}.`);

    // Team restrictions.
    if (ind.restrictedToTeams) {
      const ok = ind.restrictedToTeams.some((r) => matchesTeamRestriction(r, team));
      if (!ok) err("ind.restricted", `${ind.name} may only be taken by ${ind.restrictedToTeams.join("/")} teams.`);
    }
  }

  // ---------- Skills / SPP ----------
  let skillSpp = 0;
  let stackedPlayers = 0;
  const eliteSet = new Set(skills.eliteSkills.map((s) => s.toLowerCase()));

  for (const pl of roster.players) {
    const pos = posByName.get(pl.pos.toLowerCase());
    if (!pos) continue;
    const purchased = pl.skills ?? [];
    if (purchased.length === 0) continue;
    if (purchased.length > rulepack.skillCosts.maxSkillsPerPlayer)
      err("skill.maxper", `${pos.pos} has ${purchased.length} purchased skills (max ${rulepack.skillCosts.maxSkillsPerPlayer} per player).`);
    if (purchased.length >= 2) stackedPlayers++;

    const startingLower = new Set(pos.skills.map((s) => s.toLowerCase()));
    const seen = new Set<string>();

    purchased.forEach((skName, i) => {
      const def: SkillDef | undefined = resolveSkill(skName);
      if (!def) { err("skill.unknown", `Unknown skill "${skName}" on ${pos.pos}.`); return; }
      if (!def.purchasable || def.cat === "Trait") { err("skill.trait", `"${def.name}" is a trait and cannot be purchased.`); return; }
      if (startingLower.has(def.name.toLowerCase())) err("skill.duplicate", `${pos.pos} already starts with "${def.name}".`);
      if (seen.has(def.name.toLowerCase())) err("skill.duplicate2", `${pos.pos} has "${def.name}" purchased twice.`);
      seen.add(def.name.toLowerCase());

      const cat = def.cat as Exclude<SkillDef["cat"], "Trait">;
      const isPrimary = pos.prim.includes(cat);
      const isSecondary = pos.sec.includes(cat);
      if (!isPrimary && !isSecondary) {
        err("skill.access", `${pos.pos} has no access to "${def.name}" (${cat}).`);
        return;
      }
      const first = i === 0;
      let cost: number;
      if (isPrimary) cost = first ? rulepack.skillCosts.primaryFirst : rulepack.skillCosts.primarySecond;
      else cost = first ? rulepack.skillCosts.secondaryFirst : rulepack.skillCosts.secondarySecond;
      if (eliteSet.has(def.name.toLowerCase()) || def.elite) cost += rulepack.skillCosts.eliteSurcharge;
      skillSpp += cost;
    });
  }

  // Stacking limits.
  const stackLimit = rpTeam ? { none: 0, one: 1, two: 2 }[rpTeam.stacking] : 0;
  if (stackedPlayers > stackLimit) {
    const label = rpTeam?.stacking === "none"
      ? "This team cannot stack skills — no player may take a 2nd skill"
      : `This team may stack skills on at most ${stackLimit} player${stackLimit === 1 ? "" : "s"}`;
    err("skill.stack", `${label}. You have ${stackedPlayers} players with two purchased skills.`);
  }

  // ---------- Totals ----------
  const sppSpent = skillSpp + starTax;
  const goldSpent = playerGold + otherGold + starGold + inducementGold;

  if (goldSpent > goldBudget) err("gold.over", `Over gold budget: spent ${gp(goldSpent)} of ${gp(goldBudget)}.`);
  if (sppSpent > sppBudget) err("spp.over", `Over SPP budget: spent ${sppSpent} of ${sppBudget} SPP${starTax ? ` (incl. ${starTax} star tax)` : ""}.`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      goldBudget,
      goldSpent,
      goldRemaining: goldBudget - goldSpent,
      sppBudget,
      sppSpent,
      sppRemaining: sppBudget - sppSpent,
      regularPlayers: regularCount,
      starPlayers: starCount,
      totalPlayers: totalCount,
      stackedPlayers,
      starTax,
    },
  };
}

function matchesTeamRestriction(restriction: string, team?: TeamDef): boolean {
  if (!team) return false;
  const r = restriction.toLowerCase();
  if (r === "ogre") return !!team.ogreTeam || team.name.toLowerCase() === "ogres";
  if (r === "snotling") return !!team.snotlingTeam || team.name.toLowerCase() === "snotlings";
  if (r === "halfling") return !!team.halflingTeam || team.name.toLowerCase() === "halflings";
  return team.name.toLowerCase() === r;
}

// Shared domain types for the roster builder.

export type SkillCategory = "G" | "A" | "S" | "P" | "M" | "D";

export interface SkillDef {
  name: string;
  cat: SkillCategory | "Trait";
  purchasable: boolean;
  elite?: boolean;
  aliases?: string[];
}

export interface SkillsData {
  eliteSkills: string[];
  skills: SkillDef[];
}

export interface Positional {
  pos: string;
  role: string;
  max: number;
  cost: number;
  ma: number;
  st: number;
  ag: string;
  pa: string;
  av: string;
  skills: string[];       // starting skills/traits (free)
  prim: SkillCategory[];
  sec: SkillCategory[];
  bigGuy?: boolean;
  bigGuyGroup?: string;
  secretWeapon?: boolean;
}

export interface TeamDef {
  name: string;
  rerollCost: number | null;
  apothecary: boolean;
  briberyAndCorruption?: boolean;
  halflingTeam?: boolean;
  ogreTeam?: boolean;
  snotlingTeam?: boolean;
  specialRules: string[];
  positionals: Positional[];
  bigGuyGroups?: Record<string, { max: number; note?: string }>;
  _status?: string;
}

export interface TeamsData {
  teams: TeamDef[];
}

// ---- Rulepack ----

export type StackingMode = "none" | "one" | "two";

export interface RulepackTeam {
  name: string;
  gold: number;
  spp: number;
  stacking: StackingMode;
  starEligible: boolean;
}

export interface Inducement {
  key: string;
  name: string;
  cost: number;
  max?: number;
  maxDefault?: number;
  maxIfSecretWeaponStar?: number;
  costBriberyCorruption?: number;
  costHalflingTeams?: number;
  restrictedToTeams?: string[];
}

export interface Rulepack {
  id: string;
  name: string;
  edition: string;
  isLatest: boolean;
  baseEdition: string;
  sourceUrl?: string;
  notes?: string;
  rosterRules: {
    minRegularPlayersBeforeStars: number;
    minPlayers: number;
    maxPlayers: number;
    rerolls: { min: number; max: number };
    apothecary: { allowed: boolean; cost: number };
  };
  skillCosts: {
    primaryFirst: number;
    secondaryFirst: number;
    primarySecond: number;
    secondarySecond: number;
    eliteSurcharge: number;
    maxSkillsPerPlayer: number;
  };
  eliteSkills: { list: string[] };
  inducements: Inducement[];
  starPlayers: {
    banned: string[];
    starTaxSpp: { minCumulativeCost: number; maxCumulativeCost: number | null; taxSpp: number }[];
  };
  teams: RulepackTeam[];
}

// ---- Star players ----

export interface StarPlayerDef {
  name: string;
  cost: number;
  secretWeapon?: boolean;
}

export interface StarsData {
  byTeam: Record<string, StarPlayerDef[]>;
}

// ---- Roster (saved payload) ----

export interface RosterPlayer {
  id: string;          // unique within the roster
  pos: string;         // positional name (matches TeamDef.positionals[].pos)
  skills: string[];    // PURCHASED skills (in purchase order)
}

export interface RosterStar {
  name: string;
  cost: number;
  secretWeapon?: boolean;
}

export interface RosterPayload {
  teamName: string;
  rulepackId: string;
  rulepackEdition: string;
  players: RosterPlayer[];
  rerolls: number;
  apothecary: boolean;
  inducements: Record<string, number>;   // inducement key -> qty
  stars: RosterStar[];
  coachName?: string;
  notes?: string;
}

// ---- Validation result ----

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    goldBudget: number;
    goldSpent: number;
    goldRemaining: number;
    sppBudget: number;
    sppSpent: number;
    sppRemaining: number;
    regularPlayers: number;
    starPlayers: number;
    totalPlayers: number;
    stackedPlayers: number;   // players with 2 purchased skills
    starTax: number;
  };
}

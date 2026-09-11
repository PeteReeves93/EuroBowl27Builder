// Server-side helper: validate a stored roster against the LATEST rulepack,
// and note whether it was built on an older edition.
import { getLatestRulepack, getTeam, getSkillsData } from "@/lib/data";
import { validateRoster } from "@/lib/validation";
import type { RosterPayload, ValidationResult } from "@/types";

export interface RosterValidity {
  result: ValidationResult;
  builtEdition: string;
  latestEdition: string;
  stale: boolean; // built on an older edition than the latest
}

export function checkStoredRoster(payload: RosterPayload): RosterValidity {
  const latest = getLatestRulepack();
  const team = getTeam(payload.teamName);
  const skills = getSkillsData();
  const result = validateRoster(payload, team, latest, skills);
  return {
    result,
    builtEdition: payload.rulepackEdition,
    latestEdition: latest.edition,
    stale: payload.rulepackEdition !== latest.edition,
  };
}

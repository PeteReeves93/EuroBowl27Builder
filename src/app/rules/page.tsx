import type { Metadata } from "next";
import { getLatestRulepack } from "@/lib/data";
import type { Rulepack } from "@/types";

export const metadata: Metadata = {
  title: "NAF World Cup 2027 — Rules | Team England Pathway Pals",
  description: "The NAF World Cup 2027 draft ruleset used by the roster builder.",
};

// Public page — no auth gate. (Dynamic because the shared header reads the session.)
export const dynamic = "force-dynamic";

function gp(n: number) { return `${n.toLocaleString("en-GB")} gp`; }

export default function RulesPage() {
  const rp = getLatestRulepack() as Rulepack & {
    notes?: string;
    stackingKey?: Record<string, string>;
    scoring?: {
      individual?: Record<string, unknown>;
      squad?: Record<string, unknown>;
      individualTiebreakers?: string[];
      squadTiebreakers?: string[];
    };
    inducementRules?: { _note?: string };
    starPlayers: Rulepack["starPlayers"] & { doubleBookRule?: string };
  };
  const teams = [...rp.teams].sort((a, b) => a.name.localeCompare(b.name));
  const stackLabel = (s: string) => (s === "none" ? "—" : s === "one" ? "1 player" : "2 players");

  return (
    <div className="space-y-8">
      <header className="border-b border-gray-200 pb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-lion-red">Ruleset {rp.edition}</div>
        <h1 className="text-3xl font-black">{rp.name}</h1>
        {rp.notes && <p className="mt-2 max-w-3xl text-sm text-gray-600">{rp.notes}</p>}
        {rp.sourceUrl && (
          <a href={rp.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-lion-red hover:underline">
            Official rules pack (PDF) →
          </a>
        )}
      </header>

      {/* Tiers */}
      <section>
        <h2 className="mb-1 text-xl font-bold">Tiers — Gold &amp; SPP budgets</h2>
        <p className="mb-3 text-sm text-gray-500">Each team has a fixed Gold Budget and an SPP budget for skills, plus a stacking allowance and whether it may take Star Players.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-gray-400">
                <th className="py-2">Team</th><th>Gold</th><th>SPP</th><th>Skill stacking</th><th>Star Players</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.name} className="border-b last:border-0">
                  <td className="py-1.5 font-medium">{t.name}</td>
                  <td>{gp(t.gold)}</td>
                  <td>{t.spp} SPP</td>
                  <td>{stackLabel(t.stacking)}</td>
                  <td>{t.starEligible ? <span className="badge badge-valid">Yes</span> : <span className="text-gray-400">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rp.stackingKey && (
          <ul className="mt-3 space-y-1 text-xs text-gray-500">
            {Object.entries(rp.stackingKey).map(([k, v]) => <li key={k}><b className="uppercase">{k}:</b> {v}</li>)}
          </ul>
        )}
      </section>

      {/* Team creation + skills */}
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-xl font-bold">Creating your team</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>Hire at least <b>{rp.rosterRules.minPlayers}</b> regular players (max <b>{rp.rosterRules.maxPlayers}</b>).</li>
            <li>At least <b>{rp.rosterRules.minRegularPlayersBeforeStars}</b> regular players before any Star Players.</li>
            <li>Team re-rolls: {rp.rosterRules.rerolls.min}–{rp.rosterRules.rerolls.max} (team cost each).</li>
            <li>Apothecary: {rp.rosterRules.apothecary.allowed ? `${gp(rp.rosterRules.apothecary.cost)} where the team allows one` : "not allowed"}.</li>
            <li>Unspent gold and SPP are permanently lost.</li>
            <li>Random skills and characteristic improvements are not allowed.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-bold">Skill purchase costs</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>1st skill — Primary: <b>{rp.skillCosts.primaryFirst}</b> · Secondary: <b>{rp.skillCosts.secondaryFirst}</b> SPP</li>
            <li>2nd skill — Primary: <b>{rp.skillCosts.primarySecond}</b> · Secondary: <b>{rp.skillCosts.secondarySecond}</b> SPP</li>
            <li>Max <b>{rp.skillCosts.maxSkillsPerPlayer}</b> purchased skills per player.</li>
            <li>Elite skills cost <b>+{rp.skillCosts.eliteSurcharge}</b> SPP each: {rp.eliteSkills.list.join(", ")}.</li>
          </ul>
        </section>
      </div>

      {/* Inducements */}
      <section>
        <h2 className="mb-2 text-xl font-bold">Allowed inducements</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {rp.inducements.map((i) => (
            <div key={i.key} className="flex items-baseline justify-between gap-2 border-b py-1 text-sm">
              <span>{i.name}
                {i.restrictedToTeams && <span className="text-xs text-gray-400"> ({i.restrictedToTeams.join("/")} only)</span>}
              </span>
              <span className="text-gray-600">
                {gp(i.cost)}
                {i.costBriberyCorruption != null && <span className="text-xs text-gray-400"> · {gp(i.costBriberyCorruption)} B&amp;C</span>}
                {i.costHalflingTeams != null && <span className="text-xs text-gray-400"> · {gp(i.costHalflingTeams)} Halfling</span>}
                {(i.max ?? i.maxDefault) != null && <span className="text-xs text-gray-400"> · max {i.max ?? i.maxDefault}</span>}
              </span>
            </div>
          ))}
        </div>
        {rp.inducementRules?._note && <p className="mt-2 text-xs text-gray-500">{rp.inducementRules._note}</p>}
      </section>

      {/* Star players */}
      <section>
        <h2 className="mb-2 text-xl font-bold">Star Players</h2>
        <p className="text-sm text-gray-700">Only teams marked with Star Players in the tier table may induce them, and only after {rp.rosterRules.minRegularPlayersBeforeStars} regular players. Each specific star may appear only once across a 6-team squad.</p>
        <div className="mt-3">
          <div className="text-sm font-semibold">Star tax (SPP), by cumulative star cost:</div>
          <ul className="mt-1 text-sm text-gray-700">
            {rp.starPlayers.starTaxSpp.map((b, i) => (
              <li key={i}>
                {gp(b.minCumulativeCost)}{b.maxCumulativeCost != null ? ` – ${gp(b.maxCumulativeCost)}` : "+"}: <b>{b.taxSpp} SPP</b>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <div className="text-sm font-semibold text-red-700">Banned Star Players</div>
          <p className="text-sm text-gray-600">{rp.starPlayers.banned.join(", ")}</p>
        </div>
      </section>

      {/* Scoring */}
      {rp.scoring && (
        <section>
          <h2 className="mb-2 text-xl font-bold">Scoring &amp; tiebreakers</h2>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="font-semibold">Individual</div>
              <p className="text-gray-700">Win 5 · Draw 2 · Loss 0 · Concession −5.</p>
              {rp.scoring.individualTiebreakers && <p className="mt-1 text-xs text-gray-500">Tiebreakers: {rp.scoring.individualTiebreakers.join(" → ")}</p>}
            </div>
            <div>
              <div className="font-semibold">Squad</div>
              <p className="text-gray-700">Win 5 · Draw 2 · Loss 0. A squad wins a round on combined individual points.</p>
              {rp.scoring.squadTiebreakers && <p className="mt-1 text-xs text-gray-500">Tiebreakers: {rp.scoring.squadTiebreakers.join(" → ")}</p>}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-400">
        Rendered from the roster builder&apos;s {rp.edition} rulepack. This is a convenience reference — the official pack is authoritative.
      </footer>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TeamsData, Rulepack, SkillsData, RosterPayload, RosterPlayer, RosterStar,
  TeamDef, Positional, SkillCategory, StarsData, StarPlayerDef,
} from "@/types";
import { validateRoster } from "@/lib/validation";

interface Props {
  teamsData: TeamsData;
  rulepack: Rulepack;
  skills: SkillsData;
  starsData: StarsData;
  existing?: { id: string; name: string; payload: RosterPayload };
}

const CAT_NAMES: Record<SkillCategory, string> = {
  G: "General", A: "Agility", S: "Strength", P: "Passing", M: "Mutations", D: "Devious",
};

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function RosterBuilder({ teamsData, rulepack, skills, starsData, existing }: Props) {
  const router = useRouter();
  const buildableTeams = rulepack.teams.map((t) => t.name).sort((a, b) => a.localeCompare(b));

  const [name, setName] = useState(existing?.name ?? "");
  const [coachName, setCoachName] = useState(existing?.payload.coachName ?? "");
  const [teamName, setTeamName] = useState(existing?.payload.teamName ?? buildableTeams[0]);
  const [players, setPlayers] = useState<RosterPlayer[]>(existing?.payload.players ?? []);
  const [rerolls, setRerolls] = useState(existing?.payload.rerolls ?? 0);
  const [apothecary, setApothecary] = useState(existing?.payload.apothecary ?? false);
  const [inducements, setInducements] = useState<Record<string, number>>(existing?.payload.inducements ?? {});
  const [stars, setStars] = useState<RosterStar[]>(existing?.payload.stars ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team: TeamDef | undefined = teamsData.teams.find((t) => t.name === teamName);
  const rpTeam = rulepack.teams.find((t) => t.name === teamName);
  const teamStars = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const banned = new Set(rulepack.starPlayers.banned.map(norm));
    const key = Object.keys(starsData.byTeam).find((k) => k.toLowerCase() === teamName.toLowerCase());
    const list = key ? starsData.byTeam[key] : [];
    return list.filter((s) => !banned.has(norm(s.name)));
  }, [starsData, teamName, rulepack]);
  const skillIndex = useMemo(() => {
    const m = new Map<string, (typeof skills.skills)[number]>();
    for (const s of skills.skills) { m.set(s.name.toLowerCase(), s); (s.aliases ?? []).forEach((a) => m.set(a.toLowerCase(), s)); }
    return m;
  }, [skills]);

  const payload: RosterPayload = useMemo(() => ({
    teamName, rulepackId: rulepack.id, rulepackEdition: rulepack.edition,
    players, rerolls, apothecary, inducements, stars, coachName,
  }), [teamName, rulepack, players, rerolls, apothecary, inducements, stars, coachName]);

  const validation = useMemo(() => validateRoster(payload, team, rulepack, skills), [payload, team, rulepack, skills]);

  function changeTeam(next: string) {
    setTeamName(next);
    setPlayers([]); setRerolls(0); setApothecary(false); setInducements({}); setStars([]);
  }

  function addPlayer(posName: string) {
    if (!posName) return;
    setPlayers((p) => [...p, { id: uid(), pos: posName, skills: [] }]);
  }
  function removePlayer(id: string) { setPlayers((p) => p.filter((x) => x.id !== id)); }
  function addSkill(id: string, skill: string) {
    if (!skill) return;
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, skills: [...x.skills, skill] } : x)));
  }
  function removeSkill(id: string, i: number) {
    setPlayers((p) => p.map((x) => (x.id === id ? { ...x, skills: x.skills.filter((_, j) => j !== i) } : x)));
  }

  // purchasable skills a positional can take (category in prim/sec, not already owned)
  function availableSkills(pos: Positional, owned: string[]): { name: string; cost: number; access: string; elite: boolean }[] {
    const ownedLower = new Set([...pos.skills, ...owned].map((s) => s.toLowerCase()));
    const nth = owned.length; // 0 => first purchase, 1 => second
    const out: { name: string; cost: number; access: string; elite: boolean }[] = [];
    for (const s of skills.skills) {
      if (!s.purchasable || s.cat === "Trait") continue;
      if (ownedLower.has(s.name.toLowerCase())) continue;
      const cat = s.cat as SkillCategory;
      const isPrim = pos.prim.includes(cat);
      const isSec = pos.sec.includes(cat);
      if (!isPrim && !isSec) continue;
      let cost = isPrim
        ? (nth === 0 ? rulepack.skillCosts.primaryFirst : rulepack.skillCosts.primarySecond)
        : (nth === 0 ? rulepack.skillCosts.secondaryFirst : rulepack.skillCosts.secondarySecond);
      const elite = !!s.elite || skills.eliteSkills.map((e) => e.toLowerCase()).includes(s.name.toLowerCase());
      if (elite) cost += rulepack.skillCosts.eliteSurcharge;
      out.push({ name: s.name, cost, access: isPrim ? "Primary" : "Secondary", elite });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = existing
        ? await fetch(`/api/rosters/${existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, payload }) })
        : await fetch(`/api/rosters`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      router.push(`/rosters/${existing?.id ?? data.roster.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  const s = validation.summary;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* LEFT: builder */}
      <div className="space-y-5">
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Roster name</span>
              <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reikland Reavers" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Coach / squad slot (optional)</span>
              <input className="input w-full" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="e.g. Pete" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Team</span>
              <select className="input w-full" value={teamName} onChange={(e) => changeTeam(e.target.value)}>
                {buildableTeams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            {rpTeam && (
              <div className="flex items-end text-xs text-gray-500">
                <span>Budget: <b>{rpTeam.gold.toLocaleString("en-GB")} gp</b> · <b>{rpTeam.spp} SPP</b> · stacking: <b>{rpTeam.stacking}</b> · stars: <b>{rpTeam.starEligible ? "yes" : "no"}</b></span>
              </div>
            )}
          </div>
        </div>

        {/* Players */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Players ({players.length})</h2>
            <AddPositional team={team} onAdd={addPlayer} />
          </div>
          <div className="space-y-2">
            {players.length === 0 && <p className="text-sm text-gray-500">Add your line-up above. You need at least {rulepack.rosterRules.minPlayers} players.</p>}
            {players.map((pl, idx) => {
              const pos = team?.positionals.find((p) => p.pos === pl.pos);
              if (!pos) return null;
              const avail = availableSkills(pos, pl.skills);
              const canBuyMore = pl.skills.length < rulepack.skillCosts.maxSkillsPerPlayer;
              return (
                <div key={pl.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{idx + 1}</span>
                    <span className="font-medium">{pos.pos}</span>
                    <span className="text-xs text-gray-500">
                      {pos.cost.toLocaleString("en-GB")} gp · MA{pos.ma} ST{pos.st} AG{pos.ag} PA{pos.pa} AV{pos.av}
                    </span>
                    <span className="text-xs text-gray-400" title="skill-category access">
                      [{pos.prim.join("")}/{pos.sec.join("") || "–"}]
                    </span>
                    <button className="ml-auto text-xs text-red-600 hover:underline" onClick={() => removePlayer(pl.id)}>Remove</button>
                  </div>
                  {pos.skills.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">Starts with: {pos.skills.join(", ")}</div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {pl.skills.map((sk, i) => (
                      <span key={i} className="badge bg-lion-red/10 text-lion-dark">
                        {sk}
                        <button className="ml-1 text-red-500" onClick={() => removeSkill(pl.id, i)}>×</button>
                      </span>
                    ))}
                    {canBuyMore && avail.length > 0 && (
                      <select
                        className="input py-1 text-xs"
                        value=""
                        onChange={(e) => { addSkill(pl.id, e.target.value); e.target.value = ""; }}
                      >
                        <option value="">+ add skill…</option>
                        {avail.map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.name} — {a.cost} SPP ({a.access[0]}{a.elite ? ", Elite" : ""})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team stuff */}
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Team re-rolls, staff & inducements</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">Team re-rolls ({team?.rerollCost?.toLocaleString("en-GB") ?? "?"} gp each, max {rulepack.rosterRules.rerolls.max})</span>
              <input type="number" min={0} max={rulepack.rosterRules.rerolls.max} className="input w-24" value={rerolls}
                onChange={(e) => setRerolls(Math.max(0, Number(e.target.value)))} />
            </label>
            {rulepack.rosterRules.apothecary.allowed && (
              <label className="flex items-end gap-2 text-sm">
                <input type="checkbox" checked={apothecary} disabled={!team?.apothecary}
                  onChange={(e) => setApothecary(e.target.checked)} />
                <span>Apothecary ({rulepack.rosterRules.apothecary.cost.toLocaleString("en-GB")} gp){!team?.apothecary && " — not available for this team"}</span>
              </label>
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rulepack.inducements.filter((ind) => {
              if (!ind.restrictedToTeams) return true;
              return ind.restrictedToTeams.some((r) => {
                const rl = r.toLowerCase();
                if (rl === "ogre") return !!team?.ogreTeam || team?.name.toLowerCase() === "ogres";
                if (rl === "snotling") return !!team?.snotlingTeam || team?.name.toLowerCase() === "snotlings";
                if (rl === "halfling") return !!team?.halflingTeam || team?.name.toLowerCase() === "halflings";
                return team?.name.toLowerCase() === rl;
              });
            }).map((ind) => {
              let unit = ind.cost;
              if (ind.key === "bribes" && team?.briberyAndCorruption && ind.costBriberyCorruption != null) unit = ind.costBriberyCorruption;
              if (ind.key === "halfling_master_chef" && team?.halflingTeam && ind.costHalflingTeams != null) unit = ind.costHalflingTeams;
              const cap = ind.max ?? ind.maxDefault;
              return (
                <label key={ind.key} className="flex items-center justify-between gap-2 rounded border border-gray-200 px-2 py-1 text-sm">
                  <span>{ind.name} <span className="text-xs text-gray-500">({unit.toLocaleString("en-GB")} gp{cap ? `, max ${cap}` : ""})</span></span>
                  <input type="number" min={0} max={cap ?? undefined} className="input w-16 py-1"
                    value={inducements[ind.key] ?? 0}
                    onChange={(e) => setInducements((m) => ({ ...m, [ind.key]: Math.max(0, Number(e.target.value)) }))} />
                </label>
              );
            })}
          </div>
        </div>

        {/* Stars */}
        {rpTeam?.starEligible && (
          <div className="card p-4">
            <h2 className="mb-1 font-semibold">Star Players</h2>
            <p className="mb-3 text-xs text-gray-500">Only after {rulepack.rosterRules.minRegularPlayersBeforeStars} regular players. Star tax in SPP applies. Banned stars are hidden. Secret-weapon stars drop your Bribes cap to 2.</p>
            <StarPicker available={teamStars} stars={stars} setStars={setStars} />
          </div>
        )}

        {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>

      {/* RIGHT: validation panel */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className={`card p-4 ${validation.valid ? "ring-green-300" : "ring-red-300"}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Validation</h2>
            {validation.valid ? <span className="badge badge-valid">Legal</span> : <span className="badge badge-invalid">Illegal</span>}
          </div>
          <dl className="space-y-1.5 text-sm">
            <Row label="Gold" spent={s.goldSpent} budget={s.goldBudget} suffix=" gp" />
            <Row label="SPP" spent={s.sppSpent} budget={s.sppBudget} />
            <div className="flex justify-between text-xs text-gray-500"><dt>Players</dt><dd>{s.regularPlayers} regular{s.starPlayers ? ` + ${s.starPlayers} star` : ""} = {s.totalPlayers}</dd></div>
            <div className="flex justify-between text-xs text-gray-500"><dt>Skill stacks</dt><dd>{s.stackedPlayers}</dd></div>
            {s.starTax > 0 && <div className="flex justify-between text-xs text-gray-500"><dt>Star tax</dt><dd>{s.starTax} SPP</dd></div>}
          </dl>

          {validation.errors.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase text-red-600">Errors</div>
              <ul className="mt-1 space-y-1 text-sm text-red-700">
                {validation.errors.map((e, i) => <li key={i}>• {e.message}</li>)}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase text-amber-600">Notes</div>
              <ul className="mt-1 space-y-1 text-sm text-amber-700">
                {validation.warnings.map((w, i) => <li key={i}>• {w.message}</li>)}
              </ul>
            </div>
          )}

          <button className="btn btn-primary mt-4 w-full" disabled={saving || !name.trim()} onClick={save}>
            {saving ? "Saving…" : existing ? "Save changes" : "Save roster"}
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">Rosters save even if illegal — validity is shown, not enforced.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, spent, budget, suffix = "" }: { label: string; spent: number; budget: number; suffix?: string }) {
  const over = spent > budget;
  return (
    <div className="flex justify-between">
      <dt className="text-gray-600">{label}</dt>
      <dd className={over ? "font-semibold text-red-600" : "font-medium"}>
        {spent.toLocaleString("en-GB")}{suffix} / {budget.toLocaleString("en-GB")}{suffix}
        <span className="ml-1 text-xs text-gray-400">({(budget - spent).toLocaleString("en-GB")} left)</span>
      </dd>
    </div>
  );
}

function AddPositional({ team, onAdd }: { team?: TeamDef; onAdd: (pos: string) => void }) {
  if (!team) return null;
  return (
    <select className="input py-1 text-sm" value="" onChange={(e) => { onAdd(e.target.value); e.target.value = ""; }}>
      <option value="">+ add player…</option>
      {team.positionals.map((p) => (
        <option key={p.pos} value={p.pos}>{p.pos} — {p.cost.toLocaleString("en-GB")} gp (0-{p.max})</option>
      ))}
    </select>
  );
}

function StarPicker({ available, stars, setStars }: { available: StarPlayerDef[]; stars: RosterStar[]; setStars: (s: RosterStar[]) => void }) {
  const chosen = new Set(stars.map((s) => s.name.toLowerCase()));
  const selectable = available.filter((a) => !chosen.has(a.name.toLowerCase()));
  return (
    <div>
      <div className="space-y-1">
        {stars.map((st, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-medium">{st.name}</span>
            <span className="text-xs text-gray-500">{st.cost.toLocaleString("en-GB")} gp{st.secretWeapon ? " · secret weapon" : ""}</span>
            <button className="ml-auto text-xs text-red-600 hover:underline" onClick={() => setStars(stars.filter((_, j) => j !== i))}>remove</button>
          </div>
        ))}
      </div>
      {selectable.length > 0 ? (
        <select
          className="input mt-2 py-1 text-sm"
          value=""
          onChange={(e) => {
            const star = available.find((a) => a.name === e.target.value);
            if (star) setStars([...stars, { name: star.name, cost: star.cost, secretWeapon: !!star.secretWeapon }]);
            e.target.value = "";
          }}
        >
          <option value="">+ add star player…</option>
          {selectable.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} — {a.cost.toLocaleString("en-GB")} gp{a.secretWeapon ? " (secret weapon)" : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-xs text-gray-400">No more eligible stars to add.</p>
      )}
    </div>
  );
}

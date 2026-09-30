import type { RivalId } from "../../../content/rivals";
import { fillTemplate } from "../../format";
import { initialStored, step } from "../../machines/run";
import { addNews, addToast } from "../../news";
import type { Rng } from "../../rng";
import type { GameState } from "../../types";
import { eraOfState } from "../race";
import { rivalMachine } from "../rival";
import { P, PAPERS_PACK, pool } from "./content";
import { policyMachine, type PublicationPolicy } from "./policy";
import { publicationMachine } from "./publication";
import { createPapers, type Paper } from "./state";
import { defs } from "../../defs";

function announce(s: GameState, rng: Rng, trigger: string, paper?: Paper, vars: Record<string, string> = {}) {
  const lines = PAPERS_PACK.content?.headlines?.add?.filter((n) => n.trigger === `papers:${trigger}`) ?? [];
  if (!lines.length) return;
  const line = rng.pick(lines);
  const text = fillTemplate(line.text, { lab: s.labName, title: paper?.title ?? "", authors: String(paper?.authors ?? 0),
    venue: paper?.venue ?? "", days: String(P.reviewDays), ...vars });
  addNews(s, text, line.tone);
  addToast(s, text, line.tone);
}

function updatePull(s: GameState) {
  const ps = s.papers;
  if (!ps?.enabled) { delete s.recruitingPull; return; }
  s.recruitingPull = Math.min(P.maxPull, P.policyPull[ps.policy.value as PublicationPolicy] + ps.reputation * P.reputationPull);
}

/** Pack switch. Existing model sources remain publishable when enabled mid-game. */
export function enablePapers(s: GameState) {
  s.papers ??= createPapers();
  s.papers.enabled = true;
  updatePull(s);
}
export function disablePapers(s: GameState) {
  if (s.papers) s.papers.enabled = false;
  delete s.recruitingPull;
}
export function setPublicationPolicy(s: GameState, policy: PublicationPolicy, rng: Rng) {
  const ps = s.papers;
  if (!ps?.enabled || (policy !== "Open" && policy !== "Selective" && policy !== "Closed") || ps.policy.value === policy) return;
  ps.policy = step(policyMachine, ps.policy, { type: "SET", policy }).stored;
  updatePull(s);
  announce(s, rng, "policy", undefined, { policy });
}

/** Generic source -> draft. Random title generation is driver work; the machine owns the lifecycle. */
function draft(s: GameState, rng: Rng, source: string, importance: number) {
  const ps = s.papers!;
  const era = Math.max(0, Math.min(3, eraOfState(s) - 1));
  const title = fillTemplate(rng.pick(pool("titles")), {
    Technique: rng.pick(pool("techniques")), Thing: pool("things")[era]!, Ability: rng.pick(pool("abilities")),
    Models: rng.pick(pool("models")), N: String(rng.int(3, 99)), Goal: rng.pick(pool("goals")),
  });
  ps.list.push({ id: ps.nextId++, source, title,
    authors: rng.chance(P.manyAuthorsChance) ? P.manyAuthors : rng.int(P.authorsMin, P.authorsMax),
    venue: "", route: null, machine: initialStored(publicationMachine, {
      importance, value: importance, submittedDay: null, publishedDay: null, dueDay: null,
      scoopedBy: "", scoopedDay: null, award: "", citations: 0, critiqueDay: null,
    }),
  });
}

/** Exactly once per source, including several releases or era milestones crossed in one day. */
function discover(s: GameState, rng: Rng) {
  const ps = s.papers!;
  while (ps.modelsSeen < s.models.length) {
    const run = ++ps.modelsSeen;
    draft(s, rng, `run:${run}`, P.runImportance + P.eraImportance * (eraOfState(s) - 1));
  }
  while (ps.eraSeen < eraOfState(s)) {
    const era = ++ps.eraSeen;
    draft(s, rng, `research:era:${era}`, P.researchImportance + P.eraImportance * (era - 1));
  }
}

/** Feed positive capability through the existing rival machine hook, never rewrite its context. */
function spill(s: GameState, value: number) {
  const ps = s.papers!;
  const gain = P.spillPerImportance * value;
  s.race.rivals = s.race.rivals.map((r) => step(rivalMachine, r, { type: "SHOCK", capability: gain, hype: 0, momentum: 0 }).stored);
  ps.knowledgeSpill += gain * s.race.rivals.length;
}
function published(s: GameState, rng: Rng, paper: Paper, review: boolean) {
  const ps = s.papers!;
  const value = paper.machine.context.value;
  ps.published++;
  ps.reputation += (review ? P.reviewReputation : P.preprintReputation) * value;
  s.hype = Math.min(100, s.hype + (review ? P.reviewHype : P.preprintHype) * value);
  spill(s, value);
  announce(s, rng, review ? "accepted" : "drop", paper);
}

/** Explicit command may override the policy default, but cannot publish the same source twice. */
export function publishPaper(s: GameState, id: number, route: "preprint" | "review", rng: Rng): boolean {
  const ps = s.papers;
  const paper = ps?.list.find((p) => p.id === id);
  if (!ps?.enabled || !paper || paper.machine.value !== "draft" || (route !== "preprint" && route !== "review")) return false;
  paper.route = route;
  paper.venue = rng.pick(pool(route === "preprint" ? "preprint" : "venues"));
  const critique = rng.chance(P.critiqueChance);
  const result = step(publicationMachine, paper.machine, {
    type: route === "preprint" ? "PREPRINT" : "REVIEW", day: s.day, reviewDays: P.reviewDays,
    critiqueDay: route === "preprint" && critique ? s.day + P.critiqueDelay : null,
  });
  paper.machine = result.stored;
  for (const e of result.effects) if (e.type === "PUBLISHED") published(s, rng, paper, e.review);
  if (route === "review") announce(s, rng, "review", paper);
  updatePull(s);
  return true;
}

/** Once at midnight, after Race and Leapfrog. Drafts and published papers do no per-tick work. */
export function dailyPapers(s: GameState, rng: Rng) {
  const ps = s.papers;
  if (!ps?.enabled) return;
  discover(s, rng);
  ps.policy = step(policyMachine, ps.policy, { type: "DAY", hasResearch: ps.list.length > 0,
    closedPressure: P.closedPressurePerDay, recovery: P.pressureRecovery, maxPressure: P.maxPressure }).stored;
  for (const paper of ps.list) {
    if (paper.machine.value === "draft") {
      const decision = step(policyMachine, ps.policy, { type: "DRAFT", importance: paper.machine.context.importance, selectiveImportance: P.selectiveImportance });
      ps.policy = decision.stored;
      for (const e of decision.effects) publishPaper(s, paper.id, e.route, rng);
      continue;
    }
    const ctx = paper.machine.context;
    // Three fixed draws per active paper/day; machine transitions never draw or touch World.
    const scoopRoll = rng.next();
    const awardRoll = rng.next();
    const citationRoll = rng.next();
    const penultimate = paper.machine.value === "review" && s.day === (ctx.dueDay ?? 0) - 1;
    const scoopRival = penultimate && scoopRoll < P.scoopChance && s.race.rivals.length
      ? s.race.rivals[Math.min(s.race.rivals.length - 1, Math.floor(scoopRoll / P.scoopChance * s.race.rivals.length))]!.context.id : "";
    const eligible = paper.machine.value === "review" && s.day === ctx.dueDay && ctx.importance >= P.awardImportance && !ctx.scoopedBy;
    const award = eligible && awardRoll < P.awardChance ? rng.pick(pool("awards")) : "";
    const result = step(publicationMachine, paper.machine, { type: "DAY", day: s.day, scoopRival, scoopValue: P.scoopValue, award,
      citationGain: Math.max(0, Math.floor(P.citationsPerImportance * ctx.value * (0.5 + citationRoll))), critiqueValue: P.critiqueValue });
    paper.machine = result.stored;
    for (const e of result.effects) {
      if (e.type === "PUBLISHED") published(s, rng, paper, e.review);
      else if (e.type === "SCOOPED") {
        ps.scoops++;
        announce(s, rng, "scoop", paper, { rival: defs().rivalById[e.rival as RivalId]?.name ?? e.rival });
      } else if (e.type === "AWARDED") {
        ps.awards++;
        ps.reputation += P.awardReputation * paper.machine.context.value;
        announce(s, rng, "award", paper, { award: e.award });
      } else if (e.type === "CRITIQUED") {
        ps.critiques++;
        ps.reputation = Math.max(0, ps.reputation - P.preprintReputation * ctx.value * (1 - P.critiqueValue));
        announce(s, rng, "critique", paper);
      }
    }
  }
  updatePull(s);
}

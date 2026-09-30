// Papers (FLT-45): the panel, and the three moments worth a screenshot (the arXive drop, the scoop, the award).
// Pure: the snapshot's `papers` view in, plain JSON out. Bylines and arXive numbers are hashed from the paper id, so they are
// stable across frames, saves and screenshots without drawing a random number.
import type { Snapshot } from "../../app/hud";
import { AGENT_NICKNAMES, FIRST_NAMES, LAST_NAMES, RIVAL_SHORT } from "../../content/names";
import {
  ARXIVE_BANNER, ARXIVE_FILLER, AWARD_BUTTONS, AWARD_FOOT, DROP_BUTTONS, POLICY_COPY, PRESSURE_LINES, SCOOP_BUTTONS, SCOOP_TITLES,
} from "../../content/paperDesk";
import type { PaperMomentVM, PaperRowVM, PapersVM, PublicationPolicyVM } from "./types";

type PaperView = Snapshot["papers"]["papers"][number];

/** A moment stays up this many game days (or until dismissed). */
export const MOMENT_DAYS = 1;

const POLICIES: readonly PublicationPolicyVM[] = ["Open", "Selective", "Closed"];
const hash = (n: number, salt: number) => {
  let h = (n * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
};
const pick = <T,>(list: readonly T[], n: number, salt: number): T => list[hash(n, salt) % list.length]!;
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const count = (n: number) => n.toLocaleString("en-US");

/** "arXive:0102.04217": year and month from the game day, the rest from the id. */
export function arxiveId(id: number, day: number): string {
  return `arXive:${pad((Math.floor(day / 360) + 1) % 100, 2)}${pad(Math.floor((day % 360) / 30) + 1, 2)}.${pad(hash(id, 7) % 100000, 5)}`;
}

/** "A. Gradient, K. Backprop, Agent-0042 'Sparky' and 397 others". */
export function byline(id: number, authors: number): string {
  const person = (k: number) => `${pick(FIRST_NAMES, id, k)[0]}. ${pick(LAST_NAMES, id, k + 50)}`;
  const agent = `Agent-${pad(hash(id, 99) % 9000 + 100, 4)} '${pick(AGENT_NICKNAMES, id, 98)}'`;
  const named = authors >= 3 ? [person(1), person(2), agent] : authors === 2 ? [person(1), agent] : [person(1)];
  const others = authors - named.length;
  return others > 0 ? `${named.join(", ")} and ${count(others)} other${others === 1 ? "" : "s"}` : named.join(", ");
}

function statusOf(p: PaperView): Pick<PaperRowVM, "statusText" | "tone"> {
  switch (p.status) {
    case "draft":
      return { statusText: "Draft · waiting on you", tone: "neutral" };
    case "review":
      return p.scoopedBy
        ? { statusText: `Scooped by ${p.scoopedBy} · still in review`, tone: "bad" }
        : { statusText: `In review at ${p.venue} · ${p.daysLeft ?? 0} day${p.daysLeft === 1 ? "" : "s"} left`, tone: "neutral" };
    case "published":
      return p.route === "preprint" ? { statusText: "On arXive", tone: "good" } : { statusText: `Published at ${p.venue}`, tone: "good" };
    case "criticized":
      return { statusText: "Critique thread ongoing", tone: "bad" };
    case "awarded":
      return { statusText: p.award ?? "Award", tone: "joke" };
  }
}

export function paperRow(p: PaperView, day: number): PaperRowVM {
  const span = p.dueDay !== null && p.submittedDay !== null ? p.dueDay - p.submittedDay : 0;
  const citations = Math.floor(p.citations);
  return {
    id: String(p.id),
    arxiveId: arxiveId(p.id, p.publishedDay ?? p.submittedDay ?? day),
    title: p.title,
    byline: byline(p.id, p.authors),
    venue: p.route === "preprint" ? "arXive" : p.venue,
    status: p.status,
    ...statusOf(p),
    reviewPct: p.status === "review" && span > 0 ? Math.max(0, Math.min(1, 1 - (p.daysLeft ?? 0) / span)) : null,
    citationsText: `${count(citations)} citation${citations === 1 ? "" : "s"}`,
    award: p.award,
    scoopedBy: p.scoopedBy,
    canPublish: p.status === "draft",
  };
}

export function papersOf(snap: Snapshot, earned: boolean, open: boolean): PapersVM {
  const v = snap.papers;
  const list = v.papers;
  const drafts = list.filter((p) => p.status === "draft").length;
  const review = list.filter((p) => p.status === "review").length;
  const out = list.length - drafts - review;
  const pressure = Math.max(0, Math.min(1, v.publishPressure));
  const sorted = [...list].sort((a, b) => Number(b.status === "draft") - Number(a.status === "draft") || b.id - a.id).slice(0, 12);
  return {
    enabled: v.enabled && earned,
    open: open && v.enabled && earned,
    policy: v.policy,
    policies: POLICIES.map((id) => ({ id, label: POLICY_COPY[id].label, blurb: POLICY_COPY[id].blurb, active: id === v.policy })),
    reputation: Math.round(v.reputation),
    recruitingText: `Recruiting pull ${v.recruitingPull.toFixed(2)}×`,
    pressure,
    pressureText: PRESSURE_LINES.find(([at]) => pressure >= at)?.[1] ?? "",
    summary: `${drafts} draft${drafts === 1 ? "" : "s"} · ${review} in review · ${out} out`,
    drafts,
    papers: sorted.map((p) => paperRow(p, snap.day)),
  };
}

const rivalBy = (n: number) => `${pick(RIVAL_SHORT, n, 3)} et al.`;

/** The newest moment still on screen: an award beats a scoop beats a drop on the same day. */
export function paperMomentOf(snap: Snapshot, earned: boolean, dismissed: readonly string[]): PaperMomentVM | null {
  if (!snap.papers.enabled || !earned) return null;
  const fresh = (day: number | null) => day !== null && day <= snap.day && snap.day - day <= MOMENT_DAYS;
  const found: { kind: PaperMomentVM["kind"]; p: PaperView; day: number; rank: number }[] = [];
  for (const p of snap.papers.papers) {
    if (p.status === "awarded" && fresh(p.publishedDay)) found.push({ kind: "award", p, day: p.publishedDay!, rank: 3 });
    else if (p.scoopedBy && fresh(p.scoopedDay)) found.push({ kind: "scoop", p, day: p.scoopedDay!, rank: 2 });
    else if (p.route === "preprint" && fresh(p.publishedDay)) found.push({ kind: "drop", p, day: p.publishedDay!, rank: 1 });
  }
  const live = found.filter((m) => !dismissed.includes(`${m.kind}:${m.p.id}`)).sort((a, b) => b.day - a.day || b.rank - a.rank || b.p.id - a.p.id);
  const m = live[0];
  if (!m) return null;
  const paper = paperRow(m.p, snap.day);
  const base = { key: `${m.kind}:${m.p.id}`, kind: m.kind, paper, listing: [], rival: null, theirTitle: null, theirStamp: null, yourStamp: null, gapText: null, award: null, note: null };
  if (m.kind === "drop") {
    const others = ARXIVE_FILLER.map((f, k) => ({
      arxiveId: arxiveId(m.p.id + k + 1, m.day),
      title: f.title,
      byline: f.rival ? rivalBy(m.p.id + k) : byline(m.p.id * 31 + k, 3 + (hash(m.p.id, k) % 9)),
      you: false,
    }));
    const start = m.p.id % 3;
    const mine = { arxiveId: paper.arxiveId, title: paper.title, byline: `${snap.labName}: ${paper.byline}`, you: true };
    return { ...base, listing: [...others.slice(start, start + 2), mine, ...others.slice(start + 2, start + 4)], headline: `${snap.labName} drops '${paper.title}' on arXive`, note: ARXIVE_BANNER, buttons: [...DROP_BUTTONS] };
  }
  if (m.kind === "scoop") {
    const rival = m.p.scoopedBy!;
    const minute = pad(hash(m.p.id, 11) % 60, 2);
    return {
      ...base,
      rival,
      theirTitle: pick(SCOOP_TITLES, m.p.id, 5).replace("{title}", paper.title),
      theirStamp: `Submitted 3:${minute} am`,
      yourStamp: `Submitted 9:${minute} pm`,
      gapText: "18 hours before you",
      headline: `${rival} published it 18 hours before you`,
      buttons: [...SCOOP_BUTTONS],
    };
  }
  return { ...base, award: m.p.award, headline: `${m.p.award ?? "Best Paper"} · ${m.p.venue}`, note: AWARD_FOOT, buttons: [...AWARD_BUTTONS] };
}

// The ticker and the thoughts for Operations (FLT-10): slop, breakdowns, queues, staff. Data only.
// Templates: {lab} {pct} {name} (a building or a person). Parody names only.
import type { Headline } from "./headlines";
import type { BuildingKind } from "./buildings";
import type { Tone } from "../sim/types";

export type OpsTrigger =
  | "slop"
  | "statusPage"
  | "repaired"
  | "contractor"
  | "tote"
  | "queueLong"
  | "queueQuit"
  | `breakdown:${BuildingKind}`;

const h = (trigger: OpsTrigger, tone: Tone, text: string): Headline => ({ trigger, tone, text });

export const OPS_HEADLINES: Headline[] = [
  // Slop: it accumulates.
  h("slop", "joke", "{lab} campus now {pct}% slop by volume"),
  h("slop", "joke", "{lab} campus now {pct}% slop by volume; facilities calls it 'content'"),
  h("slop", "bad", "{pct}% of {lab}'s paths are now slop. Visitors report it is 'weirdly warm'"),
  h("slop", "joke", "{lab} unveils 'walkable content': {pct}% of the campus, unwalkable"),

  // The status page, which is never wrong (it is never updated).
  h("statusPage", "joke", "Status page: all systems operational."),
  h("statusPage", "joke", "Status page: 'investigating' (day 3)"),
  h("statusPage", "joke", "Status page: all systems operational. Some systems disagree"),
  h("statusPage", "joke", "Status page: a 'minor degradation'. The building is on fire"),

  // What broke.
  h("breakdown:cluster", "bad", "GPU fire contained; GPUs less so."),
  h("breakdown:cluster", "bad", "GPU fire contained; GPUs less so. {lab} 'exploring options', including water"),
  h("breakdown:cluster", "joke", "{lab} cluster 'runs hot' for the first time and the last"),
  h("breakdown:hall", "bad", "{lab} Training Hall loses power mid-run; loss curve now a flat line of grief"),
  h("breakdown:hall", "joke", "Training Hall down. Researchers 'blocked' and, for once, relaxed"),
  h("breakdown:gateway", "bad", "{lab} API down for a while; customers say it was 'the best week of their uptime'"),
  h("breakdown:gateway", "bad", "{lab} API returns 500s. Users report the 500s are 'honestly more accurate'"),
  h("breakdown:kombucha", "joke", "Kombucha tap fails. Researchers describe morale as 'still, and slightly sour'"),
  h("breakdown:nap", "joke", "Nap Pods stuck in sleep mode. Occupants, unbothered, remain unbothered"),
  h("breakdown:snack", "joke", "Snack Wall jams. Focus is 'a matter of opinion' until further notice"),
  h("breakdown:demo", "joke", "Demo Stage goes down live. Recording of previous demo shown in its place"),
  h("breakdown:datacenter", "bad", "{lab} Datacenter trips offline. Forty thousand GPUs learn to relax"),
  h("breakdown:gas", "bad", "{lab} Gas Turbine trips. The neighbours enjoy a rare moment of quiet"),
  h("breakdown:solar", "joke", "{lab} Solar Farm dark. Cause: 'a cloud', which the cloud team denies"),
  h("breakdown:fountain", "joke", "The Transparency Fountain has stopped. Reporters cannot tell the difference"),

  // Fixed.
  h("repaired", "good", "SRE closes the incident with the root cause 'a thing'"),
  h("repaired", "good", "Postmortem published: 'we turned it off and on. It was on fire both times'"),
  h("repaired", "good", "{lab} restores service; postmortem to follow, no date given"),
  h("repaired", "joke", "SRE receives a 'thanks' in the incident channel, which is the whole bonus"),
  h("contractor", "bad", "{lab} pays a contractor {amount} to 'have a look'. It was a wire"),
  h("contractor", "bad", "Emergency contractor bills {amount} for two minutes of work and a very confident nod"),

  // Comms.
  h("tote", "joke", "Comms Rep hands protester a tote bag; protester now protests with better storage"),
  h("tote", "joke", "{lab} statement to protesters: 'We hear you.' It is printed on the tote bag"),
  h("tote", "joke", "Protest 'de-escalated', according to the tote bag count"),

  // Queues.
  h("queueLong", "joke", "Line for the {name} now longer than {lab}'s context window"),
  h("queueLong", "joke", "Queue for the {name} 'moving quickly'. It is not moving. It is 'a process'"),
  h("queueQuit", "joke", "Visitors abandon the {name} queue, citing 'the vibes of the line'"),
];

/** What a walker thinks after stepping in slop: the first line is the one the spec asks for. */
export const SLOP_LINES = {
  researcher: [
    "This path is covered in slop.",
    "I stepped in something that was 'helpfully generated'.",
    "Is this slop? It looks a lot like the deck.",
    "Who approved a slop-based footpath?",
    "It's warm. It's grey. It has my name in it, somehow.",
  ],
  visitor: [
    "This path is covered in slop.",
    "Is the carpet supposed to sparkle? It's not carpet.",
    "I paid to see the AI. I am standing in it.",
    "My shoes are now 'synthetic content'.",
  ],
} as const;

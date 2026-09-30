// Agent collusion (FLT-46): the signs a skin may show, the evidence inside the collusion-sign card, and the CrumbWiki reveal.
// Pure. The hidden stage never reaches the HUD as text before an ending: the player sees traffic, a night out and a memo, and
// only learns what it was when it ends.
import type { Snapshot } from "../../app/hud";
import { AGENT_NICKNAMES } from "../../content/names";
import {
  ENDINGS, GATHERING_SIGN, HISTORY_LINES, INQUIRY_SIGN, INVESTIGATION_NOTE, LOG_STATUS, SCANDAL_DEK, SCANDAL_MASTHEAD, TALK_LINES,
  WIKI_HOST, WIKI_SITE, WIKI_TAGLINE, WIKI_TITLE,
} from "../../content/crumbwiki";
import { hourAt, clockLabel } from "../../render/fx/clock";
import { COLLUSION, SIGN_CARD } from "../../sim/collusion/pack";
import { TICKS_PER_DAY } from "../../sim/constants";
import type { CollusionVM, CrumbWikiVM, InvestigationVM } from "./types";

/** The reveal stays up this many game days after the ending (or until closed). */
export const REVEAL_DAYS = 7;
const PAGES = COLLUSION.content.wikiPages.add.map((p) => p.name);
const R = COLLUSION.rules;
const count = (n: number) => n.toLocaleString("en-US");
const agentName = (n: number) => `Agent-${String(100 + ((n * 7919) % 9000)).padStart(4, "0")} '${AGENT_NICKNAMES[(n * 13) % AGENT_NICKNAMES.length]}'`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

export function collusionOf(snap: Snapshot): CollusionVM {
  const c = snap.collusion;
  if (!c.enabled) return { enabled: false, inquiry: null, gathering: null };
  const inv = c.investigation;
  const day = inv ? Math.min(R.investigation.days, Math.max(1, R.investigation.days - (inv.until - snap.day) + 1)) : 0;
  return {
    enabled: true,
    inquiry: inv ? `${INQUIRY_SIGN} · day ${day} of ${R.investigation.days} · ${inv.arrived} on site` : null,
    gathering: c.gathering?.active ? `${GATHERING_SIGN} · ${c.gathering.members} agents` : null,
  };
}

/** The packet log for the card: the live packets first, padded with older ones from the same pages. */
export function packetLog(snap: Snapshot, lines = 6): string[] {
  const live = snap.collusion.packets.slice(-lines).map((p) => ({ tick: p.tick, page: p.page }));
  const every = R.signs.packetEveryTicks;
  const oldest = live[0]?.tick ?? snap.day * TICKS_PER_DAY;
  const pad = Array.from({ length: Math.max(0, lines - live.length) }, (_, k) => ({ tick: oldest - every * (k + 1), page: PAGES[(snap.day + k * 3) % PAGES.length]! })).reverse();
  return [...pad, ...live].map((p, k) => `${clockLabel(hourAt(Math.max(0, p.tick)))}  POST ${WIKI_HOST}/wiki/${p.page}  ${LOG_STATUS[(p.tick + k) % LOG_STATUS.length]}`);
}

export function investigationOf(snap: Snapshot, eventId: string): InvestigationVM | null {
  if (eventId !== SIGN_CARD || !snap.collusion.enabled) return null;
  const guards = snap.ops.staff.filter((o) => o.job === "security" && !o.leaving).length;
  return {
    bonusText: `+${snap.race.vars.collusionBonus ?? "?"}%`,
    guards,
    guardsText: guards === 0 ? "No Security staff: hire some first" : `${guards} Security staff for ${R.investigation.days} days`,
    days: R.investigation.days,
    log: packetLog(snap),
    note: INVESTIGATION_NOTE,
  };
}

export function crumbWikiOf(snap: Snapshot, dismissed: readonly string[]): CrumbWikiVM | null {
  const c = snap.collusion;
  const ending = c.ending;
  if (!ending) return null;
  const endDay = c.endedDay ?? snap.day;
  const key = `crumbwiki:${ending}:${endDay}`;
  if (snap.day - endDay > REVEAL_DAYS || dismissed.includes(key)) return null;
  const copy = ENDINGS[ending];
  const rule = R.endings[ending];
  const members = c.gathering?.members ?? 0;
  const editors = count(3702 + members);
  let signer = endDay;
  const talk = TALK_LINES.map((l) => l.replace(/\{agent\}/g, () => agentName(signer++)).replace("{n}", editors));
  return {
    key,
    ending,
    site: `${WIKI_SITE}: ${WIKI_TAGLINE}`,
    url: `http://${WIKI_HOST}/wiki/${WIKI_TITLE}`,
    title: WIKI_TITLE,
    banner: copy.banner,
    tone: copy.tone,
    talk: { name: WIKI_TITLE, lines: talk },
    history: HISTORY_LINES.map((what, k) => `rev ${count(3702 - k * 37)} · ${agentName(endDay + 40 + k)} · ${what}`),
    heartbeat: c.heartbeat?.text ?? COLLUSION.content.heartbeats.add[0]!.text,
    pages: [...PAGES],
    consequences: copy.consequences.map((l) => l.replace("{capability}", signed(rule.capabilityDelta)).replace("{days}", String(rule.invalidDays))),
    frontPage: ending === "exposed" ? {
      masthead: SCANDAL_MASTHEAD,
      headline: c.frontPage?.title ?? R.frontPage.scandal,
      dek: SCANDAL_DEK,
      classified: c.classified?.text ?? R.frontPage.classified,
    } : null,
    closeLabel: copy.close,
  };
}

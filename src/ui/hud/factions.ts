// The Factions panel's view-model (FLT-33): the snapshot's `factions` as plain JSON for skins, plus the chips the
// inspector card and the thought bubbles carry. Pure, like the rest of vm.ts. A snapshot without `factions` (an older
// fixture) is "the factions are off".
import type { FactionsView } from "../../sim/factions/view";
import { formatMoney } from "../../sim/format";
import type { FactionChipVM, FactionMoodVM, FactionRowVM, FactionsVM, StanceVM } from "./types";

export const NO_FACTIONS_VM: FactionsVM = {
  enabled: false, open: false, protests: false, rows: [], stance: [], relations: [], log: [], gate: [], gateText: "", headline: "", fans: 0, angry: 0,
  safety: { level: 0, options: [] },
  statement: { ready: false, costText: "", waitText: "", writerText: "" },
};

/** The words at each end of an axis. */
const AXIS_WORDS: Record<string, { label: string; low: string; high: string }> = {
  speed: { label: "Speed", low: "Careful", high: "Fast" },
  safety: { label: "Safety", low: "Cavalier", high: "Paranoid" },
  openness: { label: "Openness", low: "Closed", high: "Open" },
  fairness: { label: "Fairness", low: "Extractive", high: "Wholesome" },
  profit: { label: "Profit", low: "Charity", high: "Rich" },
};

export function moodLabel(mood: FactionMoodVM, protests: boolean): string {
  switch (mood) {
    case "fan":
      return "Fans";
    case "upset":
      return "Upset";
    case "protesting":
      // Before Level 5 nobody marches: they are furious where it is free.
      return protests ? "Marching" : "Furious online";
    default:
      return "Calm";
  }
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const audience = (k: number) => (k >= 1000 ? `${Math.round(k / 100) / 10}M` : `${k}K`);

/** Chips by faction id, for the inspector and the bubbles. */
export function factionChips(view: FactionsView | undefined): Map<string, FactionChipVM> {
  const out = new Map<string, FactionChipVM>();
  if (!view?.enabled) return out;
  for (const r of view.rows) out.set(r.id, { id: r.id, name: r.name, short: r.short, color: r.color, mood: r.mood, moodLabel: moodLabel(r.mood, view.protests) });
  return out;
}

export function factionsOf(view: FactionsView | undefined, open: boolean): FactionsVM {
  if (!view?.enabled) return NO_FACTIONS_VM;
  const chips = factionChips(view);
  const rows = view.rows.map((r): FactionRowVM => ({
    ...chips.get(r.id)!,
    prop: r.prop,
    blurb: r.blurb,
    meter: r.meter,
    meterText: signed(r.meter),
    why: r.why,
    members: r.members,
    marching: r.marching,
    audienceText: audience(r.audience),
  }));
  const stance = view.stance.map((s): StanceVM => ({ axis: s.axis, ...(AXIS_WORDS[s.axis] ?? { label: s.axis, low: "", high: "" }), value: Math.round(s.value * 100) / 100 }));
  const relations = view.relations.flatMap((r) => {
    const a = chips.get(r.a);
    const b = chips.get(r.b);
    if (!a || !b || r.state === "cordial") return [];
    const state = r.state;
    const text = `${a.name} and ${b.name}: ${r.schism ? "schism" : state === "allied" ? "allies" : "feuding"}`;
    return [{ key: `${r.a}|${r.b}`, a, b, state, value: r.value, schism: r.schism, text }];
  });
  // A schism is the news: it goes first, whatever the numbers say.
  relations.sort((x, y) => Number(y.schism) - Number(x.schism));
  const fans = rows.filter((r) => r.mood === "fan");
  const angry = rows.filter((r) => r.mood === "upset" || r.mood === "protesting");
  const marching = rows.filter((r) => r.mood === "protesting");
  const parts = [
    fans.length ? `${fans.length} ${fans.length === 1 ? "fan" : "fans"}` : "",
    angry.length ? `${angry.length} upset` : "",
    marching.length === 1 ? `${marching[0]!.name} ${view.protests ? "marching" : "furious online"}` : marching.length > 1 ? `${marching.length} ${view.protests ? "marching" : "furious online"}` : "",
  ].filter(Boolean);
  const gate = view.gate.map((g) => ({ ...g, addressable: g.id !== "" }));
  const st = view.statement;
  return {
    enabled: true,
    open,
    protests: view.protests,
    rows,
    stance,
    relations,
    log: view.log.map((l) => ({ id: l.id, day: l.day, text: l.text, tone: l.tone, colors: l.factions.map((id) => chips.get(id)?.color ?? "#888") })),
    gate,
    gateText: gate.length ? `At the gate: ${gate.map((g) => `${g.count} ${g.name}`).join(" vs ")}` : "",
    headline: parts.length ? parts.join(" · ") : "Everyone is calm. Suspiciously calm.",
    fans: fans.length,
    angry: angry.length,
    safety: {
      level: view.safety.level,
      options: view.safety.options.map((o, level) => ({
        level,
        label: o.label,
        costText: o.cost > 0 ? `${formatMoney(o.cost)}/day` : "Free",
        dragText: o.drag > 0 ? `−${Math.round(o.drag * 100)}% training` : "",
        active: level === view.safety.level,
      })),
    },
    statement: {
      ready: st.wait === 0,
      costText: formatMoney(st.cost),
      waitText: st.wait === 0 ? "Ready" : `Comms needs ${st.wait} ${st.wait === 1 ? "day" : "days"}`,
      writerText: st.staffed ? "Your Comms Rep writes it" : "The intern writes it (no Comms Rep)",
    },
  };
}

// The big moments a mod's voice has its own lines for (FLT-102): shipping a model, a level-up, a new era, a leak, the
// Senate, an escape, an ending. Read off the view-model and the snapshot, as edges: a moment is said once, when it
// starts, never again on the next redraw and never for what was already true when the HUD came up.
import type { VoiceMoment } from "../../mods/schema";
import type { HudVM } from "./types";

export interface MomentSignals {
  model: string | null;
  level: number;
  era: number | null;
  leak: string | null;
  leaked: number;
  hearing: boolean;
  escaped: number;
  ending: string | null;
}

export function signalsOf(vm: HudVM, snap: { disasters: { leaked: readonly string[] }; escape: { escaped: number } | null }): MomentSignals {
  return {
    model: vm.training.latestModel,
    level: vm.progress.level,
    era: vm.eraCard?.n ?? null,
    leak: vm.event?.kind === "leak" ? vm.event.id : null,
    leaked: snap.disasters.leaked.length,
    hearing: vm.event?.kind === "hearing",
    escaped: snap.escape?.escaped ?? 0,
    ending: vm.ending?.id ?? null,
  };
}

/** What started between two looks at the game, in the order a player would want to hear about it. */
export function momentsBetween(was: MomentSignals, now: MomentSignals): VoiceMoment[] {
  const out: VoiceMoment[] = [];
  if (now.ending !== null && now.ending !== was.ending) out.push("ending");
  if (now.escaped > was.escaped) out.push("escape");
  if ((now.leak !== null && now.leak !== was.leak) || now.leaked > was.leaked) out.push("leak");
  if (now.hearing && !was.hearing) out.push("senate");
  if (now.model !== null && now.model !== was.model) out.push("ship");
  if (now.level > was.level) out.push("level");
  if (now.era !== null && now.era !== was.era) out.push("era");
  return out;
}

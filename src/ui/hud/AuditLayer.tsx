import { sim } from "../../app/game";
import { HALF } from "../../render/coords";
import { Anchored } from "../../render/overlay";
import { useSlots } from "../../skins/context";
import type { HudActions, HudVM } from "./types";

/**
 * The auditors' sign (FLT-19). The active skin's AuditPin slot draws it; the game pins it over the group's leader every
 * frame (high enough to clear their speech bubbles), or over the gate while the countdown runs.
 */
export function AuditLayer({ audit, actions }: { audit: HudVM["audit"]; actions: HudActions }) {
  const { AuditPin } = useSlots();
  if (!audit.line) return null;
  return (
    <div className="world">
      <Anchored
        className="audit-anchor"
        pos={(out) => {
          const w = sim.world;
          const leader = w.groups?.find((g) => g.owner === "auditors")?.members[0];
          if (leader) {
            const a = sim.alpha;
            out.set(leader.px + (leader.x - leader.px) * a - HALF, 2.8, leader.pz + (leader.z - leader.pz) * a - HALF);
            return true;
          }
          if (audit.stage !== "countdown") return false;
          out.set(w.gate.x + w.gate.w / 2 - HALF, 3, w.gate.z + 0.5 - HALF);
          return true;
        }}
      >
        <AuditPin audit={audit} actions={actions} />
      </Anchored>
    </div>
  );
}

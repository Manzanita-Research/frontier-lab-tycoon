import { sim } from "../../app/game";
import { HALF } from "../../render/coords";
import { Anchored } from "../../render/overlay";
import { useSlots } from "../../skins/context";
import type { HudActions, HudVM } from "./types";

/**
 * Who is at the gate (FLT-56). The active skin's GateLegend slot draws it; the game pins it to the road just outside
 * the gate, below the crowds (the chants and bubbles have the air above them), while at least one faction marches there. Hidden in photo mode, like the rest of the HUD.
 */
export function GateLayer({ factions, actions, photo }: { factions: HudVM["factions"]; actions: HudActions; photo: boolean }) {
  const { GateLegend } = useSlots();
  if (photo || !factions.enabled || !factions.protests || !factions.gate.some((g) => g.addressable)) return null;
  return (
    <div className="world">
      <Anchored
        className="gate-anchor"
        clamp
        pos={(out) => {
          const g = sim.world.gate;
          out.set(g.x + g.w / 2 - HALF, 0, g.z + 1.6 - HALF);
          return true;
        }}
      >
        <GateLegend factions={factions} actions={actions} />
      </Anchored>
    </div>
  );
}

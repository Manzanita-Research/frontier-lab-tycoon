import { sim } from "../../app/game";
import { HALF } from "../../render/coords";
import { Anchored } from "../../render/overlay";
import { useSlots } from "../../skins/context";
import type { HudActions, HudVM } from "./types";

/**
 * Thought bubbles. The active skin's Bubble slot draws each one; the game pins it to the walker every frame (a plain
 * DOM transform, so the 60 Hz camera never touches React).
 */
export function BubbleLayer({ bubbles, actions }: { bubbles: HudVM["bubbles"]; actions: HudActions }) {
  const { Bubble } = useSlots();
  return (
    <div className="world">
      {bubbles.map((b) => (
        <Anchored
          key={`${b.night ? "n" : "t"}${b.id}`}
          pos={(out) => {
            const w = sim.world.walkers.find((o) => o.id === b.walkerId);
            if (!w || w.machine.value === "inside") return false;
            const a = sim.alpha;
            out.set(w.px + (w.x - w.px) * a - HALF, w.kind === "agent" ? 0.95 : 1.1, w.pz + (w.z - w.pz) * a - HALF);
            return true;
          }}
        >
          <Bubble bubble={b} actions={actions} />
        </Anchored>
      ))}
    </div>
  );
}

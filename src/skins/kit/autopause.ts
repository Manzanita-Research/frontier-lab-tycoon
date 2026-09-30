// A panel that covers the map (a phone's Stats sheet, an Objectives list) holds time while it is open, so the campus
// never runs on under a window the player is reading. The game keeps the ids apart: closing one cannot resume time
// beneath another.
import { useEffect } from "react";
import type { HudActions } from "../../ui/hud/types";

export function useAutoPause(actions: Pick<HudActions, "holdTime">, id: string, open: boolean) {
  const { holdTime } = actions;
  useEffect(() => {
    if (!open) return;
    holdTime(id, true);
    return () => holdTime(id, false);
  }, [holdTime, id, open]);
}

// The host: builds the view-model, gives the active skin its slots, and renders the skin's Layout plus the modals.
// This is the only place that knows both sides; a skin never sees anything but `vm` and `actions`.
import { useAtomValue } from "@effect/atom-react";
import { SkinProvider } from "../../skins/context";
import { hudActions } from "./actions";
import { BubbleLayer } from "./BubbleLayer";
import { loadedSkinAtom } from "./state";
import { Docked, Modals, PhotoLayer } from "./tree";
import { useHudEffects } from "./useHudEffects";
import { useHudVM } from "./useHudVM";

/** Everything the 2D UI shows, drawn by the active skin. */
export function HudHost() {
  const skin = useAtomValue(loadedSkinAtom);
  const vm = useHudVM();
  useHudEffects(vm);
  return (
    <SkinProvider skin={skin}>
      <BubbleLayer bubbles={vm.bubbles} actions={hudActions} />
      <div className="hud-host">
        <Docked vm={vm} actions={hudActions} />
        <Modals vm={vm} actions={hudActions} />
      </div>
      <PhotoLayer vm={vm} actions={hudActions} />
    </SkinProvider>
  );
}

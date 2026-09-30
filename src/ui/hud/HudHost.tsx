// The host: builds the view-model, gives the active skin its slots, and renders the skin's Layout plus the modals.
// This is the only place that knows both sides; a skin never sees anything but `vm` and `actions`.
import { useAtomValue } from "@effect/atom-react";
import { useRef } from "react";
import { SkinProvider } from "../../skins/context";
import { hudActions } from "./actions";
import { AuditLayer } from "./AuditLayer";
import { BubbleLayer } from "./BubbleLayer";
import { CoachLayer } from "./CoachLayer";
import { GateLayer } from "./GateLayer";
import { loadedSkinAtom } from "./state";
import { BeatLayer, Docked, Modals, PhotoLayer } from "./tree";
import { useHudEffects } from "./useHudEffects";
import { useSaves } from "./saves";
import { useAppSource, useHudVM, type AppSource } from "./useHudVM";

/** Everything the 2D UI shows, drawn by the active skin. Waits for the app actor's first state. */
export function HudHost() {
  const source = useAppSource();
  return source && <Hud source={source} />;
}

function Hud({ source }: { source: AppSource }) {
  const skin = useAtomValue(loadedSkinAtom);
  const vm = useHudVM(source);
  useHudEffects(vm, source.snap);
  useSaves();
  // `?debug=1`: count renders, to show the HUD re-renders at the snapshot rate (about 5 Hz) and not per frame.
  const renders = useRef(0);
  renders.current++;
  const dbg = typeof window === "undefined" ? undefined : (window as unknown as { __flt?: Record<string, unknown> }).__flt;
  if (dbg) dbg.hudRenders = renders.current;
  return (
    <SkinProvider skin={skin}>
      <BubbleLayer bubbles={vm.bubbles} actions={hudActions} />
      <AuditLayer audit={vm.audit} actions={hudActions} />
      <GateLayer factions={vm.factions} actions={hudActions} photo={vm.photoMode.on} />
      <div className="hud-host">
        <Docked vm={vm} actions={hudActions} />
        <BeatLayer vm={vm} actions={hudActions} />
        <Modals vm={vm} actions={hudActions} />
        <CoachLayer vm={vm} actions={hudActions} />
      </div>
      <PhotoLayer vm={vm} actions={hudActions} />
    </SkinProvider>
  );
}

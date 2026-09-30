// The host: builds the view-model, gives the active skin its slots, and renders the skin's Layout plus the modals.
// This is the only place that knows both sides; a skin never sees anything but `vm` and `actions`.
import { useAtomValue } from "@effect/atom-react";
import type { ReactNode } from "react";
import { SkinProvider, useSkin, useT } from "../../skins/context";
import type { DockedSlot } from "../../skins/types";
import { hudActions } from "./actions";
import { BubbleLayer } from "./BubbleLayer";
import { loadedSkinAtom } from "./state";
import { useHudEffects } from "./useHudEffects";
import { useHudVM } from "./useHudVM";
import type { HudVM, ToastVM } from "./types";

const actions = hudActions;

function Docked({ vm }: { vm: HudVM }) {
  const { slots } = useSkin();
  const t = useT();
  const { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, ThoughtsPanel, Ticker, Toast, Assistant, Arena, NewsControls, NewsArrival, PhotoButton } = slots;
  // Hints are toasts that stay until they come true.
  const stack: ToastVM[] = [...vm.hints.map((h, i): ToastVM => ({ id: -1 - i, text: t(`hint.${h}`), tone: "hint" })), ...vm.toasts];
  const nodes: Record<DockedSlot, ReactNode> = {
    Stats: <Stats stats={vm.stats} layout={vm.layout} actions={actions} />,
    Training: <Training training={vm.training} actions={actions} />,
    Objectives: <Objectives objectives={vm.objectives} layout={vm.layout} actions={actions} />,
    Inspector: vm.inspector ? <Inspector inspector={vm.inspector} actions={actions} /> : null,
    BuildBar: <BuildBar items={vm.buildItems} tip={vm.buildTip} layout={vm.layout} actions={actions} />,
    Speed: <Speed speed={vm.speed} stats={vm.stats} actions={actions} />,
    ThoughtsPanel: <ThoughtsPanel rows={vm.thoughtsPanel} layout={vm.layout} actions={actions} />,
    Ticker: <Ticker items={vm.ticker} actions={actions} />,
    Toasts: (
      <div className="toasts">
        {stack.map((toast) => (
          <Toast key={toast.id} toast={toast} actions={actions} />
        ))}
      </div>
    ),
    Assistant: <Assistant vm={vm} actions={actions} />,
    Arena: <Arena arena={vm.arena} actions={actions} />,
    NewsControls: <NewsControls newsroom={vm.newsroom} sound={vm.sound} skins={vm.skins} actions={actions} />,
    NewsArrival: vm.newsroom.arrival ? <NewsArrival arrival={vm.newsroom.arrival} actions={actions} /> : null,
    PhotoButton: <PhotoButton photo={vm.photoMode} actions={actions} />,
  };
  return <Layout vm={vm} actions={actions} slots={nodes} />;
}

function Modals({ vm }: { vm: HudVM }) {
  const { EventCard, EraCard, Outcome, NewsRoom, Mixer, SkinPicker } = useSkin().slots;
  return (
    <>
      {vm.event && <EventCard event={vm.event} actions={actions} />}
      {vm.eraCard && <EraCard era={vm.eraCard} actions={actions} />}
      {vm.outcome && <Outcome outcome={vm.outcome} actions={actions} />}
      {vm.newsroom.view && <NewsRoom newsroom={vm.newsroom} actions={actions} />}
      {vm.sound.open && <Mixer sound={vm.sound} actions={actions} />}
      {vm.skins.open && <SkinPicker skins={vm.skins} actions={actions} />}
    </>
  );
}

function PhotoLayer({ vm }: { vm: HudVM }) {
  const { PhotoOverlay } = useSkin().slots;
  return <PhotoOverlay photo={vm.photoMode} actions={actions} />;
}

/** Everything the 2D UI shows, drawn by the active skin. */
export function HudHost() {
  const skin = useAtomValue(loadedSkinAtom);
  const vm = useHudVM();
  useHudEffects(vm);
  return (
    <SkinProvider skin={skin}>
      <BubbleLayer bubbles={vm.bubbles} actions={actions} />
      <div className="hud-host">
        <Docked vm={vm} />
        <Modals vm={vm} />
      </div>
      <PhotoLayer vm={vm} />
    </SkinProvider>
  );
}

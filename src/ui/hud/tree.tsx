// What the host renders from a view-model and the active skin's slots. Kept free of the game (the actions come in as
// props) so the skin tests can render exactly the same tree on the server.
import type { ReactNode } from "react";
import { useSkin, useT } from "../../skins/context";
import type { DockedSlot } from "../../skins/types";
import type { HudActions, HudVM, ToastVM } from "./types";

export function Docked({ vm, actions }: { vm: HudVM; actions: HudActions }) {
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

export function Modals({ vm, actions }: { vm: HudVM; actions: HudActions }) {
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

/** Photo mode's controls and the polaroid: they live outside the HUD layer so hiding the HUD does not hide them. */
export function PhotoLayer({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { PhotoOverlay } = useSkin().slots;
  return <PhotoOverlay photo={vm.photoMode} actions={actions} />;
}

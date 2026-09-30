// What the host renders from a view-model and the active skin's slots. Kept free of the game (the actions come in as
// props) so the skin tests can render exactly the same tree on the server.
import type { ReactNode } from "react";
import { HighlightProvider, useSkin, useT } from "../../skins/context";
import type { DockedSlot } from "../../skins/types";
import type { HudActions, HudVM, ToastVM } from "./types";

/** While the first tutorial step is up, a warning about a Training Hall nobody has asked for yet is just noise. */
const openingKeepsQuiet = (vm: HudVM) => !vm.training.hasHall && vm.assistant !== null && vm.assistant.number < 2;

export function Docked({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { slots } = useSkin();
  const t = useT();
  const { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, ThoughtsPanel, Ticker, Toast, Assistant, Arena, NewsControls, NewsArrival, PhotoButton } = slots;
  // One toast at a time, the newest winning; a standing hint only shows while nobody is talking.
  const newest = vm.toasts.at(-1);
  const stack: ToastVM[] = newest ? [newest] : vm.hints.map((h, i): ToastVM => ({ id: -1 - i, text: t(`hint.${h}`), tone: "hint" }));
  const nodes: Record<DockedSlot, ReactNode> = {
    Stats: <Stats stats={vm.stats} layout={vm.layout} actions={actions} />,
    // The "no Training Hall" reminder waits until the opening asks for one: minute zero is a path and a gate, and calm.
    Training: openingKeepsQuiet(vm) ? null : <Training training={vm.training} actions={actions} />,
    Objectives: <Objectives objectives={vm.objectives} layout={vm.layout} actions={actions} />,
    Inspector: vm.inspector ? <Inspector inspector={vm.inspector} layout={vm.layout} actions={actions} /> : null,
    BuildBar: <BuildBar items={vm.buildItems} tip={vm.buildTip} layout={vm.layout} actions={actions} />,
    Speed: <Speed speed={vm.speed} stats={vm.stats} pause={vm.pause} actions={actions} />,
    Staff: vm.staff.open ? <Staff staff={vm.staff} actions={actions} /> : null,
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
  return (
    <HighlightProvider value={vm.assistant?.highlight ?? null}>
      <Layout vm={vm} actions={actions} slots={nodes} />
    </HighlightProvider>
  );
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

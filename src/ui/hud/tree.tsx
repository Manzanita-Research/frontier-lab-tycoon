// What the host renders from a view-model and the active skin's slots. Kept free of the game (the actions come in as
// props) so the skin tests can render exactly the same tree on the server.
import type { ReactNode } from "react";
import { CoachProvider, useSkin, useT } from "../../skins/context";
import type { DockedSlot } from "../../skins/types";
import type { HudActions, HudVM, ToastVM } from "./types";

export function Docked({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { slots } = useSkin();
  const t = useT();
  const { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, ThoughtsPanel, Ticker, Toast, Assistant, Arena, Benchmarks, Voice, NewsControls, NewsArrival, PhotoButton } = slots;
  // One toast at a time, the newest winning; a standing hint only shows while nobody is talking.
  const newest = vm.toasts.at(-1);
  const talking: ToastVM[] = newest ? [newest] : vm.hints.map((h, i): ToastVM => ({ id: -1 - i, text: t(`hint.${h}`), tone: "hint" }));
  // Standing warnings come first and stay until whatever causes them is fixed.
  const stack: ToastVM[] = [...vm.warnings.map((text, i): ToastVM => ({ id: -100 - i, text, tone: "warn" })), ...talking];
  const nodes: Record<DockedSlot, ReactNode> = {
    Stats: <Stats stats={vm.stats} layout={vm.layout} visible={vm.visible} actions={actions} />,
    // Hidden until there is something to show: the training bar appears once a Training Hall is up.
    Training: vm.training.hasHall ? <Training training={vm.training} actions={actions} /> : null,
    Objectives: <Objectives objectives={vm.objectives} progress={vm.progress} visible={vm.visible} layout={vm.layout} actions={actions} />,
    Inspector: vm.inspector ? <Inspector inspector={vm.inspector} layout={vm.layout} actions={actions} /> : null,
    BuildBar: <BuildBar items={vm.buildItems} tip={vm.buildTip} teasers={vm.progress.teasers} layout={vm.layout} actions={actions} />,
    Speed: <Speed speed={vm.speed} stats={vm.stats} actions={actions} />,
    Staff: vm.staff.open && vm.visible.staff ? <Staff staff={vm.staff} actions={actions} /> : null,
    ThoughtsPanel: vm.visible.thoughts ? <ThoughtsPanel rows={vm.thoughtsPanel} layout={vm.layout} actions={actions} /> : null,
    Ticker: <Ticker items={vm.ticker} actions={actions} />,
    Toasts: (
      <div className="toasts">
        {stack.map((toast) => (
          <Toast key={toast.id} toast={toast} actions={actions} />
        ))}
      </div>
    ),
    Assistant: <Assistant vm={vm} actions={actions} />,
    Arena: vm.visible.arena || vm.visible.rnd ? <Arena arena={vm.arena} leapfrog={vm.leapfrog} layout={vm.layout} actions={actions} /> : null,
    Benchmarks: vm.leapfrog.enabled ? <Benchmarks leapfrog={vm.leapfrog} layout={vm.layout} actions={actions} /> : null,
    Voice: vm.leapfrog.enabled ? <Voice leapfrog={vm.leapfrog} layout={vm.layout} actions={actions} /> : null,
    NewsControls: <NewsControls newsroom={vm.newsroom} sound={vm.sound} skins={vm.skins} visible={vm.visible} actions={actions} />,
    NewsArrival: vm.newsroom.arrival && vm.visible.news ? <NewsArrival arrival={vm.newsroom.arrival} actions={actions} /> : null,
    PhotoButton: <PhotoButton photo={vm.photoMode} actions={actions} />,
  };
  return (
    <CoachProvider value={vm.coach?.target ?? null}>
      <Layout vm={vm} actions={actions} slots={nodes} />
    </CoachProvider>
  );
}

export function Modals({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { EventCard, Livestream, Confirm, UnlockCard, HowToPlay, EraCard, Outcome, Ending, Takeover, NewsRoom, Mixer, SkinPicker } = useSkin().slots;
  return (
    <>
      {vm.event && (vm.event.stream ? <Livestream event={vm.event} stream={vm.event.stream} actions={actions} /> : <EventCard event={vm.event} actions={actions} />)}
      {vm.confirm && <Confirm confirm={vm.confirm} actions={actions} />}
      {vm.unlock && <UnlockCard unlock={vm.unlock} actions={actions} />}
      {vm.help && <HowToPlay help={vm.help} actions={actions} />}
      {vm.eraCard && <EraCard era={vm.eraCard} actions={actions} />}
      {vm.outcome && <Outcome outcome={vm.outcome} actions={actions} />}
      {vm.takeover && !vm.ending && <Takeover takeover={vm.takeover} layout={vm.layout} actions={actions} />}
      {vm.ending && <Ending ending={vm.ending} layout={vm.layout} actions={actions} />}
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

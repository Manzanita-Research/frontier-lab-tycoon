// What the host renders from a view-model and the active skin's slots. Kept free of the game (the actions come in as
// props) so the skin tests can render exactly the same tree on the server.
import type { ReactNode } from "react";
import { CoachProvider, useSkin, useT } from "../../skins/context";
import type { DockedSlot, SlotComponents } from "../../skins/types";
import type { EventVM, HudActions, HudVM, ToastVM } from "./types";

export function Docked({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { slots } = useSkin();
  const t = useT();
  const { Layout, Stats, Training, Objectives, Inspector, BuildBar, Speed, Staff, ThoughtsPanel, Ticker, Toast, Assistant, Arena, Benchmarks, Voice, Factions, NewsControls, NewsArrival, PhotoButton, Papers, DisasterAlert, DramaButton } = slots;
  // One toast at a time, the newest winning; a standing hint only shows while nobody is talking.
  const newest = vm.toasts.at(-1);
  const talking: ToastVM[] = newest ? [newest] : vm.hints.map((h, i): ToastVM => ({ id: -1 - i, text: t(`hint.${h}`), tone: "hint" }));
  // Standing warnings come first and stay until whatever causes them is fixed.
  const stack: ToastVM[] = [...vm.warnings.map((text, i): ToastVM => ({ id: -100 - i, text, tone: "warn" })), ...talking];
  const nodes: Record<DockedSlot, ReactNode> = {
    Stats: <Stats stats={vm.stats} layout={vm.layout} visible={vm.visible} actions={actions} disasters={vm.disasters} />,
    // Hidden until there is something to show: the training bar appears once a Training Hall is up.
    Training: vm.training.hasHall ? <Training training={vm.training} actions={actions} /> : null,
    Objectives: <Objectives objectives={vm.objectives} progress={vm.progress} visible={vm.visible} layout={vm.layout} actions={actions} />,
    Inspector: vm.inspector ? <Inspector inspector={vm.inspector} layout={vm.layout} actions={actions} /> : null,
    BuildBar: <BuildBar items={vm.buildItems} tip={vm.buildTip} teasers={vm.progress.teasers} layout={vm.layout} actions={actions} disasters={vm.disasters} />,
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
    Factions: vm.factions.enabled && vm.visible.factions ? <Factions factions={vm.factions} layout={vm.layout} actions={actions} /> : null,
    NewsControls: <NewsControls newsroom={vm.newsroom} sound={vm.sound} skins={vm.skins} visible={vm.visible} actions={actions} />,
    NewsArrival: vm.newsroom.arrival && vm.visible.news ? <NewsArrival arrival={vm.newsroom.arrival} actions={actions} /> : null,
    PhotoButton: <PhotoButton photo={vm.photoMode} actions={actions} />,
    Papers: vm.papers.enabled && vm.visible.papers ? <Papers papers={vm.papers} layout={vm.layout} actions={actions} /> : null,
    DisasterAlert: vm.disasters.enabled ? <DisasterAlert disasters={vm.disasters} layout={vm.layout} actions={actions} /> : null,
    // Like any mod, not earned on the ladder: there from the start.
    DramaButton: <DramaButton drama={vm.drama} actions={actions} />,
  };
  return (
    <CoachProvider value={vm.coach?.target ?? null}>
      <Layout vm={vm} actions={actions} slots={nodes} />
    </CoachProvider>
  );
}

type ModalSlots = Pick<SlotComponents, "EventCard" | "Livestream" | "Hearing" | "LeakedChat" | "DramaCard" | "ReportCard" | "Bill" | "PromiseTracker">;

/** A card opens in the slot its kind asks for: the livestream, the witness table, the leaked chat, a drama document, the auditors' report, the bill, the Promise Tracker, or the plain card. */
function EventModal({ vm, event, actions, slots: { EventCard, Livestream, Hearing, LeakedChat, DramaCard, ReportCard, Bill, PromiseTracker } }: { vm: HudVM; event: EventVM; actions: HudActions; slots: ModalSlots }) {
  if (event.stream) return <Livestream event={event} stream={event.stream} actions={actions} />;
  if (event.hearing) return <Hearing event={event} hearing={event.hearing} actions={actions} />;
  if (event.leak) return <LeakedChat event={event} leak={event.leak} actions={actions} />;
  if (event.drama) return <DramaCard event={event} drama={event.drama} actions={actions} />;
  if (event.report) return <ReportCard event={event} report={event.report} actions={actions} />;
  if (event.bill) return <Bill event={event} bill={event.bill} actions={actions} />;
  if (event.tracker) return <PromiseTracker event={event} tracker={event.tracker} bill={vm.senate.bill} layout={vm.layout} actions={actions} />;
  return <EventCard event={event} actions={actions} />;
}

export function Modals({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { EventCard, Livestream, Hearing, LeakedChat, DramaCard, ReportCard, Bill, PromiseTracker, Confirm, UnlockCard, HowToPlay, EraCard, Outcome, NewsRoom, Mixer, ModManager, SkinPicker, PaperMoment, CrumbWiki, DisasterMenu, Drama } = useSkin().slots;
  return (
    <>
      {vm.senate.open && vm.senate.tracker && !vm.event?.tracker && (
        <PromiseTracker event={null} tracker={vm.senate.tracker} bill={vm.senate.bill} layout={vm.layout} actions={actions} />
      )}
      {vm.event && <EventModal vm={vm} event={vm.event} actions={actions} slots={{ EventCard, Livestream, Hearing, LeakedChat, DramaCard, ReportCard, Bill, PromiseTracker }} />}
      {vm.confirm && <Confirm confirm={vm.confirm} actions={actions} />}
      {vm.crumbWiki && <CrumbWiki key={vm.crumbWiki.key} wiki={vm.crumbWiki} actions={actions} />}
      {!vm.crumbWiki && vm.paperMoment && <PaperMoment key={vm.paperMoment.key} moment={vm.paperMoment} actions={actions} />}
      {vm.unlock && <UnlockCard unlock={vm.unlock} actions={actions} />}
      {vm.help && <HowToPlay help={vm.help} actions={actions} />}
      {vm.disasters.open && <DisasterMenu disasters={vm.disasters} actions={actions} />}
      {vm.eraCard && <EraCard era={vm.eraCard} actions={actions} />}
      {vm.outcome && <Outcome outcome={vm.outcome} actions={actions} />}
      {vm.newsroom.view && <NewsRoom newsroom={vm.newsroom} actions={actions} />}
      {vm.sound.open && <Mixer sound={vm.sound} actions={actions} />}
      {vm.drama.open && <Drama drama={vm.drama} actions={actions} />}
      {vm.mods.open && <ModManager mods={vm.mods} actions={actions} />}
      {vm.skins.open && <SkinPicker skins={vm.skins} actions={actions} />}
    </>
  );
}

/** Photo mode's controls and the polaroid: they live outside the HUD layer so hiding the HUD does not hide them. */
export function PhotoLayer({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { PhotoOverlay } = useSkin().slots;
  return <PhotoOverlay photo={vm.photoMode} actions={actions} />;
}

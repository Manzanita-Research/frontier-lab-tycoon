// A mod's voice on the HUD (FLT-102). The view-model's flavour text (thoughts, toasts, the ticker, cards, the Bird App,
// the papers, the Mom group chat, the ending's front page) is rewritten in the voice; controls, numbers, prices, menus
// and instructions are not, so the game stays playable. Pure: the same view-model and voice give the same text.
import type { Say } from "../../mods/voice";
import type { BirdPostVM, HudVM, ToastVM } from "./types";

export interface VoiceOptions {
  readonly say: Say;
  /** The avatar every poster and chat friend wears (🦆), or null to keep theirs. */
  readonly glyph: string | null;
}

/** The toasts that are instructions (a standing hint, a warning, a bug report) stay readable. */
const plain = (t: ToastVM) => t.tone === "hint" || t.tone === "warn" || t.snag === true;

export function voiceVM(vm: HudVM, { say, glyph }: VoiceOptions): HudVM {
  const face = (g: string) => glyph ?? g;
  const post = (p: BirdPostVM): BirdPostVM => ({
    ...p,
    glyph: face(p.glyph),
    text: say(p.text),
    reply: say(p.reply),
    ...(p.quote ? { quote: { ...p.quote, text: say(p.quote.text) } } : {}),
  });
  const { newsroom, event, ending, birdapp } = vm;
  return {
    ...vm,
    toasts: vm.toasts.map((t) => (plain(t) ? t : { ...t, text: say(t.text), ...(t.batch ? { batch: t.batch.map((b) => ({ ...b, text: say(b.text) })) } : {}) })),
    ticker: vm.ticker.map((t) => ({ ...t, text: say(t.text) })),
    bubbles: vm.bubbles.map((b) => ({ ...b, text: say(b.text) })),
    thoughtsPanel: vm.thoughtsPanel.map((t) => ({ ...t, text: say(t.text) })),
    inspector: vm.inspector ? { ...vm.inspector, thought: say(vm.inspector.thought) } : null,
    // A card's title and story are flavour; its choices are the controls.
    event: event
      ? {
          ...event,
          title: say(event.title),
          body: say(event.body),
          ...(event.leak ? { leak: { ...event.leak, messages: event.leak.messages.map((m) => (m.system ? m : { ...m, text: say(m.text) })) } } : {}),
        }
      : null,
    unlock: vm.unlock?.quip ? { ...vm.unlock, quip: say(vm.unlock.quip) } : vm.unlock,
    eraCard: vm.eraCard ? { ...vm.eraCard, line: say(vm.eraCard.line) } : null,
    beat: vm.beat ? { ...vm.beat, caption: say(vm.beat.caption), sub: say(vm.beat.sub) } : null,
    birdapp: {
      ...birdapp,
      live: birdapp.live.map(post),
      log: birdapp.log.map(post),
      posters: birdapp.posters.map((p) => ({ ...p, glyph: face(p.glyph) })),
    },
    newsroom: {
      ...newsroom,
      paper: newsroom.paper
        ? {
            ...newsroom.paper,
            lead: say(newsroom.paper.lead),
            caption: say(newsroom.paper.caption),
            substories: newsroom.paper.substories.map((s) => ({ ...s, text: say(s.text) })),
            classified: say(newsroom.paper.classified),
          }
        : null,
      chat: newsroom.chat
        ? {
            ...newsroom.chat,
            messages: newsroom.chat.messages.map((m) => ({ ...m, avatar: face(m.avatar), text: say(m.text) })),
            typing: newsroom.chat.typing ? { ...newsroom.chat.typing, avatar: face(newsroom.chat.typing.avatar) } : null,
          }
        : null,
    },
    ending: ending
      ? {
          ...ending,
          paper: {
            ...ending.paper,
            headline: say(ending.paper.headline),
            deck: say(ending.paper.deck),
            caption: say(ending.paper.caption),
            subs: ending.paper.subs.map(say),
            classified: say(ending.paper.classified),
            signoff: say(ending.paper.signoff),
          },
        }
      : ending,
  };
}

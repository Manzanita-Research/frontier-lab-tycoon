// The news cycle: everyone has a pile of attention that decays every day and gets pushed up by launches, stunts and
// scandals. Your share of the total is the share-of-voice meter. Whoever has a big enough share owns the cycle (and the
// Frontier Times front page).
//
//   contested --DAY (a lab has the share and a clear lead)--> owned, emits OWNED
//   owned --DAY (the owner's share fell)--> contested, emits LOST
//
// Pure: no rng, no World. The driver sends PUSH when something happens and DAY with each lab's baseline at midnight.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../../machines/run";

export const VoiceContext = Schema.Struct({
  /** Attention by lab id (yours is "you"). Never negative. */
  attention: Schema.Record(Schema.String, Schema.Number),
  /** Who owns the cycle, or "" if nobody does. */
  owner: Schema.String,
  /** Days the current owner has held it. */
  streak: Schema.Number,
});
export type VoiceContext = typeof VoiceContext.Type;

const Day = Schema.Struct({
  /** Yesterday's attention is worth this much today. */
  decay: Schema.Number,
  /** What each lab gets every day regardless. */
  baselines: Schema.Record(Schema.String, Schema.Number),
  ownShare: Schema.Number,
  ownLead: Schema.Number,
  keepShare: Schema.Number,
});

export const voiceMachine = setupEffect({
  schemas: {
    context: VoiceContext,
    input: VoiceContext,
    events: {
      /** Something got the world talking: a launch, a stunt, a scandal. Negative amounts take attention away. */
      PUSH: Schema.Struct({ lab: Schema.String, amount: Schema.Number }),
      DAY: Day,
    },
    emitted: {
      OWNED: Schema.Struct({ lab: Schema.String, share: Schema.Number, from: Schema.String }),
      LOST: Schema.Struct({ lab: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "contested",
  on: {
    PUSH: ({ context, event }) => ({ context: { ...context, attention: pushed(context.attention, event.lab, event.amount) } }),
  },
  states: {
    /** Nobody has the room. */
    contested: {
      on: {
        DAY: ({ context, event }, enq) => {
          const attention = decayed(context.attention, event.decay, event.baselines);
          const top = leaderOf(attention);
          if (top && top.share >= event.ownShare && top.share >= top.second * event.ownLead) {
            enq.emit({ type: "OWNED", lab: top.id, share: top.share, from: "" });
            return { target: "owned", context: { attention, owner: top.id, streak: 1 } };
          }
          return { target: "contested", context: { ...context, attention } };
        },
      },
    },
    /** One lab is the story. */
    owned: {
      on: {
        DAY: ({ context, event }, enq) => {
          const attention = decayed(context.attention, event.decay, event.baselines);
          const total = totalOf(attention);
          const held = total > 0 ? (attention[context.owner] ?? 0) / total : 0;
          const top = leaderOf(attention);
          // A rival with a clear lead takes it over on the day; otherwise the owner keeps it while the share holds.
          if (top && top.id !== context.owner && top.share >= event.ownShare && top.share >= top.second * event.ownLead) {
            enq.emit({ type: "LOST", lab: context.owner });
            enq.emit({ type: "OWNED", lab: top.id, share: top.share, from: context.owner });
            return { target: "owned", context: { attention, owner: top.id, streak: 1 }, reenter: true };
          }
          if (held >= event.keepShare) return { target: "owned", context: { ...context, attention, streak: context.streak + 1 } };
          enq.emit({ type: "LOST", lab: context.owner });
          return { target: "contested", context: { attention, owner: "", streak: 0 } };
        },
      },
    },
  },
});

export type VoiceStored = Stored<typeof voiceMachine>;

function pushed(attention: Record<string, number>, lab: string, amount: number): Record<string, number> {
  return { ...attention, [lab]: Math.max(0, (attention[lab] ?? 0) + amount) };
}

function decayed(attention: Record<string, number>, decay: number, baselines: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const id of Object.keys(baselines)) next[id] = (attention[id] ?? 0) * decay + baselines[id]!;
  return next;
}

const totalOf = (attention: Record<string, number>): number => {
  let t = 0;
  for (const id in attention) t += attention[id]!;
  return t;
};

/** The lab with the most attention, its share of the total, and the runner-up's share. */
function leaderOf(attention: Record<string, number>): { id: string; share: number; second: number } | null {
  const total = totalOf(attention);
  if (total <= 0) return null;
  let id = "";
  let best = -1;
  let second = -1;
  for (const k in attention) {
    const v = attention[k]!;
    if (v > best) {
      second = best;
      best = v;
      id = k;
    } else if (v > second) second = v;
  }
  return { id, share: best / total, second: Math.max(0, second) / total };
}

/** Everyone's share of the news cycle (they add up to 1), biggest first. */
export function sharesOf(context: VoiceContext): { id: string; share: number }[] {
  const total = totalOf(context.attention);
  return Object.entries(context.attention)
    .map(([id, v]) => ({ id, share: total > 0 ? v / total : 0 }))
    .sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1));
}

export const shareOf = (context: VoiceContext, id: string): number => {
  const total = totalOf(context.attention);
  return total > 0 ? (context.attention[id] ?? 0) / total : 0;
};

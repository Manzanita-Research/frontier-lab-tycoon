// The window budget (FLT-54): what the game opens by itself, as opposed to what the player opens. At most MAX_AUTO of
// those are up at once; the rest wait on the taskbar as a flashing button, and one that is not holding time goes away
// by itself when its moment has had AUTO_CLOSE_MS of the player's attention. Pure, so it is tested without a DOM; the
// host (`useWindowBudget` in useHudVM.ts) feeds it what wants to be up, and the real clock.

/** The windows the game opens by itself: the Arena on a rank drop, the paper boy, a New! card, a paper moment, the wiki. */
export type AutoWindowId = "arena" | "news" | "unlock" | "paper" | "wiki";
/** A window that wants to be up, and the moment it is for (a new moment is a new window). */
export interface Want {
  id: AutoWindowId;
  key: string;
}
/**
 * `shown`: up, and counted against the budget. `docked`: waiting on the taskbar, flashing. `owned`: the player opened it
 * from the taskbar, so it is theirs and no longer counts. `closed`: its moment passed (or the player shut it) while it
 * still wants to be up; it stays closed until a new moment comes.
 */
export type WindowState = "shown" | "docked" | "owned" | "closed";
export interface AutoWindow extends Want {
  state: WindowState;
  /** When it went up (or was docked), in ms. */
  since: number;
}
export type Budget = readonly AutoWindow[];

export const MAX_AUTO = 2;
/** About three game days at 1×: long enough to read a card, short enough that the desk clears itself. */
export const AUTO_CLOSE_MS = 20_000;
/** These hold time while up and are the joke themselves: they wait for the player's click instead of closing. */
const HOLDS_TIME: ReadonlySet<AutoWindowId> = new Set(["paper", "wiki"]);

const same = (a: Want, b: Want) => a.id === b.id && a.key === b.key;
const shownCount = (b: Budget) => b.filter((w) => w.state === "shown").length;

/**
 * One step: windows whose moment is over leave, a new moment is shown if the budget has room and docked if not, and a
 * shown window that does not hold time closes AUTO_CLOSE_MS after it went up. Docked windows never pop up by themselves:
 * the flashing button is the whole point. Returns the same array when nothing changed.
 */
export function stepBudget(budget: Budget, wants: readonly Want[], now: number): Budget {
  let changed = false;
  const next: AutoWindow[] = [];
  for (const w of budget) {
    if (!wants.some((x) => same(x, w))) {
      changed = true;
      continue;
    }
    if (w.state === "shown" && !HOLDS_TIME.has(w.id) && now - w.since >= AUTO_CLOSE_MS) {
      next.push({ ...w, state: "closed" });
      changed = true;
    } else next.push(w);
  }
  for (const want of wants) {
    if (next.some((w) => same(w, want))) continue;
    // One window per id: a new moment takes the old one's place (up stays up, docked stays docked).
    const at = next.findIndex((w) => w.id === want.id);
    const was = at >= 0 ? next.splice(at, 1)[0]!.state : "closed";
    const state: WindowState = was === "docked" ? "docked" : was !== "closed" || shownCount(next) < MAX_AUTO ? "shown" : "docked";
    next.push({ ...want, state, since: now });
    changed = true;
  }
  return changed ? next : budget;
}

/** The player clicked its taskbar button: up, and theirs. */
export const restoreWindow = (budget: Budget, id: AutoWindowId): Budget => budget.map((w) => (w.id === id && (w.state === "docked" || w.state === "closed") ? { ...w, state: "owned" } : w));
/** The player shut it (or took it over): it stops counting, and stays shut until its next moment. */
export const closeWindow = (budget: Budget, id: AutoWindowId): Budget => budget.map((w) => (w.id === id && w.state !== "closed" ? { ...w, state: "closed" } : w));

/** Is it up (shown by the budget, or the player's)? */
export const isUp = (budget: Budget, id: AutoWindowId): boolean => budget.some((w) => w.id === id && (w.state === "shown" || w.state === "owned"));
/** Waiting on the taskbar? */
export const isDocked = (budget: Budget, id: AutoWindowId): boolean => budget.some((w) => w.id === id && w.state === "docked");
/** What the budget holds up right now: never more than MAX_AUTO. */
export const autoUp = (budget: Budget): AutoWindowId[] => budget.filter((w) => w.state === "shown").map((w) => w.id);
/** The next time a shown window closes itself, or null (so the host can wake up for it). */
export function nextClose(budget: Budget): number | null {
  const due = budget.filter((w) => w.state === "shown" && !HOLDS_TIME.has(w.id)).map((w) => w.since + AUTO_CLOSE_MS);
  return due.length > 0 ? Math.min(...due) : null;
}

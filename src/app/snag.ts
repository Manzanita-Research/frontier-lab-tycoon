// FLT-84: the recovery toast. When the FLT-81 guard (an action that failed) or the watchdog (an actor that died and was
// rebuilt) catches an error, the game says so once, in the skin's own voice, with a "Copy details" button: the error,
// its stack, and where the lab was (seed, tick, build, skin), ready to paste into a bug report.

/** At most one snag toast a minute; the console keeps the rest. */
export const SNAG_EVERY_MS = 60_000;
/** It stays up long enough to reach for the button. */
export const SNAG_TOAST_MS = 15_000;
/** What the toast says where a skin has no words of its own (the base's `snag.text`). */
export const SNAG_TEXT = "Frontier Lab Tycoon hit a snag and kept going.";

/** What went wrong, and where the lab was when it did. */
export interface Snag {
  /** Which guard caught it: an app action ("advance", "save", ...) or "watchdog". */
  where: string;
  message: string;
  stack: string;
  seed: number;
  tick: number;
  day: number;
}

/** The build's commit (vite's define), or "dev" in a test or a local build without git. */
export const BUILD_SHA: string = import.meta.env.VITE_FLT_SHA ?? "dev";

/** The skin on the page (`data-skin`), or null headless. */
export const pageSkin = (): string | null => (typeof document === "undefined" ? null : (document.documentElement.dataset.skin ?? null));

/** Message and stack from whatever was thrown (an Error, a string, a squashed Cause's pretty print). */
export function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack ?? `${error.name}: ${error.message}` };
  const text = typeof error === "string" ? error : safeJson(error);
  return { message: text.split("\n")[0] ?? text, stack: text };
}

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/** The text "Copy details" puts on the clipboard: plain, short lines first, the stack last. */
export function snagDetails(snag: Snag, env: { version?: string; skin?: string | null; url?: string; agent?: string } = {}): string {
  return [
    "Frontier Lab Tycoon: snag report",
    `error: ${snag.message}`,
    `caught by: ${snag.where}`,
    `seed: ${snag.seed}`,
    `tick: ${snag.tick} (day ${snag.day})`,
    `version: ${env.version ?? BUILD_SHA}`,
    `skin: ${env.skin === undefined ? (pageSkin() ?? "unknown") : (env.skin ?? "unknown")}`,
    ...(env.url ? [`url: ${env.url}`] : []),
    ...(env.agent ? [`browser: ${env.agent}`] : []),
    "",
    snag.stack,
  ].join("\n");
}

/** The details with the page's own address and browser filled in. */
export const snagReport = (snag: Snag): string =>
  snagDetails(snag, typeof window === "undefined" ? {} : { url: window.location.href, agent: navigator.userAgent });

/** Whether a snag at `now` may raise a toast, given when the last one did. */
export const maySnag = (last: number | null, now: number): boolean => last === null || now - last >= SNAG_EVERY_MS;

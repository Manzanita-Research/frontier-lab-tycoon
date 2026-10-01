// FLT-95: a first visit to the bare root opens on the software shelf (SoftWarehouse '97), not the game. The e2e players
// are strangers, so they go through it as one would: take the box off the shelf, open it, pick up the disc, insert it.
// `skip` presses "Skip intro" instead. A visit that went straight to the game (a param, a save) passes through untouched.
// SwiftShader draws a few frames a second and the box's beats run on its clock, so the waits are long.

const STEP_MS = 120_000;
/** The game is on screen: its probe is up (the box prefetches the game, so the probe alone says nothing) and the box is gone. */
const inGame = () => typeof window.__fltProbe === "function" && !document.querySelector(".intro, .intro-curtain:not(.intro-curtain--gone), .still");

/**
 * Wait for whichever door this visit came in by, play the box if it is the box, and resolve once the game's probe is up.
 * `tap` taps instead of clicking (a phone context, `hasTouch`). Returns what happened, for the run's report.
 */
export async function throughTheBox(page, { skip = false, tap = false, log = console.log } = {}) {
  const door = await Promise.race([
    page.locator(".intro").first().waitFor({ timeout: STEP_MS }).then(() => "box"),
    page.waitForFunction(inGame, null, { timeout: STEP_MS }).then(() => "game"),
  ]);
  if (door === "game") return { door, ms: 0 };
  const t0 = Date.now();
  const press = async (selector, what) => {
    const target = page.locator(selector).first();
    await target.waitFor({ state: "visible", timeout: STEP_MS });
    await (tap ? target.tap({ timeout: STEP_MS }) : target.click({ timeout: STEP_MS }));
    log(`Box: ${what} at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  };
  if (skip) await press(".intro-skip", "Skip intro");
  else {
    await press(".intro-cta", "took the box off the shelf");
    await press(".intro-hold .intro-open", "opened it");
    await press(".intro-contents button:has-text('Pick up the disc')", "picked up the disc");
    await press(".intro-disc button:has-text('Insert and play')", "inserted it");
  }
  await page.waitForFunction(inGame, null, { timeout: STEP_MS });
  const ms = Date.now() - t0;
  log(`Box: in the game after ${(ms / 1000).toFixed(1)} s`);
  return { door, skipped: skip, ms };
}

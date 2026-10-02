/**
 * Resolves when the game's HUD is on the page. The /box intro (FLT-70) hands over to the game in its own React root,
 * so the account (FLT-67) waits for that before it boots. Imports nothing of the game: the game's modules must not load
 * before main.tsx has resolved the mods.
 */
export function whenGame(): Promise<void> {
  const up = () => document.querySelector(".hud-host:not(.flt-account)") !== null;
  return new Promise((done) => {
    if (up()) return done();
    const watch = new MutationObserver(() => {
      if (!up()) return;
      watch.disconnect();
      done();
    });
    watch.observe(document.body, { childList: true, subtree: true });
  });
}

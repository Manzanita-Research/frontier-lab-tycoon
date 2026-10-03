import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-900.css";
import { loadModSession, momentSearch, setModSession } from "./app/mods";
import { setSessionDefinition } from "./sim/defs";
import { door } from "./introRoute";
import "./index.css";

// Standalone demo pages: any file named `*.page.tsx` with a default export is
// reachable at `?page=<name>` (for example src/render/gallery.page.tsx is
// `?page=gallery`). Tasks use these to show their work in isolation without
// touching shared files.
const pages = import.meta.glob<{ default: ComponentType }>("./**/*.page.tsx");

function resolvePage() {
  const name = new URLSearchParams(window.location.search).get("page");
  if (!name) return null;
  const entry = Object.entries(pages).find(([path]) => path.endsWith(`/${name}.page.tsx`));
  return entry ? lazy(entry[1]) : null;
}

const Page = resolvePage();

// Canvas text (the gate sign, the placards) is drawn once, so wait for Nunito, but never for long.
const fonts = Promise.race([
  Promise.all([600, 700, 800, 900].map((w) => document.fonts.load(`${w} 16px Nunito`))),
  new Promise((done) => setTimeout(done, 1500)),
]).catch(() => undefined);

// Mods (`?mod=`, FLT-37) resolve before the game module loads: the World is created from the resolved definition, so
// the game (and the skin control, which shares its registry) is imported only once they are in. Without `?mod=` this
// settles at once and nothing waits on the network. It runs once: the intro (FLT-70) calls it to prefetch the game.
let game: { skin: Promise<typeof import("./ui/hud/skinControl")>; App: Promise<ComponentType> } | undefined;
const loadGame = () => {
  if (game) return game;
  const mods = loadModSession(momentSearch(window.location.search), { baseUrl: window.location.href }).then((session) => {
    setModSession(session);
    setSessionDefinition(session.def);
  });
  return (game = { skin: mods.then(() => import("./ui/hud/skinControl")), App: mods.then(() => import("./App")).then((m) => m.App) });
};

// The software-shelf intro (FLT-70) is its own chunk: at `/box`, `?intro=1`, and (FLT-95) a first visit to the bare root.
// It boots the game itself.
const localStore = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const intro = !Page && door(window.location, localStore) === "box";
const root = createRoot(document.getElementById("root")!);
if (intro) void Promise.all([fonts, import("./intro/boot")]).then(([, m]) => m.mountIntro(root, loadGame));
else {
  // The HUD's skin (its tokens, fonts and CSS) is ready before the first paint, so there is no flash of the wrong look.
  const skin = Page ? Promise.resolve() : loadGame().skin.then((m) => m.bootSkin());
  const app = Page ? Promise.resolve(null) : loadGame().App;
  void Promise.all([fonts, skin, app]).then(([, , App]) =>
    root.render(
      <StrictMode>
        {Page ? (
          <Suspense fallback={null}>
            <Page />
          </Suspense>
        ) : (
          App && <App />
        )}
      </StrictMode>,
    ),
  );

  // Accounts (FLT-67): compiled in only when the prod deploy builds with VITE_FLT_AUTH=on (docs/ACCOUNTS.md). Otherwise
  // this statement, the one below and everything under src/account/ are dropped from the bundle, which stays
  // byte-identical.
  if (import.meta.env.VITE_FLT_AUTH === "on" && !Page) {
    void Promise.all([skin, app]).then(() => import("./account/boot")).then((m) => m.bootAccount());
  }
}

// Accounts (FLT-67) when the /box intro is the door: it hands over to the game in the same root, and the account boots
// once the game's HUD is up. Flag off, this is dropped too.
if (import.meta.env.VITE_FLT_AUTH === "on" && intro) {
  void import("./account/handover")
    .then((h) => h.whenGame())
    .then(() => import("./account/boot"))
    .then((m) => m.bootAccount());
}

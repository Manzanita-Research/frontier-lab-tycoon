// The intro's entry (FLT-70): only `/box` and `?intro=1` import this chunk. It mounts the shelf, prefetches the game,
// and when the intro's machine reaches `game` it swaps the shelf for the game in the same React root.
import { StrictMode, type ComponentType } from "react";
import type { Root } from "react-dom/client";
import w95fa from "../skins/frontier-95/assets/fonts/w95fa.woff2?url";
import { createIntro, readParams } from "./actor";
import { IntroRoot } from "./Intro";

// The skin registry's MOTION_KEY, not imported: the registry would pull every skin into this chunk.
const MOTION_KEY = "flt.motion";

export type LoadGame = () => { skin: Promise<{ bootSkin: () => Promise<void> }>; App: Promise<ComponentType> };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function mountIntro(root: Root, loadGame: LoadGame) {
  // The BIOS, the key and the manual's code are drawn on canvases in the Frontier 95 font; load it before painting.
  try {
    const face = new FontFace("W95FA", `url(${w95fa})`);
    document.fonts.add(await Promise.race([face.load(), new Promise<FontFace>((_, no) => setTimeout(no, 1500))]));
  } catch {
    // A fallback monospace is fine.
  }
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || storage()?.getItem(MOTION_KEY) === "reduced";
  const intro = createIntro(readParams(window.location, storage(), reduced));
  root.render(
    <StrictMode>
      <IntroRoot intro={intro} loadGame={loadGame} />
    </StrictMode>,
  );
}

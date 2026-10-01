// FLT-70: the big box intro is hidden until the domain switch. It is reachable only at `/box` (and `?intro=1`);
// every other URL boots straight into the game. This file is all the intro costs the game's entry chunk.

/** True when this URL asks for the software-shelf intro. */
export const isIntroRoute = (loc: { pathname: string; search: string }) =>
  loc.pathname.replace(/\/+$/, "") === "/box" || new URLSearchParams(loc.search).get("intro") === "1";

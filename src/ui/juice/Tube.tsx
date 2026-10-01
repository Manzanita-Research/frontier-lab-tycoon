import { useAtomValue } from "@effect/atom-react";
import { useEffect, type CSSProperties } from "react";
import { CRT_LOOKS } from "../../render/crt/looks";
import { crtAtom } from "../../render/crt/state";
import "./crt";
import "./crt.css";

/**
 * The glass in front of everything (FLT-73): faint scanlines at the shader's pitch, a faint vignette, the black bezel's
 * rounded corners, and (full, and never with reduced motion) a slow rolling band and a flicker. It never takes a click
 * and never bends or blurs the DOM: text stays where the layout put it. The phosphor glow on text is `html[data-crt]`
 * in crt.css. The canvas gets the real thing from CrtFX; this layer is all a flat-tier machine shows.
 */
export function Tube() {
  const { mode } = useAtomValue(crtAtom);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "off") delete root.dataset.crt;
    else {
      // The glow rides on the body (text-shadow inherits), so its numbers live on the root.
      const { glowRadius, glowAlpha } = CRT_LOOKS[mode].css;
      root.dataset.crt = mode;
      root.style.setProperty("--crt-glow", `${glowRadius}px`);
      root.style.setProperty("--crt-glow-alpha", `${glowAlpha * 100}%`);
    }
    return () => void delete root.dataset.crt;
  }, [mode]);
  if (mode === "off") return null;
  const { pitch, css } = CRT_LOOKS[mode];
  const style = {
    "--crt-pitch": `${pitch}px`,
    "--crt-scan": css.scan,
    "--crt-vig": css.vignette,
    "--crt-vig-inner": `${css.vignetteInner * 100}%`,
    "--crt-corner": `${css.corner}px`,
    "--crt-roll": css.roll,
    "--crt-flicker": 1 - css.flicker,
  } as CSSProperties;
  return (
    <div className={`crt-tube crt-${mode}`} style={style} aria-hidden="true">
      <i className="crt-scan" />
      <i className="crt-vig" />
      {css.roll > 0 && <i className="crt-roll" />}
      <i className="crt-bezel" />
    </div>
  );
}

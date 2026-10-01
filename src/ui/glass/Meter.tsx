// `?glassmeter` (FLT-88): frame rate and frame time, with the glass on or off, so the cost can be read on a real GPU.
import { useEffect, useRef } from "react";
import { glassStats } from "./Glass";

export function GlassMeter({ on }: { on: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let shown = last;
    const d: number[] = [];
    let snaps = glassStats.hudUploads;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      d.push(t - last);
      last = t;
      if (t - shown < 1000 || !ref.current) return;
      const s = [...d].sort((a, b) => a - b);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      const p95 = s[Math.floor(s.length * 0.95)] ?? mean;
      const ua = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? "?";
      const head = on
        ? `glass ON  (Chrome ${ua})`
        : `glass off (Chrome ${ua}${glassStats.api ? "" : ", no HTML-in-canvas"})`;
      const glass = on
        ? `\nglass JS ${glassStats.total.ms.toFixed(2)} ms/frame · HUD snapshots ${glassStats.hudUploads - snaps}/s`
        : "";
      ref.current.textContent = `${head}\n${(1000 / mean).toFixed(0)} fps · frame ${mean.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms${glass}`;
      snaps = glassStats.hudUploads;
      d.length = 0;
      shown = t;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return <div ref={ref} className="glass-meter" />;
}

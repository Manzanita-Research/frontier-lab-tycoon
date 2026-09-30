// "What now? ↓" on a phone (FLT-57): the end screen is a long front page, and the next action sits below it. A button
// that takes you there, and goes away once it's on screen.
import { useEffect, useRef, useState } from "react";

export function useJumpTo<T extends HTMLElement>(on: boolean) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(!!e?.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  const jump = () => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  return { ref, show: on && !seen, jump };
}

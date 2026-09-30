// Reduced motion: the OS setting, or the player's own switch (the Display dialog sets `data-motion="reduced"`).
export const reducedMotion = () =>
  typeof document !== "undefined" &&
  (document.documentElement.dataset.motion === "reduced" || (typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));

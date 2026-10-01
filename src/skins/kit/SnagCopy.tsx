import { useEffect, useState } from "react";
import type { HudActions } from "../../ui/hud/types";
import { useT } from "../context";

/**
 * The recovery toast's "Copy details" (FLT-84): puts the snag report on the clipboard and says so for a moment ("Copied!",
 * or that the clipboard said no and the console has it). Labels are the skin's `snag.copy` / `snag.copied` / `snag.nocopy`.
 */
export function SnagCopy({ id, actions, className = "" }: { id: number; actions: Pick<HudActions, "copySnag">; className?: string }) {
  const t = useT();
  const [said, setSaid] = useState<"copied" | "nocopy" | null>(null);
  useEffect(() => {
    if (!said) return;
    const off = window.setTimeout(() => setSaid(null), 2_500);
    return () => window.clearTimeout(off);
  }, [said]);
  return (
    <button
      type="button"
      className={`snag-copy ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        void actions.copySnag(id).then((ok) => setSaid(ok ? "copied" : "nocopy"));
      }}
    >
      <span aria-live="polite">{t(said ? `snag.${said}` : "snag.copy")}</span>
    </button>
  );
}

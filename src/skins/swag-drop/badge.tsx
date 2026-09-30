// The Inspector as a lanyard ID badge. It drops in on its strap and swings, and flips over to show the personnel file.
// Agents wear the cyan CONTRACTOR (NON-HUMAN) variant.
import { useState } from "react";
import { Portrait, useT } from "../kit";
import type { InspectorVM, NeedVM, WalkerKindVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Glyph } from "./icons";

/** What the badge's header says, by who is wearing it. (Slot copy: it isn't in the skin's strings table.) */
const PASS: Record<WalkerKindVM, string> = {
  researcher: "ALL-HANDS ACCESS",
  agent: "CONTRACTOR (NON-HUMAN)",
  visitor: "VISITOR · ESCORT REQUIRED",
  protester: "GATE ACCESS: DENIED",
};

const CELLS = 8;

/** A battery of eight cells, like a phone at 12%. */
function Cells({ need }: { need: NeedVM }) {
  const on = Math.max(need.pct > 0 ? 1 : 0, Math.round((need.pct / 100) * CELLS));
  return (
    <div className="sd-bat">
      <span className="k">{need.label}</span>
      <span className={`cell ${need.tone}`} role="img" aria-label={`${need.label} ${need.pct}%`}>
        {Array.from({ length: CELLS }, (_, i) => (
          <i key={i} className={i < on ? "f" : ""} />
        ))}
      </span>
      <span className="v">{need.pct}%</span>
    </div>
  );
}

/** The strap: the lab's name and the pass type, printed on repeat. */
function Strap({ who }: { who: InspectorVM }) {
  const line = `${who.lab} · ${PASS[who.kind]} · `;
  return (
    <div className="sd-strap" aria-hidden>
      <span>{line + line}</span>
    </div>
  );
}

export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const compact = layout.compact;
  // Flipped is remembered per walker, so tapping someone new always shows their face.
  const [flippedFor, setFlippedFor] = useState<number | null>(null);
  const flipped = flippedFor === who.id;
  const flip = () => setFlippedFor(flipped ? null : who.id);
  const worst = who.needs.length > 0 ? who.needs.reduce((a, b) => (b.urgency > a.urgency ? b : a)) : null;
  const front = compact && worst ? [worst] : who.needs;
  const band = (label: string) => (
    <div className="sd-band">
      <b>{label}</b>
      <span className="hole" aria-hidden />
      <b>#{who.badge}</b>
      <button type="button" className="sd-x" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
        <Glyph name="close" />
      </button>
    </div>
  );
  return (
    <aside className={`sd-lanyard kind-${who.kind} ${compact ? "sheet" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      {/* Remounted per walker, so the drop and the swing play again for each new badge. */}
      <div className="sd-drop" key={who.id}>
        <div className="sd-swing">
          <Strap who={who} />
          <div className="sd-clip" aria-hidden />
          <div className={`sd-flipper ${flipped ? "flipped" : ""}`}>
            <div className="sd-face front" aria-hidden={flipped} inert={flipped}>
              {band(PASS[who.kind])}
              <div className="sd-who">
                <div className="sd-photo">
                  <Portrait who={who.portrait} className="sd-portrait" />
                </div>
                <div className="txt">
                  <h2>{who.name}</h2>
                  <div className="role">{who.role}</div>
                  <div className="chips">
                    <span className={`sd-chip mood-${who.mood}`}>{who.moodLabel}</span>
                    <span className="sd-chip b">{who.kindLabel}</span>
                  </div>
                </div>
              </div>
              <div className="sd-status">{who.status}</div>
              {front.map((n) => (
                <Cells key={n.key} need={n} />
              ))}
              <div className="sd-quote">
                <span className="k">{t("inspector.thinking")}</span>
                <q>{who.thought}</q>
              </div>
              <div className="sd-actions">
                <button type="button" className={`sd-key wide sd-follow ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
                  <span className="face">{who.following ? t("inspector.following") : t("inspector.follow")}</span>
                  <span className="band" />
                </button>
                <button type="button" className="sd-flip" onClick={flip} aria-label="Flip the badge over to read the personnel file">
                  <Glyph name="flip" />
                  <span>File</span>
                </button>
              </div>
            </div>
            <div className="sd-face back" aria-hidden={!flipped} inert={!flipped}>
              {band("PERSONNEL FILE")}
              <div className="sd-file">
                <h2>{who.name}</h2>
                <ul>
                  {who.history.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                {compact && who.needs.map((n) => <Cells key={n.key} need={n} />)}
                <div className="sd-barcode" aria-hidden />
              </div>
              <div className="sd-actions">
                <button type="button" className="sd-flip" onClick={flip} aria-label="Flip the badge back over">
                  <Glyph name="flip" />
                  <span>Front</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// FLT-109: the late lunch's delivery tracker, as a 1995 download dialog: "Order Tracker", the courier's progress in
// blocks (it goes backwards too), the estimated time left with every earlier estimate struck through, and a status line
// that has given up. OK hides it until the next order; it stays after the bowls come so 10× can't blink it away.
import { useState } from "react";
import type { SlotPropsMap } from "../types";
import { Blocks, Btn, Win } from "./parts";
import { Ico } from "./icons";

export function OrderTracker({ lunch }: SlotPropsMap["OrderTracker"]) {
  const [closed, setClosed] = useState<number | null>(null);
  if (closed === lunch.id) return null;
  const close = () => setClosed(lunch.id);
  return (
    <Win className={`f95-lunch stage-${lunch.stage}`} title={`${lunch.app} - ${lunch.order}`} icon={lunch.delivered ? "info" : "warn"} role="status" label={lunch.app} buttons={[{ g: "close", label: "Close", onClick: close }]}>
      <div className="f95-lunch-body">
        <div className="f95-lunch-anim" aria-hidden>
          <span>🥗</span>
          <i className={lunch.delivered ? "" : "going"}>· · · · ·</i>
          <span>🏢</span>
        </div>
        <p className="f95-lunch-from">
          From: <b>{lunch.place}</b>
        </p>
        <Blocks value={lunch.route} label="Courier's progress" tone={lunch.backwards ? "red" : "navy"} />
        <dl className="f95-lunch-rows">
          <dt>Estimated time left:</dt>
          <dd>
            {lunch.slipped.map((s) => (
              <s key={s}>{s}</s>
            ))}
            <b>{lunch.eta}</b>
          </dd>
          <dt>Status:</dt>
          <dd>{lunch.status}</dd>
        </dl>
        {lunch.stage !== "arriving" && !lunch.delivered && <p className="f95-lunch-day">{lunch.dayLine}</p>}
        {lunch.backwards && (
          <p className="f95-lunch-warn">
            <Ico name="warn" size={16} /> Research is going backwards.
          </p>
        )}
        <div className="f95-row">
          <Btn def onClick={close}>
            OK
          </Btn>
        </div>
      </div>
    </Win>
  );
}

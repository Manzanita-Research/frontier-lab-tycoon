import type { SlotPropsMap } from "../../types";

/** The Takeover under way: who runs the lab now, and the last card. Not modal: the manager is busy building. */
export function Takeover({ takeover }: SlotPropsMap["Takeover"]) {
  return (
    <>
      <div className="takeover-banner" role="status">
        <span aria-hidden>🤖</span> {takeover.title}
        <small>{takeover.placed === 1 ? "1 building placed" : `${takeover.placed} buildings placed`} · please don't touch anything</small>
      </div>
      {takeover.thanks && (
        <div className="takeover-thanks" role="status">
          <p>{takeover.thanks}</p>
          <small>— {takeover.manager}</small>
        </div>
      )}
    </>
  );
}

import { useAtomValue } from "@effect/atom-react";
import { STAFF } from "../../content/staff";
import { formatMoney } from "../../sim/format";
import { atoms, registry, send } from "../../app/game";
import { useApp, useAutoPause } from "../../app/hooks";
import { staffOpenAtom } from "./staffState";
import "./ops.css";

const ink = "#3a2a1c";

/** A little hard-hat head, for the palette tile. */
export function StaffIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <circle cx="16" cy="18" r="7" fill="#ffd9b8" stroke={ink} strokeWidth="2" />
      <path d="M8.5 16 A7.5 7.5 0 0 1 23.5 16 Z" fill="#ffc21a" stroke={ink} strokeWidth="2" />
      <rect x="6.5" y="15.5" width="19" height="3" rx="1.5" fill="#ffc21a" stroke={ink} strokeWidth="2" />
      <rect x="11" y="18.5" width="4" height="2.4" rx="1" fill={ink} />
      <rect x="17" y="18.5" width="4" height="2.4" rx="1" fill={ink} />
      <path d="M8 29 Q16 23 24 29" fill="#ff8a2b" stroke={ink} strokeWidth="2" />
    </svg>
  );
}

/** The tile at the end of the build palette: how many people are on the payroll, and the panel's switch. */
export function StaffTool() {
  const open = useAtomValue(staffOpenAtom);
  const count = useApp(atoms.staffCount);
  const payroll = useApp(atoms.payroll);
  return (
    <button className={`tool staff-tool ${open ? "on" : ""}`} onClick={() => registry.set(staffOpenAtom, !open)} aria-pressed={open} title="Staff: hire Janitor Bots, SREs, Comms Reps and Security">
      <span className="icon">
        <StaffIcon />
      </span>
      <span className="tname">Staff{count > 0 ? ` (${count})` : ""}</span>
      <span className="price">{count > 0 ? `${formatMoney(payroll)}/day` : "hire"}</span>
    </button>
  );
}

/** The payroll: hire and fire, and paint patrol zones. It opens from the palette and never lives in the right-hand column. */
export function StaffPanel() {
  const open = useAtomValue(staffOpenAtom);
  useAutoPause("staff", open);
  const ops = useApp(atoms.ops);
  const zoneId = useApp(atoms.zone);
  if (!open) return null;
  const painting = zoneId === null ? null : ops.staff.find((s) => s.id === zoneId);
  const close = () => {
    send({ type: "SET_ZONE", id: null });
    registry.set(staffOpenAtom, false);
  };
  if (painting) {
    return (
      <aside className="staff panel painting" aria-label="Painting a patrol zone">
        <div className="staff-paint">
          <b>{painting.name}</b>
          <span>
            Drag on the map to paint their patrol zone; drag from a painted tile to erase. {painting.zone > 0 ? `${painting.zone} tiles.` : "Empty means the whole campus."}
          </span>
        </div>
        <div className="staff-paint-buttons">
          {painting.zone > 0 && (
            <button className="mini" onClick={() => send({ type: "COMMAND", command: { type: "clearZone", id: painting.id } })}>
              Clear
            </button>
          )}
          <button className="mini primary" onClick={() => send({ type: "SET_ZONE", id: null })}>
            Done
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside className="staff panel" aria-label="Staff">
      <div className="staff-head">
        <span className="staff-title">Staff</span>
        <span className="staff-pay">{ops.staff.length > 0 ? `${formatMoney(ops.payroll)}/day` : "nobody on the payroll"}</span>
        <button className="staff-x" onClick={close} aria-label="Close">
          ×
        </button>
      </div>
      <ul className="staff-hire">
        {ops.jobs.map((j) => (
          <li key={j.job}>
            <span className="swatch" style={{ background: STAFF[j.job].color }} aria-hidden />
            <span className="hire-text">
              <b>{j.title}</b> <span className="dim">{formatMoney(j.salary)}/day</span>
              <span className="blurb" title={j.blurb}>
                {j.blurb}
              </span>
            </span>
            <button className="mini primary" disabled={!j.canHire} title={j.reason} onClick={() => send({ type: "COMMAND", command: { type: "hire", job: j.job } })}>
              Hire{j.count > 0 ? ` (${j.count})` : ""}
            </button>
          </li>
        ))}
      </ul>
      {ops.staff.length > 0 && (
        <ul className="staff-roster">
          {ops.staff.map((s) => (
            <li key={s.id} className={s.leaving ? "leaving" : ""}>
              <span className="swatch" style={{ background: STAFF[s.job].color }} aria-hidden />
              <span className="roster-text">
                <b>{s.name}</b>
                <span className="blurb" title={`${s.title} · ${s.status}`}>
                  {s.title} · {s.status}
                </span>
                <span className="blurb zonetag">{s.zone > 0 ? `patrol zone: ${s.zone} tiles` : "patrols the whole campus"}</span>
              </span>
              <button className="mini" disabled={s.leaving} onClick={() => send({ type: "SET_ZONE", id: s.id })} title="Paint a patrol zone on the map">
                Zone
              </button>
              <button className="mini danger" disabled={s.leaving} onClick={() => send({ type: "COMMAND", command: { type: "fire", id: s.id } })}>
                Fire
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="staff-foot">
        The campus is <b className={ops.slopPct > 20 ? "bad" : ""}>{ops.slopPct}% slop</b>
        {ops.broken.length > 0 ? (
          <>
            {" "}
            · <b className="bad">{ops.broken.length} out of order</b>
          </>
        ) : null}
        .
      </div>
    </aside>
  );
}

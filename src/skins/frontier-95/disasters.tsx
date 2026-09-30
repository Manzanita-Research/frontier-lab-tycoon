// Disasters (FLT-32) as a 1995 desktop: a Control Panel applet to set how often they come and start one, and an
// application error box for each one under way.
import { useState } from "react";
import { Dialog } from "../kit";
import { useT } from "../context";
import type { DisasterRowVM, DisasterRunVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Blocks, Btn, Win } from "./parts";
import { Ico } from "./icons";

/** "Rogue Agent Swarm" is ROGUE_AGENT_SWARM.EXE, as any program that has just crashed is. */
export const exeName = (name: string) => `${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}.EXE`;

const HEADLINE: Record<DisasterRunVM["stage"], (name: string) => string> = {
  warning: (n) => `${exeName(n)} is about to perform an illegal operation.`,
  active: (n) => `${exeName(n)} has performed an illegal operation and will be shut down.`,
  response: (n) => `${exeName(n)} is being shut down. Please wait.`,
  aftermath: (n) => `${exeName(n)} has been shut down. Mostly.`,
  done: (n) => `${exeName(n)} has been shut down.`,
};
const STAGE_ICON = { warning: "warn", active: "error", response: "error", aftermath: "info", done: "info" } as const;

/**
 * One application error box per disaster under way. OK folds it to its title bar (the disaster carries on regardless),
 * Details >> says which phase it is in and for how long. Who has been pulled off their post is always shown: an unguarded
 * gate is the thing you need to know. Nothing going on: nothing drawn (the applet is under Start ▸ Settings).
 */
export function DisasterAlert({ disasters, actions }: SlotPropsMap["DisasterAlert"]) {
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, boolean>>({});
  if (disasters.running.length === 0 && disasters.understaffed.length === 0) return null;
  const fold = (id: string, on: boolean) => setFolded((f) => ({ ...f, [id]: on }));
  return (
    <div className="f95-dz-stack">
      {disasters.running.map((r, i) => {
        const title = exeName(r.name);
        if (folded[r.id]) {
          return (
            <Win key={r.id} className={`f95-dz-err folded stage-${r.stage}`} title={title} icon={`dz-${r.id}`} onTitleClick={() => fold(r.id, false)} buttons={[{ g: "max", label: "Restore", onClick: () => fold(r.id, false) }]} />
          );
        }
        return (
          <Win key={r.id} className={`f95-dz-err stage-${r.stage}`} title={title} icon={`dz-${r.id}`} role="alert" label={`${r.name}: ${r.phaseLabel}`} buttons={[{ g: "close", label: "Close", onClick: () => fold(r.id, true) }]}>
            <div className="f95-errbody">
              <Ico name={STAGE_ICON[r.stage]} size={32} />
              <div>
                <p className="f95-dz-head">{HEADLINE[r.stage](r.name)}</p>
                <p className="f95-dz-line">{r.line}</p>
              </div>
            </div>
            {r.progress !== null && (
              <div className="f95-dz-prog">
                <Blocks value={r.progress} label={r.progressText ?? r.phaseLabel} />
                <small>{r.progressText}</small>
              </div>
            )}
            {i === 0 && disasters.understaffed.map((u) => <Short key={u.job} text={u.text} all={u.all} />)}
            {details[r.id] && (
              <pre className="f95-dz-details inset">
                {`${title} caused a ${r.phaseLabel.toUpperCase()} fault\nin module LAB.DLL at ${r.daysText.toUpperCase()}.\nRegisters:\nTRUST=${String(disasters.trust.value).padStart(3, "0")} HEAT=${String(disasters.heat.value).padStart(3, "0")}`}
              </pre>
            )}
            <div className="f95-row">
              <Btn def onClick={() => fold(r.id, true)}>
                OK
              </Btn>
              <Btn aria-expanded={!!details[r.id]} onClick={() => setDetails((d) => ({ ...d, [r.id]: !d[r.id] }))}>
                {details[r.id] ? "<< Details" : "Details >>"}
              </Btn>
            </div>
          </Win>
        );
      })}
      {disasters.running.length === 0 && (
        <Win className="f95-dz-err" title="Lab Manager" icon="warn" role="alert" label="Understaffed">
          <div className="f95-errbody">
            <Ico name="warn" size={32} />
            <div>{disasters.understaffed.map((u) => <Short key={u.job} text={u.text} all={u.all} />)}</div>
          </div>
          <div className="f95-row">
            <Btn def onClick={() => actions.openDisasters()}>
              Disasters…
            </Btn>
          </div>
        </Win>
      )}
    </div>
  );
}

function Short({ text, all }: { text: string; all: boolean }) {
  return <p className={`f95-dz-short ${all ? "all" : ""}`}>{text}</p>;
}

/**
 * Control Panel ▸ Disasters: the random-disaster setting as radio buttons, the disasters as a list you pick one from,
 * and Trust and Heat as two meters. Start… asks first, with No as the default.
 */
export function DisasterMenu({ disasters, actions }: SlotPropsMap["DisasterMenu"]) {
  const t = useT();
  const [picked, setPicked] = useState<string | null>(null);
  const [asking, setAsking] = useState<DisasterRowVM | null>(null);
  const close = () => actions.closeDisasters();
  const row = disasters.menu.find((m) => m.id === picked && m.available) ?? null;

  if (asking) {
    const no = () => setAsking(null);
    return (
      <Dialog label={t("disasters.ask", { name: asking.name })} close={no} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
        <Win className="f95-msgbox f95-dz-ask" title="Disasters" icon="warn" buttons={[{ g: "close", label: "No", onClick: no }]} role="alertdialog" label={t("disasters.ask", { name: asking.name })}>
          <div className="f95-msgbody">
            <Ico name={`dz-${asking.id}`} size={36} />
            <div>
              <h2>{t("disasters.ask", { name: asking.name })}</h2>
              <p>{asking.blurb}</p>
              <p className="f95-confirm-facts">This cannot be undone. It can, at best, be cleaned up.</p>
            </div>
          </div>
          <div className="f95-row">
            <Btn className="f95-dz-yes" onClick={() => actions.triggerDisaster(asking.id)}>
              Yes
            </Btn>
            <Btn def autoFocus onClick={no}>
              No
            </Btn>
          </div>
        </Win>
      </Dialog>
    );
  }

  return (
    <Dialog label={t("disasters.title")} close={close} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-dz-applet" title="Disasters Properties" icon="siren" buttons={[{ g: "help", label: "Help" }, { g: "close", label: "Close", onClick: close }]}>
        <div className="f95-page f95-dz-page">
          <p className="f95-dz-lede">{t("disasters.lede")}</p>
          <fieldset className="f95-dz-risk">
            <legend>{t("disasters.risk")}</legend>
            {disasters.risks.map((r) => (
              <label key={r.key} className={`risk-${r.key}`}>
                <input type="radio" name="f95-dz-risk" checked={r.active} onChange={() => actions.setRisk(r.key)} /> {r.label}
              </label>
            ))}
            <small>
              {disasters.risks.find((r) => r.active)?.blurb}
              {disasters.calm && <> {disasters.calm}</>}
            </small>
          </fieldset>
          <fieldset className="f95-dz-listbox">
            <legend>{t("disasters.menu")}</legend>
            <ul className="inset" role="listbox" aria-label={t("disasters.menu")}>
              {disasters.menu.map((m) => (
                <li key={m.id} role="option" aria-selected={picked === m.id} aria-disabled={!m.available}>
                  <button type="button" className={`${picked === m.id ? "on" : ""} ${m.active ? "live" : ""}`} disabled={!m.available} title={m.reason ?? m.blurb} onClick={() => setPicked(m.id)} onDoubleClick={() => setAsking(m)}>
                    <Ico name={`dz-${m.id}`} size={24} />
                    <span className="nm">{m.name}</span>
                    <span className="st">{m.active ? t("disasters.active") : m.tags.map((tag) => tag.label).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
            <small className="f95-dz-desc">{row ? row.blurb : "Pick one. Double-click if you are sure."}</small>
          </fieldset>
          <fieldset className="f95-dz-meters">
            <legend>Standing</legend>
            <span>{t("disasters.trust")}</span>
            <Blocks value={disasters.trust.value / 100} label={t("disasters.trust")} />
            <span className="v">{disasters.trust.text}</span>
            <span>{t("disasters.heat")}</span>
            <Blocks value={disasters.heat.value / 100} label={t("disasters.heat")} tone="red" />
            <span className="v">{disasters.heat.text}</span>
          </fieldset>
        </div>
        <div className="f95-row">
          <Btn disabled={!row} onClick={() => row && setAsking(row)}>
            Start…
          </Btn>
          <Btn def onClick={close}>
            OK
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

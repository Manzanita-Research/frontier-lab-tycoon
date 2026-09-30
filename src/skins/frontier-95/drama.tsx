// Frontier 95's drama cards (FLT-26 Defection, FLT-20 Poaching War): the resignation draft open in WordSad, the recruiter's
// message in Outlook Excess and the neo lab's MANIFESTO.txt in NoteBad, with the choices underneath as a message box's buttons.
import { useT } from "../context";
import type { DramaVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Btn, Win } from "./parts";

const APP = {
  letter: { app: "WordSad", icon: "doc", menu: ["File", "Edit", "View", "Insert", "Format", "Help"] },
  email: { app: "Message", icon: "chat", menu: ["File", "Edit", "View", "Tools", "Compose", "Help"] },
  manifesto: { app: "NoteBad", icon: "doc", menu: ["File", "Edit", "Search", "Help"] },
} as const;

function Page({ drama }: { drama: DramaVM }) {
  if (drama.style === "email") {
    return (
      <>
        <dl className="f95-mailhead">
          <dt>From:</dt>
          <dd className="inset">{drama.from}</dd>
          <dt>To:</dt>
          <dd className="inset">{drama.to}</dd>
          <dt>Subject:</dt>
          <dd className="inset">{drama.subject}</dd>
        </dl>
        <div className="f95-page f95-mail inset">
          {drama.lines.map((l, i) => (
            <p key={`${i}:${l}`}>{l}</p>
          ))}
          <p className="f95-sign">{drama.sign}</p>
        </div>
      </>
    );
  }
  if (drama.style === "manifesto") {
    return (
      <pre className="f95-page f95-notepad inset">
        {[...drama.lines, "", drama.sign].join("\n")}
        <span className="f95-cursor" aria-hidden />
      </pre>
    );
  }
  return (
    <>
      <div className="f95-wordbar" aria-hidden>
        <span className="f95-font inset">Times New Roman</span>
        <span className="f95-font inset">12</span>
        <b>B</b>
        <i>I</i>
        <u>U</u>
      </div>
      <div className="f95-page f95-wordpad inset">
        <div className="f95-paper">
          <p className="f95-subject">{drama.subject}</p>
          {drama.lines.map((l, i) => (
            <p key={`${i}:${l}`}>{l}</p>
          ))}
          <p className="f95-sign">{drama.sign}</p>
        </div>
      </div>
    </>
  );
}

export function Drama({ event, drama, actions }: SlotPropsMap["Drama"]) {
  const t = useT();
  const app = APP[drama.style];
  const title = drama.style === "email" ? `${drama.subject} - ${app.app}` : `${drama.file} - ${app.app}`;
  return (
    <div className="f95-layer f95-dim">
      <Win
        className={`f95-msgbox f95-drama f95-drama-${drama.style} tone-${event.tone}`}
        title={title}
        icon={app.icon}
        role="alertdialog"
        label={event.title}
        buttons={[
          { g: "min", label: "Minimize", disabled: true },
          { g: "close", label: "Close", disabled: true },
        ]}
      >
        <div className="f95-menubar" aria-hidden>
          {app.menu.map((m) => (
            <span key={m}>
              <u>{m[0]}</u>
              {m.slice(1)}
            </span>
          ))}
        </div>
        <div aria-label={drama.file}>
          <Page drama={drama} />
        </div>
        <div className="f95-msgbody">
          <div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </div>
        </div>
        <div className="f95-choices">
          {event.choices.map((c, i) => (
            <Btn key={c.label} def={i === 0} onClick={() => actions.choose(event.id, i)} autoFocus={i === 0}>
              <span className="k">{c.key}</span>
              <span className="tx">
                <b>{c.label}</b>
                <small>{c.hint}</small>
              </span>
            </Btn>
          ))}
        </div>
        <div className="f95-status">
          {drama.style === "email" ? `${drama.file} · 1 unread · ` : drama.style === "letter" ? "Autosaved 38 times · " : "Ln 1, Col 1 · "}
          {t("event.paused")}
        </div>
      </Win>
    </div>
  );
}

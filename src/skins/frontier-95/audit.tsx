// Evals Without Borders in Frontier 95: the report card is REPORT.DOC open in a word processor (Times on white paper, a
// red rubber stamp across it), and the sign over the auditors is a tiny file-copy dialog.
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Blocks, Btn, Win } from "./parts";
import { Ico } from "./icons";

export function ReportCard({ event, report, actions }: SlotPropsMap["ReportCard"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win
        className={`f95-report overall-${report.overall}`}
        title="REPORT.DOC - WordPerfectly"
        icon="doc"
        role="alertdialog"
        label={event.title}
        buttons={[{ g: "help", label: "Help", disabled: true }, { g: "close", label: "Close", disabled: true }]}
      >
        <div className="f95-menubar" aria-hidden>
          <span><u>F</u>ile</span>
          <span><u>E</u>dit</span>
          <span><u>V</u>iew</span>
          <span><u>A</u>ppeal</span>
        </div>
        <div className="f95-report-well inset">
          <article className="f95-report-page">
            <header>
              <small>{event.stripe}</small>
              <h2>{event.title}</h2>
              <p>
                {report.lab} · {report.visitText}
                {report.prepText && <> · {report.prepText}</>}
              </p>
              <div className="f95-report-overall" aria-label={`${t("report.overall")}: ${report.overall}`}>{report.overall}</div>
            </header>
            <table>
              <tbody>
                {report.grades.map((g) => (
                  <tr key={g.id} className={`grade-${g.grade}`}>
                    <th scope="row">{g.label}</th>
                    <td className="g">{g.grade}</td>
                    <td className="r">{g.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="f95-report-headline">{report.headline}</p>
            {report.stamp && <div className="f95-report-stamp">{report.stamp}</div>}
          </article>
        </div>
        {report.moves.length > 0 && (
          <div className="f95-report-moves">
            {report.moves.map((m) => (
              <span key={m.text} className={`tone-${m.tone}`}>{m.text}</span>
            ))}
          </div>
        )}
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
        <div className="f95-status">Page 1 of 1 · {t("event.paused")}</div>
      </Win>
    </div>
  );
}

/** A file-copy dialog the size of a sticky note, floating over the auditors: "Inspecting the Kombucha Bar ▮▮▮▮░░". */
export function AuditPin({ audit }: SlotPropsMap["AuditPin"]) {
  const t = useT();
  return (
    <Win className={`f95-auditpin ${audit.evals ? "evals" : ""}`} title={t("audit.who")} icon={audit.evals ? "hall" : "doc"}>
      <div className="f95-auditpin-in">
        <span className="ln">{audit.line}</span>
        {audit.progress !== null && <Blocks value={audit.progress} label={audit.line ?? ""} />}
        {audit.stopsText && (
          <span className="st">
            <Ico name="folder" size={12} /> Stop {audit.stopsText}
            {audit.progress !== null && <> · {audit.progressText}</>}
          </span>
        )}
      </div>
    </Win>
  );
}

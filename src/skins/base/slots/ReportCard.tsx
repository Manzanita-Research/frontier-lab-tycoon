import { useT } from "../../context";
import type { ReportCardVM } from "../../../ui/hud/types";
import type { SlotPropsMap } from "../../types";
import { Choices } from "./EventCard";

/** The grade table: one subject a row, the grade in a box, the auditors' remark in the margin. */
export function ReportGrades({ report }: { report: ReportCardVM }) {
  return (
    <table className="report-grades">
      <tbody>
        {report.grades.map((g) => (
          <tr key={g.id} className={`grade-${g.grade}`}>
            <th scope="row">{g.label}</th>
            <td className="report-grade" aria-label={`${g.label}: ${g.grade}`}>{g.grade}</td>
            <td className="report-remark">{g.comment}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Evals Without Borders' report card: five subjects graded A to F, the overall grade, a red stamp if they caught you
 * hiding (or found the Swarm), and what it did to trust, heat and hype. The game is paused; answer with `actions.choose`.
 */
export function ReportCard({ event, report, actions }: SlotPropsMap["ReportCard"]) {
  const t = useT();
  return (
    <div className="modal-backdrop">
      <div className={`modal-card report-card overall-${report.overall}`} role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="card-stripe">
          <span>{event.stripe}</span>
          <span className="paused">{t("event.paused")}</span>
        </div>
        <div className="card-body">
          <div className="report-head">
            <div>
              <h2>{event.title}</h2>
              <p className="report-sub">
                {report.lab} · {report.visitText}
                {report.prepText && <> · {report.prepText}</>}
              </p>
            </div>
            <div className="report-overall" aria-label={`${t("report.overall")}: ${report.overall}`}>
              <small>{t("report.overall")}</small>
              {report.overall}
            </div>
          </div>
          <ReportGrades report={report} />
          {report.stamp && <div className="report-stamp">{report.stamp}</div>}
          <p className="report-headline">“{report.headline}”</p>
          {report.moves.length > 0 && (
            <div className="report-moves">
              {report.moves.map((m) => (
                <span key={m.text} className={`report-move tone-${m.tone}`}>{m.text}</span>
              ))}
            </div>
          )}
          <Choices event={event} actions={actions} />
        </div>
      </div>
    </div>
  );
}

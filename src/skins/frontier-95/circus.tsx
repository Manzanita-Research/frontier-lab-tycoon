// Frontier 95's Circus (FLT-21, FLT-24, FLT-22, FLT-23): the Hearing as a dial-up video conference with three senators
// on camera, the yacht summit's group chat as an instant messenger window somebody screenshotted, the bill as a word
// processor with track changes on, and the Promise Tracker as a spreadsheet.
import { Senator } from "../kit";
import { useT } from "../context";
import type { BillVM, ChoiceVM, EventVM, HearingVM, HudActions, TrackerSenatorVM, TrackerVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Win } from "./parts";

function Answers({ event, hearing, actions }: { event: EventVM; hearing?: HearingVM; actions: HudActions }) {
  return (
    <div className="f95-choices">
      {event.choices.map((c: ChoiceVM, i) => {
        const a = hearing?.answers[i];
        return (
          <Btn key={c.label} def={i === 0} onClick={() => actions.choose(event.id, i)} autoFocus={i === 0}>
            <span className="k">{c.key}</span>
            <span className="tx">
              <b>{c.label}</b>
              <small>
                {c.hint}
                {a?.moves.map((m) => (
                  <span key={m.meter} className={`f95-move ${m.good === null ? "sly" : m.good ? "up" : "down"}`}>
                    {m.label} {m.arrows}
                  </span>
                ))}
              </small>
            </span>
          </Btn>
        );
      })}
    </div>
  );
}

/** The Hearing: CapitolCam, three tiles, the speaker's lit up. */
export function Hearing({ event, hearing, actions }: SlotPropsMap["Hearing"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox f95-hearing" title={<>CapitolCam 1.0: Senate hearing on {hearing.topic}</>} icon="globe" role="alertdialog" label={event.title}>
        <div className="f95-tiles">
          {hearing.senators.map((s) => (
            <figure key={s.id} className={`f95-tile inset ${s.asking ? "speaking" : ""}`}>
              {s.asking && <span className="f95-onair">● REC</span>}
              <Senator who={s} className="f95-senator" />
              {s.answered && <span className={`f95-stamp a-${s.answered}`}>{s.answered}</span>}
              <figcaption>
                {s.name} <small>({s.seat})</small>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="f95-msgbody">
          <Ico name={hearing.verdict ? "info" : "chat"} size={36} />
          <div>
            {hearing.verdict ? (
              <>
                <h2>{hearing.verdict.title}</h2>
                <p>{hearing.verdict.line}</p>
              </>
            ) : (
              <>
                {hearing.asking && <b className="f95-asker">{hearing.asking.name}:</b>}
                <h2>{event.title}</h2>
                <p>{event.body}</p>
              </>
            )}
          </div>
        </div>
        <fieldset className="f95-meters">
          <legend>Meters</legend>
          {[hearing.trust, hearing.capture].map((m, i) => (
            <label key={m.label}>
              <span>{m.label}</span>
              <Blocks value={m.value / 100} label={m.label} tone={i === 0 ? "navy" : "red"} />
              <b>{m.text}</b>
            </label>
          ))}
        </fieldset>
        <Answers event={event} hearing={hearing} actions={actions} />
        <div className="f95-status">
          {hearing.progressText} · {t("event.paused")}
        </div>
      </Win>
    </div>
  );
}

/** The leak: Chat-o-Matic, the room's log on the left, who was in it on the right, a red stamp across both. */
export function LeakedChat({ event, leak, actions }: SlotPropsMap["LeakedChat"]) {
  const t = useT();
  const names = [...new Set(leak.messages.filter((m) => !m.system).map((m) => m.name))];
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox f95-leak" title={<>Chat-o-Matic 95: #{leak.groupName}</>} icon="chat" role="alertdialog" label={event.title}>
        <div className="f95-leakpane">
          <ol className="f95-log inset">
            {leak.messages.map((m, i) => (
              <li key={i} className={m.system ? "sys" : m.you ? "you" : ""}>
                {m.system ? (
                  <i>*** {m.text}</i>
                ) : (
                  <>
                    <span className="ts">[{m.time}]</span> <b style={{ color: m.color }}>&lt;{m.name}&gt;</b> {m.text}
                  </>
                )}
              </li>
            ))}
          </ol>
          <ul className="f95-members inset" aria-label={leak.members}>
            {names.map((n) => (
              <li key={n}>@{n}</li>
            ))}
            <li>@the yacht</li>
          </ul>
          <span className="f95-leaked" aria-hidden>
            LEAKED
          </span>
        </div>
        <div className="f95-msgbody">
          <Ico name="warn" size={36} />
          <div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </div>
        </div>
        <Answers event={event} actions={actions} />
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </div>
  );
}

/** A margin comment, as the word processor draws them: initials in brackets, then the honest version. */
function Balloon({ n, text }: { n: number; text: string }) {
  return (
    <aside className="f95-balloon">
      <b>{`Comment [LL${n}]:`}</b> {text}
    </aside>
  );
}

/** The page: the act's title, the enacting words, and the clauses as tracked insertions with the truth in the margin. */
function BillPage({ bill, actions }: { bill: BillVM; actions: HudActions }) {
  const shown = bill.editable ? bill.clauses : bill.clauses.filter((c) => c.on);
  let n = 0;
  return (
    <div className="f95-page-sheet">
      <h3>{bill.act}</h3>
      <p className="f95-enact">Be it enacted by the Senate, in the public interest, that:</p>
      {shown.length === 0 && <p className="f95-enact">[This page intentionally left blank.]</p>}
      <ol className="f95-clauses">
        {shown.map((c) => {
          const full = bill.editable && !c.on && bill.picked >= bill.pick;
          if (c.on) n++;
          return (
            <li key={c.id} className={`${c.on ? "ins" : "del"} shame-${c.shame}`}>
              <label className="f95-clause">
                {bill.editable && <input type="checkbox" checked={c.on} disabled={full} onChange={(e) => actions.draftClause(c.id, e.currentTarget.checked)} aria-label={c.title} />}
                <span>
                  <b>{c.title}.</b> {c.legal}
                  <small className="f95-fx">{c.effect}</small>
                </span>
              </label>
              {c.on && <Balloon n={n} text={c.plain} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The bill: WordPerfectly 6.0 with Track Changes on. The draft ticks clauses in; the leak opens File ▸ Properties. */
export function Bill({ event, bill, actions }: SlotPropsMap["Bill"]) {
  const t = useT();
  const exposed = bill.stage === "exposed";
  return (
    <div className="f95-layer f95-dim">
      <Win className={`f95-msgbox f95-bill ${exposed ? "exposed" : ""}`} title={<>WordPerfectly 6.0 - [{bill.fileName}]</>} icon="doc" role="alertdialog" label={event.title}>
        <div className="f95-menubar" aria-hidden>
          <span>
            <u>F</u>ile
          </span>
          <span>
            <u>E</u>dit
          </span>
          <span>
            <u>V</u>iew
          </span>
          <span>
            <u>I</u>nsert
          </span>
          <span>
            <u>T</u>ools
          </span>
          <span className="f95-trk">TRK</span>
        </div>
        <div className="f95-docwrap inset">
          <BillPage bill={bill} actions={actions} />
          {exposed && (
            <Win className="f95-props" title={<>{bill.fileName} Properties</>} icon="info">
              <dl>
                <dt>Title:</dt>
                <dd>{bill.act}</dd>
                <dt>Author:</dt>
                <dd className="hot">{bill.author}</dd>
                <dt>Company:</dt>
                <dd className="hot">{bill.author}</dd>
                <dt>Opened by:</dt>
                <dd>{bill.reporter}</dd>
              </dl>
            </Win>
          )}
        </div>
        {bill.editable && (
          <div className={`f95-leakrisk ${bill.risk >= 0.3 ? "hot" : ""}`}>
            <span>Metadata risk:</span>
            <Blocks value={bill.risk} label="Leak risk" tone={bill.risk >= 0.3 ? "red" : "navy"} />
            <span>
              <b>{bill.riskText}</b> · {bill.riskLabel}
            </span>
          </div>
        )}
        <div className="f95-msgbody">
          <Ico name={exposed ? "warn" : "doc"} size={36} />
          <div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
          </div>
        </div>
        <Answers event={event} actions={actions} />
        <div className="f95-status">
          Pg 1 · {bill.editable ? bill.pickText : bill.status} · Track changes: ON · {t("event.paused")}
        </div>
      </Win>
    </div>
  );
}

const COLS = ["A", "B", "C", "D", "E", "F"];

/** One senator's row of the sheet. Before the vote: promised, leaning, odds, the lobby button. After: promised, voted, KEPT or BROKEN. */
function SheetRow({ row, s, tracker, actions }: { row: number; s: TrackerSenatorVM; tracker: TrackerVM; actions: HudActions }) {
  const vote = !tracker.lobbying && tracker.last ? s.recent.at(-1) : undefined;
  return (
    <tr className={s.lobbied ? "lobbied" : ""}>
      <th>{row}</th>
      <td className="who">
        <Senator who={{ id: s.id, look: s.look, asking: false }} className="f95-cellface" />
        <span>
          <b>{s.name}</b>
          <small>{s.seat}</small>
        </span>
      </td>
      <td className={`side-${s.said ?? "none"}`} title={s.line}>
        {s.saidText.toUpperCase()}
      </td>
      {vote ? (
        <>
          <td className={`side-${vote.voted.toLowerCase()}`}>{vote.voted.toUpperCase()}</td>
          <td className={vote.kept ? "kept" : "broken"}>{vote.kept ? "KEPT" : "BROKEN"}</td>
        </>
      ) : (
        <>
          <td className={`side-${s.leaning ?? "none"}`}>
            {s.leaning ? s.leaning.toUpperCase() : "-"} <small>{s.oddsText}</small>
          </td>
          <td>
            {tracker.lobbying ? (
              <Btn className="f95-cellbtn" disabled={!s.canLobby} onClick={() => actions.lobby(s.id)}>
                {s.lobbied ? "Lobbied" : `Lobby ${s.feeText}`}
              </Btn>
            ) : (
              "-"
            )}
          </td>
        </>
      )}
      <td className="truth">
        <Blocks value={(s.truth ?? 0) / 100} label={`Truth-o-meter: ${s.truthLabel}`} tone={(s.truth ?? 0) < 50 ? "red" : "navy"} />
        <span>
          <b>{s.truthLabel}</b> <small>{s.record}</small>
        </span>
      </td>
    </tr>
  );
}

/** The Promise Tracker: Excess 95 with PROMISES.XLS open. The formula bar says what the sheet is for. */
export function PromiseTracker({ event, tracker, bill, actions }: SlotPropsMap["PromiseTracker"]) {
  const t = useT();
  const m = tracker.motion;
  const after = !tracker.lobbying && !!tracker.last;
  const law = bill && bill.stage === "law" ? bill : null;
  const hit = law ? law.rivals.filter((r) => r.tags.length > 0) : [];
  return (
    <div className="f95-layer f95-dim">
      <Win
        className="f95-msgbox f95-xls"
        title="Excess 95 - [PROMISES.XLS]"
        icon="chart"
        role={event ? "alertdialog" : "dialog"}
        label={event?.title ?? "PROMISES.XLS"}
        buttons={event ? [] : [{ g: "close", label: t("inspector.close"), onClick: () => actions.closeSenate() }]}
      >
        <div className="f95-formula">
          <span className="ref inset">E2</span>
          <span className="fx">fx</span>
          <code className="inset">=IF(PROMISED=VOTED, &quot;KEPT&quot;, &quot;LOL&quot;)</code>
        </div>
        <div className="f95-sheetwrap inset">
          <table className="f95-sheet">
            <thead>
              <tr>
                <th />
                {COLS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="hdr">
                <th>1</th>
                <td>Senator</td>
                <td>Promised</td>
                <td>{after ? "Voted" : "Leaning (your odds)"}</td>
                <td>{after ? "Kept?" : "Lobbyists"}</td>
                <td>Truth-o-meter</td>
                <td />
              </tr>
              {tracker.senators.map((s, i) => (
                <SheetRow key={s.id} row={i + 2} s={s} tracker={tracker} actions={actions} />
              ))}
              <tr className="motion">
                <th>5</th>
                <td colSpan={6}>
                  {m ? (
                    <>
                      <b>{m.title}</b> {m.summary} <em className={`side-${m.labSide}`}>({m.labSideText})</em>
                      {m.stakes && (
                        <span className="f95-stakes">
                          <span>
                            <b>=IF(PASS)</b> {m.stakes.pass}
                          </span>
                          <span>
                            <b>=IF(FAIL)</b> {m.stakes.fail}
                          </span>
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <b>In recess.</b> {tracker.last ? `Last: ${tracker.last.title}, ${tracker.last.passed ? "passed" : "failed"} ${tracker.last.tally}.` : "Nothing on the docket."}
                    </>
                  )}
                </td>
              </tr>
              {law && (
                <tr className="law">
                  <th>6</th>
                  <td colSpan={6}>
                    <b>{law.act}</b> ({law.status}){hit.map((r) => ` · ${r.name}: ${r.tags.join(", ")}`).join("")}
                    {law.warning && (
                      <span className="f95-leakwarn">
                        <b>#REF! {law.warning.text}.</b> {law.warning.daysText}.
                        <Btn className="f95-cellbtn" disabled={!law.warning.canBury} onClick={() => actions.buryLeak()}>
                          {law.warning.buryText}
                        </Btn>
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="f95-sheettabs" aria-hidden>
          <span className="on">Promises</span>
          <span>Votes</span>
          <span>Donations (hidden)</span>
        </div>
        {event && (
          <>
            <div className="f95-msgbody">
              <Ico name="chart" size={36} />
              <div>
                <h2>{event.title}</h2>
                <p>{event.body}</p>
              </div>
            </div>
            <Answers event={event} actions={actions} />
          </>
        )}
        <div className="f95-status">
          {tracker.status}
          {event ? ` · ${t("event.paused")}` : ""}
        </div>
      </Win>
    </div>
  );
}

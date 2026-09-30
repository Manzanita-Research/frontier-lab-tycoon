// The lab's home page: the header with the hit counter, Under Construction, My Goals, About Me, the guestbook and the
// Top Sites table. Everything is a table, a rule or a link, because it is 1998 and CSS is a rumour.
import { useEffect, useRef, useState } from "react";
import { ALL_VISIBLE, FactionChip, Odometer, money } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import type { StatsVM } from "../../ui/hud/types";
import { Gci, MoodFace, Mugshot, Spark, Worker } from "./icons";
import { Fake, New, Pop, Tick } from "./parts";

const MUSIC = { researcher: "GPU fans", agent: "the sound of tokens", visitor: "hold music", protester: "a drum circle" } as const;

/** "You are visitor # 000636": the park rating as a hit counter, with the usual tooltip of where the hits came from. */
function Counter({ vibes }: { vibes: StatsVM["vibes"] }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const root = useRef<HTMLDivElement>(null);
  const trend = vibes.trend;
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setHover(false);
        setPinned(false);
      }
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);
  const digits = String(Math.max(0, Math.round(vibes.value))).padStart(6, "0").split("");
  const first = Math.min(5, digits.findIndex((d) => d !== "0") === -1 ? 5 : digits.findIndex((d) => d !== "0"));
  return (
    <div className="gc-visitor" ref={root} onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}>
      <span>
        <span className="gc-you">You are </span>visitor #
      </span>
      <button type="button" className={`gc-counter trend-${trend}`} onClick={() => setPinned((p) => !p)} aria-expanded={open} aria-label={`Vibes ${vibes.value}, ${trend === "flat" ? "steady" : trend === "up" ? "rising" : "falling"}. Show where they come from`}>
        {digits.map((d, i) => (
          <span key={i} className={i >= first ? "hot" : ""} aria-hidden>
            {d}
          </span>
        ))}
      </button>
      <span className="gc-arrow">
        <span aria-hidden>←</span> that&apos;s our <b>Vibes</b>!
      </span>
      {trend === "up" && <New />}
      {trend === "down" && <New>OUCH!</New>}
      {open && (
        <Pop title={t("vibes.tipTitle")} className="gc-vtip" role="tooltip">
          <div className="gc-vhead">
            {vibes.value} of {vibes.max}
          </div>
          {vibes.rows.map((r) => (
            <div key={r.label} className="gc-vrow">
              <span className="gc-vl">
                {r.label} {r.note && <small>{r.note}</small>}
              </span>
              <span className="gc-vbar" aria-hidden>
                <i className={r.points < 0 ? "neg" : ""} style={{ width: `${Math.round(r.fill * 100)}%` }} />
              </span>
              <span className={`gc-vp ${r.points < 0 ? "bad" : ""}`}>
                {r.points > 0 ? "+" : ""}
                {r.points}
              </span>
            </div>
          ))}
          <div className="gc-vfoot">{t("vibes.tipFoot", { target: vibes.target })}</div>
        </Pop>
      )}
    </div>
  );
}

/** The header: "Welcome to {lab}'s Home Page!!!", the hit counter (Vibes), and a bordered table of the numbers. */
export function Stats({ stats, layout, visible = ALL_VISIBLE, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const coach = useCoach();
  const compact = layout.compact;
  const [more, setMore] = useState(false);
  const [signed, setSigned] = useState(false);
  const a = stats.arena;
  return (
    <header className={`gc-box gc-sky gc-hdr ${compact ? "compact" : ""} ${more ? "more" : ""}`}>
      <h1>
        <Spark /> Welcome to {stats.labName}&apos;s Home Page!!! <Spark />
      </h1>
      {visible.vibes && <Counter vibes={stats.vibes} />}
      <table className="gc-t gc-stats">
        <tbody>
          <tr>
            <td className="k">
              <Gci name="coin" />
              {t("stats.cash")}
            </td>
            <td className="v cash">
              <Odometer className={stats.cash.negative ? "bad" : ""} value={stats.cash.value} format={money} />
              {visible.revenue && <Odometer className={`net ${stats.net.good ? "good" : "bad"}`} value={stats.net.value} format={(n) => `(${n >= 0 ? "+" : "-"}${money(Math.abs(n))}/day)`} flash={false} />}
            </td>
            <td className="k" {...coach.attrs("stat:runway")}>
              <Gci name="hourglass" />
              {t("stats.runway")}
            </td>
            <td className={`v ${stats.runway.warning ? "warn" : ""}`}>
              <span className={stats.runway.warning ? "gc-hot-red" : ""}>
                {stats.runway.months === null ? "Infinite!!" : stats.runway.text}
                {stats.runway.warning ? "!!" : ""}
              </span>
            </td>
            {visible.vibes && (
              <>
                <td className="k more-1">
                  <Gci name="brain" />
                  {t("stats.capability")}
                </td>
                <td className="v more-1">
                  <Odometer value={stats.capability.value} />
                </td>
                <td className="k more-1">
                  <Gci name="megaphone" />
                  {t("stats.hype")}
                </td>
                <td className="v more-1">
                  <Odometer value={stats.hype.value} />
                </td>
              </>
            )}
            {compact && (visible.vibes || visible.arena) && (
              <td className="tog">
                <button type="button" className="gc-fb tog" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label={more ? t("stats.fewerStats") : t("stats.moreStats")}>
                  {more ? "−" : "+"}
                </button>
              </td>
            )}
          </tr>
          {(visible.arena || visible.rnd) && (
          <tr className="row2">
            <td className="k">
              <Gci name="trophy" />
              {t("stats.arena")}
            </td>
            <td className={`v ${a.top ? "top" : ""} ${a.flinch ? "flinch" : ""}`} colSpan={3}>
              <button type="button" className="gc-link" onClick={() => actions.toggleArena()} aria-expanded={a.open} aria-label={`You are number ${a.rank} on the Frontier Arena. Click to ${a.open ? "hide" : "show"} the leaderboard.`}>
                #{a.rank}
                {a.rankDelta === 0 ? "" : ` ${a.deltaText}`}
              </button>{" "}
              <small>{a.top ? t("stats.arenaTop") : t("stats.arenaOn")}</small>
            </td>
            <td className="k">
              <Gci name="chip" />
              {t("stats.rd")}
            </td>
            <td className="v" colSpan={3}>
              <Odometer value={stats.rd.mult} format={(n) => `${n.toFixed(1)}×`} /> <small>{t("stats.era", { n: stats.rd.era })}</small>
            </td>
          </tr>
          )}
        </tbody>
      </table>
      <div className="gc-foot">
        {stats.date} · last updated today ·{" "}
        <button type="button" className="gc-link v" onClick={() => setSigned(true)} disabled={signed}>
          {signed ? "Thanks for signing!!!" : "Sign my guestbook!"}
        </button>
      </div>
    </header>
  );
}

/** Under Construction: hazard tape, a worker digging, the model that is being trained and a bar of blue blocks. */
export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  const coach = useCoach();
  const pct = Math.floor(training.pct * 100);
  return (
    <section className="gc-uc" aria-label={t("training.title")} {...coach.attrs("training")}>
      <div className="gc-tape" aria-hidden />
      <h3>
        <Worker />
        Under Construction!
        {training.justShipped && <New>SHIPPED!</New>}
      </h3>
      {!training.hasHall ? (
        <div>{t("training.noHall")}</div>
      ) : (
        <>
          <div>
            <b>{training.name}</b> is being trained. <span className="dust">Pardon our dust!!</span>
          </div>
          <div className="gc-pbar" role="progressbar" aria-label={t("training.title")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="gc-small">
            {training.pctText} · {training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}
            {training.etaDays !== null && <span className="eta"> · {t("training.eta", { n: training.etaDays })}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/** "My Goals for Q1!!": the milestones as a bulleted list of links, with a DONE badge on the ones that came true. */
export function Objectives({ objectives, progress, visible = ALL_VISIBLE, layout }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const coach = useCoach();
  const goal = progress?.goal.line ? progress.goal : null;
  // Open on a tall desktop; on a laptop or a phone the construction site keeps to itself until you ask.
  const [open, setOpen] = useState(() => layout.tall && !layout.compact);
  // The goal to go for next gets the sticker.
  const next = objectives.items.find((g) => !g.met);
  if (goal && !visible.arena) {
    // One goal, until the race brings the milestones back.
    return (
      <section className="gc-goals" {...coach.attrs("goals")} role="status">
        <hr className="gc-rainbow" />
        <div className="gc-goalhead">
          <b>My Goal for Q1!!</b>
        </div>
        <ul>
          <li>
            <Fake visited={false}>{goal.text}</Fake> ({Math.min(goal.current, goal.target)}/{goal.target}) <New />
          </li>
        </ul>
      </section>
    );
  }
  return (
    <section className="gc-goals" {...(goal ? coach.attrs("goals") : {})}>
      <hr className="gc-rainbow" />
      <button type="button" className="gc-goalhead" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`gc-caret ${open ? "open" : ""}`} aria-hidden />
        <b>My Goals for Q1!!</b>
        <span className="gc-count">
          {objectives.done}/{objectives.total} done · <span className={objectives.urgent ? "gc-blink" : ""}>{objectives.daysLeft} {t("objectives.daysLeft")}</span>
        </span>
      </button>
      {open && (
        <>
          <ul>
            {objectives.items.map((g, i) => (
              <li key={g.id}>
                {g.met ? (
                  <>
                    <s>{g.label}</s> <Tick /> <New>DONE</New>
                  </>
                ) : (
                  <>
                    <Fake visited={i % 2 === 1}>{g.label}</Fake>
                    {g.progress && <> ({g.progress})</>}
                    {g.id === next?.id && <New />}
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className={`gc-small ${objectives.urgent ? "warn" : ""}`}>{t("objectives.by", { date: objectives.deadline })}</div>
        </>
      )}
    </section>
  );
}

/** About Me: the walker you tapped, as a home page of their own. */
export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const compact = layout.compact;
  const [more, setMore] = useState(false);
  const [signed, setSigned] = useState(false);
  const short = compact && !more;
  const worst = who.needs.length > 0 ? who.needs.reduce((a, b) => (b.urgency > a.urgency ? b : a)) : null;
  const needs = short && worst ? [worst] : who.needs;
  return (
    <aside className={`gc-box gc-sky gc-about ${compact ? "sheet" : ""} ${more ? "more" : ""}`} aria-label={`${who.name}, ${who.role}`}>
      <button type="button" className="gc-link gc-close" onClick={() => actions.closeInspector()} aria-label={t("inspector.close")}>
        [close]
      </button>
      <h2>
        ~*~ About Me ~*~
      </h2>
      <div className="gc-agrid">
        <Mugshot who={who.portrait} />
        <div>
          <b className="gc-name">{who.name}</b>
          <div>{who.role}</div>
          <div className="gc-lj">
            <div>
              current mood: <MoodFace mood={who.mood} /> {who.moodLabel}
            </div>
            <div>current music: {MUSIC[who.kind]}</div>
            {who.faction && (
              <div>
                current faction: <FactionChip faction={who.faction} className="gc-faction" />
              </div>
            )}
            {!short && <div>currently: {who.status}</div>}
          </div>
        </div>
      </div>
      {needs.length > 0 && (
        <div className="gc-meters">
          {needs.map((n) => (
            <div key={n.key} className="gc-meter">
              <span>{n.label}</span>
              <span className="m" role="progressbar" aria-label={n.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={n.pct}>
                <i className={n.tone} style={{ width: `${n.pct}%` }} />
              </span>
              <span className="p">{n.pct}%</span>
            </div>
          ))}
        </div>
      )}
      <div className="gc-gbook">
        Latest thought: <q>{who.thought}</q>
      </div>
      {!short && who.history.length > 0 && (
        <ul className="gc-hist">
          {who.history.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      <div className="gc-btns">
        <button type="button" className={`gc-fb ${who.following ? "on" : ""}`} onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
          {who.following ? "Following me!" : "Follow me!"}
        </button>
        <button type="button" className="gc-fb" onClick={() => setSigned(true)} disabled={signed}>
          {signed ? "Signed! Thanks!!" : "Sign my guestbook"}
        </button>
        {compact && (
          <button type="button" className="gc-fb" onClick={() => setMore((m) => !m)} aria-expanded={more}>
            {more ? "Less" : "More…"}
          </button>
        )}
      </div>
    </aside>
  );
}

/** The guestbook: what everybody is thinking out loud, counted. A click lights up who wrote it. */
export function ThoughtsPanel({ rows, layout, actions }: SlotPropsMap["ThoughtsPanel"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <section className={`gc-box gc-parch gc-book ${open ? "open" : ""}`} aria-label={t("thoughts.title")}>
      <button type="button" className="gc-bookhead" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Gci name="mail" size={20} />
        <span className="gc-link">View my {t("thoughts.title")}</span>
        <span className="gc-count">({total} entries)</span>
        <span className={`gc-caret ${open ? "open" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="gc-entries">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className={`gc-entry kind-${r.kind} ${r.highlighted ? "on" : ""}`} onClick={() => actions.highlight(r.key)} aria-pressed={r.highlighted}>
                <b>
                  {r.count > 1 ? `${r.count} ` : ""}
                  {r.noun} wrote:
                </b>
                <q>{r.text}</q>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Frontier Arena as a "Top Sites" table, with the AI R&D multiplier as the site's own stats. */
export function Arena({ arena, actions }: SlotPropsMap["Arena"]) {
  const t = useT();
  const rd = arena.rd;
  const rows = [...arena.rows].sort((a, b) => a.rank - b.rank);
  return (
    <section className={`gc-box gc-parch gc-arena ${arena.open ? "open" : ""} ${arena.alert ? "alert" : ""}`} aria-label={t("arena.title")}>
      <h4>
        <button type="button" className="gc-arenahead" onClick={() => actions.toggleArena()} aria-expanded={arena.open}>
          <Spark /> AI R&amp;D: <Odometer value={rd.mult} format={(n) => `${n.toFixed(1)}×`} /> <small className="faster">{t("arena.faster")}</small>
        </button>
      </h4>
      <div className="gc-era">
        <b>{t("arena.eraPill", { n: rd.era, name: rd.eraName })}</b>
        <span className="gc-pbar thin" aria-hidden>
          <i style={{ width: `${Math.round(rd.eraPct * 100)}%` }} />
        </span>
        <small>{rd.nextText}</small>
      </div>
      {rd.drop && <div className="gc-drop">{t("arena.drop", { days: rd.drop.daysLeft })}</div>}
      {arena.open && (
        <>
          <div className="gc-athead">
            <b>The Top Labs: Hot Sites!</b> <small>{arena.week === 0 ? t("arena.loading") : t("arena.week", { n: arena.week })}</small>
          </div>
          <table className="gc-t gc-hot">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("arena.colLab")}</th>
                <th>{t("arena.colScore")}</th>
                <th>{t("arena.colDelta")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`${row.you ? "you" : ""} ${row.moved ? `moved-${row.moved}` : ""}`} title={row.title}>
                  <td>{row.rank}</td>
                  <td className="name">
                    <i style={{ background: row.color }} aria-hidden />
                    {row.short}
                    {row.open && <small> (open)</small>}
                  </td>
                  <td>{row.score}</td>
                  <td className={row.delta > 0 ? "good" : row.delta < 0 ? "bad" : ""}>{row.deltaText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

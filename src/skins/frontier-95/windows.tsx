// Frontier 95's windows: Lab Properties, the copy dialog, sticky notes, Properties of a walker, Task Mangler, Thoughts.txt.
import { useState } from "react";
import { ALL_VISIBLE, Odometer, money, useAutoPause, useSlots } from "../kit";
import { useCoach, useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Ico, PixelPortrait } from "./icons";
import { Blocks, Btn, Field, Sticker, Tabs, Win } from "./parts";
import { useStackWindow } from "./stack";

type StatsTab = "general" | "finance" | "arena" | "vibes";

/** "Lab Properties": tabs, a Minesweeper-style LED for Vibes, inset fields and a blocky Hype bar. */
export function Stats({ stats, layout, visible = ALL_VISIBLE, actions }: SlotPropsMap["Stats"]) {
  const t = useT();
  const coach = useCoach();
  const [tab, setTab] = useState<StatsTab>("general");
  const [collapsed, setCollapsed] = useState(layout.compact);
  useAutoPause(actions, "stats", layout.compact && !collapsed);
  const title = t("stats.window", { lab: stats.labName });
  const trend = { up: "▲", down: "▼", flat: "" }[stats.vibes.trend];
  const tabs: { id: StatsTab; label: string }[] = [
    { id: "general", label: t("stats.tab.general") },
    ...(visible.revenue ? [{ id: "finance" as const, label: t("stats.tab.finance") }] : []),
    ...(visible.arena || visible.rnd ? [{ id: "arena" as const, label: t("stats.tab.arena") }] : []),
    ...(visible.vibes ? [{ id: "vibes" as const, label: t("stats.tab.vibes") }] : []),
  ];
  const led = (
    <span className="f95-led" aria-label={`${t("stats.vibes")} ${stats.vibes.value}`}>
      <Odometer value={stats.vibes.value} format={(n) => String(Math.max(0, Math.round(n))).padStart(3, "0")} flash={false} />
    </span>
  );

  if (collapsed) {
    // A single title-bar-height strip (always on a phone until tapped): Vibes, cash and runway at a glance.
    return (
      <section className="f95-win f95-lab collapsed" aria-label={title}>
        <button type="button" className="f95-tb f95-strip" onClick={() => setCollapsed(false)} aria-expanded={false} aria-label={`${title}. ${t("stats.vibes")} ${stats.vibes.value}, ${t("stats.cash")} ${stats.cash.text}, ${t("stats.runway")} ${stats.runway.text}. Tap to open.`}>
          <Ico name="hall" size={18} />
          <span className="f95-tt">
            {visible.vibes && (
              <>
                <b className="f95-strip-led">{String(stats.vibes.value).padStart(3, "0")}</b> {trend} ·{" "}
              </>
            )}
            {stats.cash.text} · <span className={stats.runway.warning ? "warn" : ""}>{stats.runway.text}</span>
          </span>
          <span className="f95-b" data-g="max" aria-hidden>
            <span className="f95-glyph" />
          </span>
        </button>
      </section>
    );
  }

  return (
    <Win
      className={`f95-lab ${layout.compact ? "sheet" : ""}`}
      title={title}
      icon="hall"
      buttons={[
        { g: "min", label: "Minimize", onClick: () => setCollapsed(true) },
        { g: "max", label: "Maximize", onClick: () => setCollapsed(true) },
        { g: "close", label: "Close", onClick: () => setCollapsed(true) },
      ]}
    >
      {/* Only what the lab has earned: at level 1 there are no tabs at all, just cash, runway and the date. */}
      {tabs.length > 1 && <Tabs label="Lab Properties" active={tab} onChange={setTab} tabs={tabs} />}
      <div className="f95-page" role="tabpanel">
        {tab === "general" && (
          <div className="f95-statrow">
            {visible.vibes && (
              <Field label={t("stats.vibes")} sub={<>{trend} {stats.date}</>}>
                {led}
              </Field>
            )}
            <Field label={t("stats.cash")} sub={visible.revenue ? <span className={stats.net.good ? "" : "bad"}>{stats.net.good ? "▲" : "▼"} {stats.net.text}</span> : undefined}>
              <Odometer className={`f95-v inset ${stats.cash.negative ? "bad" : ""}`} value={stats.cash.value} format={money} />
            </Field>
            <span {...coach.attrs("stat:runway")} className="f95-coachwrap">
              <Field label={t("stats.runway")} sub={stats.runway.warning ? "⚠ Low" : "OK"} warn={stats.runway.warning}>
                <span className={`f95-v inset ${stats.runway.warning ? "bad" : ""}`}>{stats.runway.text}</span>
              </Field>
            </span>
            {!visible.vibes && (
              <Field label="Date">
                <span className="f95-v inset">{stats.date}</span>
              </Field>
            )}
            {visible.vibes && (
              <>
                <Field label={t("stats.capability")} sub={stats.capability.latestModel ?? "No model yet"}>
                  <Odometer className="f95-v inset" value={stats.capability.value} />
                </Field>
                <Field label={t("stats.hype")} sub={`${Math.round(stats.hype.value)} / 100`}>
                  <Blocks value={stats.hype.value / 100} label={t("stats.hype")} />
                </Field>
              </>
            )}
          </div>
        )}
        {tab === "finance" && (
          <dl className="f95-facts">
            <dt>Income</dt>
            <dd className="inset">{stats.finance.incomeText}/day</dd>
            <dt>Expenses</dt>
            <dd className="inset">{stats.finance.expensesText}/day</dd>
            <dt>Net</dt>
            <dd className={`inset ${stats.net.good ? "" : "bad"}`}>{stats.net.text}</dd>
            <dt>{t("stats.cash")}</dt>
            <dd className={`inset ${stats.cash.negative ? "bad" : ""}`}>{stats.cash.text}</dd>
            <dt>{t("stats.runway")}</dt>
            <dd className={`inset ${stats.runway.warning ? "bad" : ""}`}>{stats.runway.text}</dd>
          </dl>
        )}
        {tab === "arena" && (
          <dl className="f95-facts">
            <dt>{t("stats.arena")}</dt>
            <dd className="inset">
              #{stats.arena.rank} {stats.arena.rankDelta === 0 ? "" : stats.arena.deltaText} {stats.arena.top ? "· on top. for now" : ""}
            </dd>
            <dt>{t("stats.rd")}</dt>
            <dd className="inset">{stats.rd.multText}</dd>
            <dt>Era</dt>
            <dd className="inset">{stats.rd.era}</dd>
            <dt />
            <dd>
              <Btn onClick={() => actions.toggleArena()}>{stats.arena.open ? "Hide Task Mangler" : "Show Task Mangler"}</Btn>
            </dd>
          </dl>
        )}
        {tab === "vibes" && (
          <div className="f95-vibes">
            <p className="f95-hint">
              {t("vibes.tipTitle")}: {stats.vibes.value} of {stats.vibes.max}
            </p>
            {stats.vibes.rows.map((r) => (
              <div key={r.label} className="f95-vrow">
                <span>
                  {r.label} {r.note && <small>{r.note}</small>}
                </span>
                <Blocks value={r.fill} label={r.label} tone={r.points < 0 ? "red" : "navy"} />
                <b className={r.points < 0 ? "bad" : ""}>{r.points > 0 ? "+" : ""}{r.points}</b>
              </div>
            ))}
            <p className="f95-hint">{t("vibes.tipFoot", { target: stats.vibes.target })}</p>
          </div>
        )}
      </div>
      {visible.vibes && stats.vibes.value > 600 && <Sticker kind="star">SUPER<br />VIBES</Sticker>}
    </Win>
  );
}

/** The file-copy dialog: "Copying the internet into Frontier-3…", with a Cancel that never quite works. */
export function Training({ training }: SlotPropsMap["Training"]) {
  const t = useT();
  const coach = useCoach();
  const eta = training.etaDays === null ? "estimating time remaining…" : t("training.eta", { n: training.etaDays });
  return (
    <Win className="f95-copy" attrs={coach.attrs("training")} title={training.hasHall ? t("training.window", { name: training.name }) : "Nothing to copy"} icon="doc" buttons={[{ g: "close", label: "Close", disabled: true }]}>
      <div className="f95-copybody">
        {training.hasHall ? (
          <>
            <div className="f95-anim" aria-hidden>
              <Ico name="cluster" size={26} />
              <span className="f95-dots" />
              <Ico name="doc" size={22} />
              <Ico name="doc" size={22} />
              <span className="f95-dots" />
              <Ico name="hall" size={26} />
            </div>
            <div className="f95-copying">{t("training.copying", { name: training.name })}</div>
            <Blocks value={training.pct} label={training.name} />
            <div className="f95-copyfoot">
              <span>
                {training.pctText} · {eta}
              </span>
              <Btn disabled className="cancel">
                {t("training.cancel")}
              </Btn>
            </div>
            <div className="f95-hint">{training.computePerDay > 0 ? t("training.compute", { n: training.computePerDay }) : t("training.noCompute")}</div>
          </>
        ) : (
          <div className="f95-msg">
            <Ico name="warn" size={32} />
            <span>{t("training.noHall")}</span>
          </div>
        )}
      </div>
      {training.justShipped && <Sticker kind="burst">{t("training.shipped")}</Sticker>}
    </Win>
  );
}

/** Desktop sticky notes: flat yellow, 1px border. */
export function Objectives({ objectives, progress, visible = ALL_VISIBLE, layout, actions }: SlotPropsMap["Objectives"]) {
  const t = useT();
  const coach = useCoach();
  const goal = progress?.goal.line ? progress.goal : null;
  // The goal in front of you is one sticky note; the scenario checklist waits for the race.
  const list = !goal || visible.arena;
  const [open, setOpen] = useState(() => !layout.compact);
  useAutoPause(actions, "objectives", list && layout.compact && open);
  return (
    <div className="f95-notes">
      {goal && (
        <div className="f95-post goal" {...coach.attrs("goals")} role="status">
          <small>{t("objectives.goal")}</small>
          <b>{goal.line}</b>
          <span className="f95-goalbar" aria-hidden>
            <i style={{ width: `${goal.ratio * 100}%` }} />
          </span>
        </div>
      )}
      {list && (
      <>
      <button type="button" className="f95-post head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>{t("objectives.title")}</b>
        <span className="cnt">
          {objectives.done}/{objectives.total}
        </span>
        <small className={objectives.urgent ? "bad" : ""}>
          {objectives.daysLeft} {t("objectives.daysLeft")}
        </small>
      </button>
      {open && (
        <ul>
          {objectives.items.map((g, i) => (
            <li key={g.id} className={`f95-post ${g.met ? "done" : ""}`} style={{ transform: `rotate(${[-1, 1, -0.5][i % 3]}deg)` }}>
              <span className="f95-check" aria-hidden />
              <span>
                {g.label}
                {g.progress && <small>{g.progress}</small>}
              </span>
            </li>
          ))}
          <li className="f95-post foot">{t("objectives.by", { date: objectives.deadline })}</li>
        </ul>
      )}
      </>
      )}
    </div>
  );
}

/** "Properties of Dr. Ada Gradient": the laminated ID badge, blocky need bars, the thought in a read-only box. */
export function Inspector({ inspector: who, layout, actions }: SlotPropsMap["Inspector"]) {
  const t = useT();
  const [tab, setTab] = useState<"general" | "history">("general");
  // On the desktop it can fold to its title bar (and does, when it is the oldest window and the column is full).
  const [folded, setFolded] = useState(false);
  useStackWindow("inspector", folded, setFolded);
  const fold = !layout.compact;
  return (
    <Win
      className="f95-props"
      title={t("inspector.title", { name: who.name })}
      icon="info"
      buttons={[
        ...(fold ? [{ g: "min" as const, label: folded ? "Restore" : "Minimize", onClick: () => setFolded(!folded) }] : []),
        { g: "help", label: "Help" },
        { g: "close", label: t("inspector.close"), onClick: () => actions.closeInspector() },
      ]}
      onTitleClick={fold && folded ? () => setFolded(false) : undefined}
      role="dialog"
      label={`${who.name}, ${who.role}`}
    >
      {!(fold && folded) && (
        <>
          <Tabs label="Properties" active={tab} onChange={setTab} tabs={[{ id: "general", label: "General" }, { id: "history", label: "History" }]} />
          <div className="f95-page" role="tabpanel">
            {tab === "general" ? (
              <>
                <div className="f95-badge">
                  <div className="hd">
                    <span>{who.lab.toUpperCase()}</span>
                    <span>{who.kind === "researcher" ? "ALL-HANDS ACCESS" : who.kind === "visitor" ? "VISITOR" : who.kind === "agent" ? "AGENT ACCESS" : "OUTSIDE THE GATE"}</span>
                  </div>
                  <div className="bd">
                    <PixelPortrait kind={who.portrait.kind} body={who.portrait.body} head={who.portrait.head} happiness={who.portrait.happiness} drift={who.portrait.drift} />
                    <div>
                      <h3>{who.name}</h3>
                      <div className="r">{who.role}</div>
                      <div className="r">
                        Badge #{who.badge} · {who.kindLabel} · {who.moodLabel}
                      </div>
                      <div className="bar" aria-hidden />
                    </div>
                  </div>
                  <span className="holo" aria-hidden />
                </div>
                <div className="f95-status">{who.status}</div>
                {who.needs.map((n) => (
                  <div key={n.key} className="f95-need">
                    <span>{n.label}</span>
                    <Blocks value={n.value} label={n.label} tone={n.tone === "bad" ? "red" : "navy"} />
                    <span>{n.pct}%</span>
                  </div>
                ))}
                <div className="f95-think inset" aria-label={t("inspector.thinking")}>
                  “{who.thought}”
                </div>
              </>
            ) : (
              <ul className="f95-history inset">
                {who.history.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <div className="f95-row">
              <Btn def onClick={() => actions.follow(who.id, !who.following)} aria-pressed={who.following}>
                {who.following ? `${t("inspector.follow")} ✓` : t("inspector.follow")}
              </Btn>
              <Btn onClick={() => actions.closeInspector()}>{t("inspector.ok")}</Btn>
              <Btn onClick={() => actions.closeInspector()}>Cancel</Btn>
            </div>
          </div>
        </>
      )}
    </Win>
  );
}

/** "Task Mangler": the Frontier Arena as a process list (Lab, Model, Score, Δ), with the R&D multiplier as the performance line. */
export function Arena({ arena, leapfrog, layout, actions }: SlotPropsMap["Arena"]) {
  const t = useT();
  const { Benchmarks } = useSlots();
  const rd = arena.rd;
  useStackWindow("arena", !arena.open, (minimised) => {
    if (minimised === arena.open) actions.toggleArena();
  });
  const bench = leapfrog.enabled;
  // With Release Leapfrog on, the leaderboard is the live part of the race: it opens first, and the tab lights up on a launch.
  const [tab, setTab] = useState<"perf" | "bench">("bench");
  const onBench = bench && tab === "bench" && arena.open;
  const launched = leapfrog.rows.some((r) => r.flash);
  return (
    <Win
      className={`f95-tasks ${arena.open ? "open" : ""} ${arena.alert ? "alert" : ""} ${onBench ? "wide" : ""} ${launched ? "launched" : ""}`}
      title={
        <>
          Task Mangler<span className="f95-long"> — {onBench ? t("bench.title") : t("arena.title")}</span>
        </>
      }
      label="Task Mangler"
      icon="chart"
      onTitleClick={() => actions.toggleArena()}
      buttons={[{ g: "min", label: arena.open ? "Minimize" : "Restore", onClick: () => actions.toggleArena() }]}
    >
      <div className="f95-perf">
        <span>
          {t("stats.rd")} <b>{rd.multText}</b>
        </span>
        <span className="f95-era">{t("arena.eraPill", { n: rd.era, name: rd.eraName })}</span>
        <Blocks value={rd.eraPct} label={rd.nextText} />
        <small>{rd.nextText}</small>
      </div>
      {arena.open && bench && (
        <Tabs
          label="Task Mangler"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "perf", label: t("stats.tab.arena") },
            { id: "bench", label: launched ? `${t("bench.tab")} •` : t("bench.tab") },
          ]}
        />
      )}
      {onBench && <Benchmarks leapfrog={leapfrog} layout={layout} actions={actions} />}
      {arena.open && !onBench && (
        <div className="f95-listwrap inset" role="table" aria-label={t("arena.title")}>
          <div className="f95-lhead" role="row">
            <span role="columnheader">{t("arena.colLab")}</span>
            <span role="columnheader">{t("arena.colModel")}</span>
            <span role="columnheader">{t("arena.colScore")}</span>
            <span role="columnheader">{t("arena.colDelta")}</span>
          </div>
          {arena.rows.map((r) => (
            <div key={r.id} className={`f95-lrow ${r.you ? "you" : ""} ${r.moved ? `moved-${r.moved}` : ""}`} role="row" title={r.title}>
              <span role="cell">
                {r.rank}. {r.short}
                {r.open && <em> (open)</em>}
              </span>
              <span role="cell">{r.model ?? "—"}</span>
              <span role="cell">{r.score}</span>
              <span role="cell" className={r.delta > 0 ? "up" : r.delta < 0 ? "down" : ""}>
                {r.deltaText || "–"}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="f95-status">{rd.drop ? t("arena.drop", { days: rd.drop.daysLeft }) : arena.week === 0 ? t("arena.loading") : t("arena.week", { n: arena.week })}</div>
    </Win>
  );
}

/** "Thoughts.txt": everybody's thought, counted. Click a line to light up who thinks it. */
export function ThoughtsPanel({ rows, layout, actions }: SlotPropsMap["ThoughtsPanel"]) {
  const t = useT();
  const [open, setOpen] = useState(() => !layout.compact);
  useAutoPause(actions, "thoughts", layout.compact && open);
  useStackWindow("thoughts", !open, (minimised) => setOpen(!minimised));
  return (
    <Win className={`f95-thoughts ${open ? "open" : ""}`} title={`${t("thoughts.title")}.txt`} icon="doc" onTitleClick={() => setOpen(!open)} buttons={[{ g: "min", label: open ? "Minimize" : "Restore", onClick: () => setOpen(!open) }]}>
      {open && (
        <ul className="f95-thoughtlist inset">
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className={r.highlighted ? "on" : ""} onClick={() => actions.highlight(r.key)} aria-pressed={r.highlighted}>
                <b>{r.count}</b> {r.noun}: “{r.text}”
              </button>
            </li>
          ))}
        </ul>
      )}
    </Win>
  );
}

/** "Staff Manager": hire and fire, and paint patrol zones. Opens from Start ▸ Staff. */
export function Staff({ staff, actions }: SlotPropsMap["Staff"]) {
  const t = useT();
  const [tab, setTab] = useState<"hire" | "roster">("hire");
  const [folded, setFolded] = useState(false);
  useStackWindow("staff", folded, setFolded);
  if (staff.painting) {
    const p = staff.painting;
    return (
      <Win className="f95-staff painting" title="Patrol zone" icon="staff" buttons={[{ g: "close", label: "Done", onClick: () => actions.paintZone(null) }]}>
        <div className="f95-page">
          <p className="f95-paintmsg">
            <b>{p.name}</b> · drag on the map to paint their patrol zone; drag from a painted tile to erase. {p.zone > 0 ? `${p.zone} tiles.` : "Empty means the whole campus."}
          </p>
          <div className="f95-row">
            {p.zone > 0 && <Btn onClick={() => actions.clearZone(p.id)}>Clear</Btn>}
            <Btn def onClick={() => actions.paintZone(null)}>
              Done
            </Btn>
          </div>
        </div>
      </Win>
    );
  }
  return (
    <Win
      className="f95-staff"
      title="Staff Manager"
      icon="staff"
      buttons={[
        { g: "min", label: folded ? "Restore" : "Minimize", onClick: () => setFolded(!folded) },
        { g: "close", label: t("inspector.close"), onClick: () => actions.closeStaff() },
      ]}
      onTitleClick={folded ? () => setFolded(false) : undefined}
    >
      {!folded && (
        <>
          <Tabs
            label="Staff"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "hire", label: "Hire" },
              { id: "roster", label: `Roster (${staff.count})` },
            ]}
          />
          <div className="f95-page" role="tabpanel">
            {tab === "hire" ? (
              <ul className="f95-hire inset">
                {staff.jobs.map((j) => (
                  <li key={j.job}>
                    <i className="swatch" style={{ background: j.color }} aria-hidden />
                    <span>
                      <b>{j.title}</b> <small>{j.salaryText}</small>
                      <small className="blurb">{j.blurb}</small>
                    </span>
                    <Btn disabled={!j.canHire} title={j.reason} onClick={() => actions.hire(j.job)}>
                      {t("staff.hire")}
                      {j.count > 0 ? ` (${j.count})` : ""}
                    </Btn>
                  </li>
                ))}
              </ul>
            ) : staff.roster.length === 0 ? (
              <p className="f95-hint">Nobody on the payroll yet. Hire someone on the other tab.</p>
            ) : (
              <ul className="f95-hire inset">
                {staff.roster.map((s) => (
                  <li key={s.id} className={s.leaving ? "leaving" : ""}>
                    <i className="swatch" style={{ background: s.color }} aria-hidden />
                    <span>
                      <b>{s.name}</b> <small>{s.title}</small>
                      <small className="blurb">
                        {s.status} · {s.zone > 0 ? `zone: ${s.zone} tiles` : "whole campus"}
                      </small>
                    </span>
                    <span className="f95-pair">
                      <Btn disabled={s.leaving} onClick={() => actions.paintZone(s.id)} title="Paint a patrol zone on the map">
                        {t("staff.zone")}
                      </Btn>
                      <Btn disabled={s.leaving} onClick={() => actions.fire(s.id)}>
                        {t("staff.fire")}
                      </Btn>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="f95-status">
            {staff.payrollText} · {staff.slopPct}% slop{staff.broken > 0 ? ` · ${staff.broken} out of order` : ""}
          </div>
        </>
      )}
    </Win>
  );
}

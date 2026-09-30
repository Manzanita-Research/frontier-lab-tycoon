// Frontier 95's Release Leapfrog: the Benchmarks tab in Task Mangler, the "Network Traffic" window (and its tray icon),
// the forced-response gauges and the launch livestream that "has stopped responding".
import { useState } from "react";
import { BenchTable, VoiceGraph } from "../kit";
import { useT } from "../context";
import type { ResponseVM, StreamVM } from "../../ui/hud/types";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Blocks, Btn, Win } from "./parts";

/** The leaderboard itself, as Task Mangler's Benchmarks tab shows it: a sunken list with a status bar under it. */
export function Benchmarks({ leapfrog }: SlotPropsMap["Benchmarks"]) {
  const t = useT();
  return (
    <div className="f95-bench">
      <div className="f95-benchwrap inset">
        <BenchTable leapfrog={leapfrog} />
      </div>
      <div className="f95-status">
        {leapfrog.drop ? `${leapfrog.drop.text}. ` : ""}
        {leapfrog.nextText || t("bench.empty")}
      </div>
    </div>
  );
}

/**
 * The share-of-voice meter: a tray icon (its two lights blink on every launch) and a "Network Traffic" window, the news
 * cycle drawn as the line graph a 1995 dial-up monitor would. Open on a desktop, folded on a phone (tap the icon).
 */
export function Voice({ leapfrog, layout }: SlotPropsMap["Voice"]) {
  const t = useT();
  const [open, setOpen] = useState(!layout.compact && layout.tall);
  const { voice } = leapfrog;
  const arrow = { up: "▲", down: "▼", flat: "" }[voice.trend];
  return (
    <>
      <button type="button" className={`f95-s net ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-pressed={open} aria-label={`${t("voice.title")}: ${voice.headline}`} title={`Network Traffic: ${t("voice.you")} ${voice.yoursText} of the news cycle`}>
        <Ico name="net" size={18} />
        <i className="f95-tx" key={leapfrog.pulse} aria-hidden />
      </button>
      {open && (
        <Win
          className={`f95-net ${voice.youOwn ? "owned" : ""}`}
          title="Network Traffic"
          icon="net"
          label={t("voice.title")}
          buttons={[
            { g: "min", label: "Minimize", onClick: () => setOpen(false) },
            { g: "close", label: "Close", onClick: () => setOpen(false) },
          ]}
        >
          <div className="f95-netmenu" aria-hidden>
            <span>File</span>
            <span>View</span>
            <span>Help</span>
          </div>
          <div className="f95-netgraph inset">
            <VoiceGraph voice={voice} width={288} height={104} className="f95-vg" />
            <span className="f95-netlabel" aria-hidden>
              {t("voice.graph")}
            </span>
          </div>
          <ul className="f95-netkey">
            {voice.shares.slice(0, 4).map((s) => (
              <li key={s.id} className={s.you ? "you" : ""}>
                <i style={{ background: s.color }} aria-hidden />
                <span>{s.you ? t("voice.you") : s.short}</span>
                <b>{s.pctText}</b>
                {s.you && arrow && <em className={voice.trend}>{arrow}</em>}
              </li>
            ))}
          </ul>
          <div className="f95-status">
            {voice.headline}
            {voice.streak > 1 ? ` (${voice.streak} days)` : ""}
          </div>
        </Win>
      )}
    </>
  );
}

/** The three numbers behind "Ship now at 94% ready": how baked the run is, what shipping adds, and the odds of a launch bug. */
export function Gauges({ response }: { response: ResponseVM }) {
  const t = useT();
  return (
    <div className="f95-gauges" aria-label={`${response.rival} launched ${response.rivalModel}`}>
      <div className="f95-gauge wide">
        <span>{t("response.ready")}</span>
        <b className="f95-led lg">{response.readyText}</b>
        <Blocks value={response.ready} label={t("response.ready")} />
      </div>
      <div className="f95-gauge">
        <span>{t("response.ship")}</span>
        <b className="f95-led">{response.shipText}</b>
        <small>
          {t("response.full")} {response.holdText}
        </small>
      </div>
      <div className={`f95-gauge ${response.bug >= 0.3 ? "risky" : ""}`}>
        <span>{t("response.bug")}</span>
        <b className="f95-led">{response.bugText}</b>
        <small>{response.rivalModel}</small>
      </div>
    </div>
  );
}

/** A 24×14 pixel golden retriever, walking on. */
function Dog() {
  return (
    <svg className="f95-dog" viewBox="0 0 24 14" shapeRendering="crispEdges" aria-hidden>
      <g className="tail">
        <rect x="1" y="3" width="4" height="2" fill="#e0a030" />
        <rect x="0" y="2" width="2" height="2" fill="#f0c060" />
      </g>
      <rect x="4" y="5" width="13" height="5" fill="#e0a030" />
      <rect x="5" y="9" width="11" height="1" fill="#c88820" />
      <rect x="16" y="2" width="6" height="5" fill="#e8b040" />
      <rect x="16" y="2" width="2" height="4" fill="#b87820" />
      <rect x="21" y="4" width="3" height="3" fill="#f0c060" />
      <rect x="23" y="4" width="1" height="1" fill="#000" />
      <rect x="19" y="3" width="1" height="1" fill="#000" />
      <rect x="21" y="7" width="2" height="2" fill="#ff6080" />
      <g className="legs">
        <rect x="5" y="10" width="2" height="4" fill="#c88820" />
        <rect x="9" y="10" width="2" height="4" fill="#e0a030" />
        <rect x="13" y="10" width="2" height="4" fill="#c88820" />
        <rect x="16" y="10" width="2" height="4" fill="#e0a030" />
      </g>
    </svg>
  );
}

/** What is on the projector when it goes wrong: the dog, last quarter's chart, a spinner, or just no signal. */
function Scene({ mishap }: { mishap: string }) {
  if (mishap === "dog") return <Dog />;
  if (mishap === "wrongChart") {
    return (
      <svg className="f95-chartpic" viewBox="0 0 60 36" shapeRendering="crispEdges" aria-hidden>
        <rect width="60" height="36" fill="#fff" />
        <rect x="6" y="14" width="9" height="20" fill="#0000c0" />
        <rect x="20" y="20" width="9" height="14" fill="#0000c0" />
        <rect x="34" y="6" width="9" height="28" fill="#00a000" />
        <rect x="48" y="24" width="9" height="10" fill="#0000c0" />
        <path d="M3 34h56M3 2v32" stroke="#000" />
      </svg>
    );
  }
  if (mishap === "frozen") {
    return (
      <span className="f95-spin" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }
  return <Ico name="error" size={28} />;
}

/** Launch livestream: a media player with the mishap in an error box on the screen, chat beside it, and three ways to spin it. */
export function Livestream({ event, stream, actions }: SlotPropsMap["Livestream"]) {
  const t = useT();
  return (
    <div className="f95-layer f95-dim">
      <Win className="f95-msgbox f95-stream" title={<>Frontier Media Player: {stream.model}-launch.avi</>} icon="demo" role="alertdialog" label={event.title}>
        <StreamPlayer stream={stream} />
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
        <div className="f95-status">{t("event.paused")}</div>
      </Win>
    </div>
  );
}

function StreamPlayer({ stream }: { stream: StreamVM }) {
  const t = useT();
  return (
    <div className="f95-player">
      <div className="f95-screen">
        <span className="f95-onair">● {t("stream.live")}</span>
        <span className="f95-viewers">{t("stream.watching", { n: stream.viewersText })}</span>
        <Scene mishap={stream.mishap} />
        <Win className="f95-errbox" title={<>Demo.exe</>} icon="error" role="alert" label={stream.caption} buttons={[{ g: "close", label: "Close" }]}>
          <div className="f95-errbody">
            <Ico name="error" size={32} />
            <p>{stream.caption}</p>
          </div>
          <div className="f95-row">
            <Btn def disabled>
              End Task
            </Btn>
          </div>
        </Win>
      </div>
      <ul className="f95-chat inset" aria-label={t("stream.chat")}>
        {stream.chat.slice(-6).map((c) => (
          <li key={c.who + c.text}>
            <b>{c.who}</b> {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

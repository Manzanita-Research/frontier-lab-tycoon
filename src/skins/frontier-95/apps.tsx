// The "applications": the browser that shows the paper, the chat client, the News Room folder, Volume Control,
// the paint program behind photo mode, and Display Properties (the skin picker).
import { useEffect, useRef, useState } from "react";
import { Dialog } from "../kit";
import { useT } from "../context";
import type { SlotPropsMap } from "../types";
import { Ico } from "./icons";
import { Btn, Tabs, Win } from "./parts";
import { EXAMPLE_MOD } from "../base/slots/ModManager";
import { dramaComing } from "../base/slots/Drama";
import type { DramaPackVM } from "../../ui/hud/types";

/** The weekly paper, in a 1996 browser. */
export function FrontPage({ paper, actions }: SlotPropsMap["FrontPage"]) {
  return (
    <Win
      className="f95-ie"
      title="The Frontier Times — Internet Exploder 3.0"
      icon="globe"
      buttons={[
        { g: "min", label: "Back to the archive", onClick: () => actions.viewNews("archive") },
        { g: "close", label: "Close", onClick: () => actions.closeNews() },
      ]}
    >
      <div className="f95-menubar" aria-hidden>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Go</span>
        <span>Favorites</span>
        <span>Help</span>
      </div>
      <div className="f95-toolbar">
        <Btn onClick={() => actions.viewNews("archive")}>Back</Btn>
        <Btn disabled>Forward</Btn>
        <Btn disabled>Stop</Btn>
        <Btn disabled>Refresh</Btn>
        <Btn disabled>Home</Btn>
        <span className="f95-address inset">
          <small>Address:</small> http://www.frontier-times.example/week-{paper.week}
        </span>
      </div>
      <article className="f95-paper inset">
        <div className="eyebrow">
          <span>Independent. Mostly.</span>
          <span>WEEK {paper.week}</span>
          <span>2 tokens</span>
        </div>
        <h1>The Frontier Times</h1>
        <div className="eyebrow">
          <span>{paper.range}</span>
          <span>All the news that's fit to prompt</span>
        </div>
        <hr />
        <div className="lead">
          <div>
            <span className="sec">{paper.leadKind}</span>
            <h2>{paper.lead}</h2>
            <p>A week at {paper.lab}. Everyone has a take. The compute cluster has a hum.</p>
            <small>By our extremely online correspondent</small>
          </div>
          <figure>
            {paper.photo ? <img src={paper.photo} alt={`The current campus camera view at ${paper.lab}`} /> : <div className="nophoto">Our photographer is experiencing a context window.</div>}
            <figcaption>{paper.caption}</figcaption>
          </figure>
        </div>
        <hr />
        <div className="subs">
          {paper.substories.map((s) => (
            <section key={s.id}>
              <span className="sec">{s.label}</span>
              <h3>{s.text}</h3>
              <p>{s.filler ? "Our editorial desk is monitoring the situation, mostly from the kombucha queue." : "Campus sources confirm the situation remains a situation. More as the discourse develops."}</p>
            </section>
          ))}
        </div>
        <hr />
        <div className="bottom">
          <section>
            <span className="sec">Classifieds · No refunds</span>
            <p>{paper.classified}</p>
          </section>
          <section>
            <span className="sec">Rival watch · Fictional sentiment index</span>
            {paper.stocks.map((s) => (
              <div key={s.name} className="stock">
                <b>{s.name}</b>
                <span>{s.price}</span>
                <em className={s.change >= 0 ? "up" : "down"}>
                  {s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change)}%
                </em>
              </div>
            ))}
          </section>
        </div>
        <footer>Printed on 100% recycled discourse. Please supervise this newspaper.</footer>
      </article>
      <div className="f95-status">Done</div>
    </Win>
  );
}

/** The monthly recap as a chat client ("Uh oh!"). */
export function GroupChat({ chat, actions }: SlotPropsMap["GroupChat"]) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = chat.messages.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [count]);
  return (
    <Win
      className="f95-icu"
      title="ICU — what just happened in AI"
      icon="chat"
      buttons={[
        { g: "min", label: "Back to the archive", onClick: () => actions.viewNews("archive") },
        { g: "close", label: "Close", onClick: () => actions.closeNews() },
      ]}
    >
      <div className="f95-uhoh">
        <Ico name="chat" size={20} />
        <b>Uh oh!</b> <span>{chat.done ? "Everyone has said their piece." : "New messages from Nell, Ash, Zip and Mom."}</span>
      </div>
      <div className="f95-chatlog inset" aria-live="polite" aria-relevant="additions">
        <p className="sys">
          {chat.range} · <b>{chat.topic}</b> (shared from {chat.lab})
        </p>
        {chat.messages.map((m, i) => (
          <p key={i} className={`friend-${m.friend}`}>
            <b>{m.name}</b> <small>({m.subtitle})</small>: {m.text}
          </p>
        ))}
        {chat.typing && (
          <p className="sys typing">
            {chat.typing.name} is typing<span className="f95-dots">...</span>
          </p>
        )}
        <div ref={bottom} />
      </div>
      <div className="f95-chatfoot">
        <span className="inset f95-input">Replies disabled. You're busy running a lab.</span>
        {chat.done ? <Btn disabled>Send</Btn> : <Btn def onClick={() => actions.revealChat()}>Read all</Btn>}
      </div>
      <div className="f95-status">{chat.done ? "Seen by everyone. Understood by no one." : `${count} of ${chat.total} messages`}</div>
    </Win>
  );
}

/** The whole News Room: a folder of editions, and whichever one is open. The game is paused meanwhile. */
export function NewsRoom({ newsroom, actions }: SlotPropsMap["NewsRoom"]) {
  const t = useT();
  const { view } = newsroom;
  if (!view) return null;
  return (
    <Dialog label={view === "archive" ? "News Room archive" : view === "paper" ? "The Frontier Times" : "Monthly group chat"} close={actions.closeNews} layerClass="f95-layer f95-dim" dialogClass="f95-dialogwrap">
      {view === "archive" ? (
        <Win className="f95-folder" title="News Room" icon="folder" buttons={[{ g: "close", label: t("news.close"), onClick: () => actions.closeNews() }]}>
          <div className="f95-menubar" aria-hidden>
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Help</span>
          </div>
          <div className="f95-folderlist inset">
            {!newsroom.storage && <p className="warn">Storage is unavailable. Editions are kept for this visit.</p>}
            {newsroom.archive.length === 0 ? (
              <p>The presses are warming up. Your first front page arrives after day 7; the chat checks in after day 30.</p>
            ) : (
              <ul>
                {newsroom.archive.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => actions.viewNews(e.id)}>
                      <Ico name={e.type === "paper" ? "news" : "chat"} size={32} />
                      <span>
                        <small>
                          {e.kicker} · {e.date}
                        </small>
                        <b>{e.headline}</b>
                      </span>
                      {e.unread && <em>NEW</em>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="f95-status">
            {newsroom.archive.length} object(s) · {t("news.paused")}
          </div>
        </Win>
      ) : view === "paper" && newsroom.paper ? (
        <FrontPage paper={newsroom.paper} actions={actions} />
      ) : newsroom.chat ? (
        <GroupChat chat={newsroom.chat} actions={actions} />
      ) : null}
    </Dialog>
  );
}

const CHANNELS = [
  ["master", "Master"],
  ["music", "Music"],
  ["sfx", "Effects"],
] as const;

/** Volume Control. */
export function Mixer({ sound, actions }: SlotPropsMap["Mixer"]) {
  const t = useT();
  return (
    <Dialog label="Sound mixer" close={actions.closeMixer} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-mixer" title="Volume Control" icon="sound" buttons={[{ g: "close", label: "Close", onClick: () => actions.closeMixer() }]}>
        <div className="f95-mixbody">
          {CHANNELS.map(([channel, label]) => (
            <label key={channel} className="f95-slider">
              <span>{label}</span>
              <input type="range" aria-label={label} min={0} max={100} value={Math.round(sound[channel] * 100)} onChange={(e) => actions.setVolume(channel, Number(e.target.value) / 100)} />
              <output>{Math.round(sound[channel] * 100)}%</output>
            </label>
          ))}
          <label className="f95-check-row">
            <input type="checkbox" checked={sound.muted} onChange={(e) => actions.setMuted(e.target.checked)} /> {sound.muted ? t("sound.unmute") : t("sound.mute")}
          </label>
          <fieldset>
            <legend>Try the sounds</legend>
            {sound.cues.map((cue) => (
              <Btn key={cue.id} onClick={() => actions.playCue(cue.id)}>
                {cue.label}
              </Btn>
            ))}
          </fieldset>
          <small>{sound.ready ? "Settings saved on this device." : "Tap a control to start audio. If your browser blocks it, tap again."}</small>
        </div>
        <div className="f95-row">
          <Btn def onClick={() => actions.closeMixer()}>
            OK
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

/** Control Panel ▸ Add/Remove Mods. Nothing can be added from here: in 1995 you edited the address bar, and so do you. */
export function ModManager({ mods, actions }: SlotPropsMap["ModManager"]) {
  return (
    <Dialog label="Add/Remove Mods" close={actions.closeMods} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-mods" title="Add/Remove Mods Properties" icon="folder" buttons={[{ g: "close", label: "Close", onClick: () => actions.closeMods() }]}>
        <div className="f95-mixbody">
          <p>
            Mods load from the address bar: add <code>?mod=</code> and the URL of a <code>mod.json</code>, then reload. Later mods win a clash.
          </p>
          <div className="inset f95-modlist" role="list" aria-label="Loaded mods">
            {mods.list.length === 0 ? (
              <div className="empty">(none) Every lab is still itself.</div>
            ) : (
              mods.list.map((m) => (
                <div key={m.id} role="listitem">
                  <Ico name={m.drama ? "drama" : "doc"} size={18} />
                  <b>{m.name}</b>
                  <span>{m.version}</span>
                  <span className="hash">#{m.hash}</span>
                  <Btn className="f95-modoff" onClick={() => actions.removeMod(m.id)} title="Reloads without it: a new lab">
                    {m.drama ? "Switch off" : "Remove"}
                  </Btn>
                  {m.description && <small>{m.description}</small>}
                </div>
              ))
            )}
          </div>
          {mods.conflicts.length > 0 && (
            <fieldset>
              <legend>Clashes</legend>
              {mods.conflicts.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </fieldset>
          )}
          {mods.errors.length > 0 && (
            <fieldset className="bad">
              <legend>
                <Ico name="error" size={16} /> Didn't load
              </legend>
              {mods.errors.map((e) => (
                <code key={e}>{e}</code>
              ))}
            </fieldset>
          )}
          <small>
            {mods.contentHash ? `This run's content: #${mods.contentHash}. ` : ""}Try <a href={EXAMPLE_MOD}>Every Lab Is Named Steve</a>.
          </small>
        </div>
        <div className="f95-row">
          <Btn def onClick={() => actions.closeMods()}>
            OK
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

/** FLT-55: a mod's skin, found like new hardware in 1995. Nothing is installed until the player clicks Yes. */
export function ModSkinOffer({ offer, actions }: SlotPropsMap["ModSkinOffer"]) {
  const no = () => actions.declineSkinOffer();
  return (
    <Dialog label="Found New Skin" close={no} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-msgbox f95-skinoffer" title="Found New Skin" icon="display" buttons={[{ g: "close", label: "No", onClick: no }]} role="alertdialog" label={`Found New Skin: ${offer.name}`}>
        <div className="f95-msgbody">
          {offer.preview ? <img className="f95-skinoffer-preview" src={offer.preview} alt="" /> : <Ico name="display" size={36} />}
          <div>
            <p>
              Windows has found new skin:
              <br />
              <b>{offer.name}</b>
            </p>
            <p>
              <small>
                Provided by {offer.modName}. {offer.description}
              </small>
            </p>
            <p>Do you want to install it now? You can change it later in Display Properties.</p>
          </div>
        </div>
        <div className="f95-row">
          <Btn def autoFocus onClick={() => actions.acceptSkinOffer()}>
            Yes
          </Btn>
          <Btn onClick={no}>No</Btn>
        </div>
      </Win>
    </Dialog>
  );
}

/** One pack on the Drama channel: the story, the first headlines, what's in it. */
function DramaStory({ pack }: { pack: DramaPackVM }) {
  return (
    <div className="f95-drama-story inset">
      <h2>{pack.title}</h2>
      <p className="dek">{pack.description}</p>
      {pack.teasers.length > 0 && (
        <ul>
          {pack.teasers.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <small>{dramaComing(pack)}</small>
    </div>
  );
}

/**
 * Start ▸ Programs ▸ Today's Drama: a 1995 "channel" that pushes one small mod a day. Playing one reloads with it (a new
 * lab); the one playing is switched off here or in Add/Remove Mods. Just after a pack loads, it's the "On Air" card instead.
 */
export function Drama({ drama, actions }: SlotPropsMap["Drama"]) {
  const on = drama.on;
  const latest = drama.latest;
  const unlisted = on && ![latest, ...drama.archive].some((p) => p?.on);
  const banner = (text: string, date?: string) => (
    <div className="f95-drama-banner">
      <b>{text}</b>
      {date && <span>{date}</span>}
    </div>
  );
  if (drama.intro && on) {
    return (
      <Dialog label="Today's Drama is on air" close={actions.closeDrama} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
        <Win className="f95-drama intro" title="Today's Drama - On Air" icon="drama" buttons={[{ g: "close", label: "Close", onClick: () => actions.closeDrama() }]}>
          {banner("ON AIR", on.dateText)}
          <div className="f95-mixbody">
            <p className="f95-drama-now">Now playing in this lab:</p>
            <DramaStory pack={on} />
            <p>The rivals have read the news too. Your staff certainly have.</p>
          </div>
          <div className="f95-row">
            <Btn def onClick={() => actions.closeDrama()}>
              Let's go
            </Btn>
            <Btn onClick={() => actions.removeMod(on.id)}>Switch it off</Btn>
          </div>
        </Win>
      </Dialog>
    );
  }
  return (
    <Dialog label="Today's Drama" close={actions.closeDrama} layerClass="f95-layer f95-dim" dialogClass="f95-dialogbox">
      <Win className="f95-drama" title="Today's Drama - Channel Viewer" icon="drama" buttons={[{ g: "close", label: "Close", onClick: () => actions.closeDrama() }]}>
        {banner(latest && latest.ago === "today" ? "TODAY'S DRAMA" : "LATEST DRAMA", latest ? `${latest.dateText} · ${latest.ago}` : undefined)}
        <div className="f95-mixbody">
          {unlisted && (
            <p>
              Playing <b>{on.title}</b>.{" "}
              <button type="button" className="f95-link" onClick={() => actions.removeMod(on.id)}>
                Switch it off
              </button>
            </p>
          )}
          {drama.status === "loading" && !latest && <p>Dialling the drama wire at 28.8 kbps…</p>}
          {drama.status === "error" && !latest && (
            <p>
              <Ico name="error" size={16} /> The drama wire is busy. Somewhere, a lab is getting away with something.
            </p>
          )}
          {drama.status === "ready" && !latest && <p>No drama published yet. The labs are behaving. Suspicious.</p>}
          {latest && <DramaStory pack={latest} />}
          {latest && (
            <div className="f95-row left">
              {latest.on ? (
                <>
                  <span className="f95-drama-live">● Playing in this lab</span>
                  <Btn onClick={() => actions.removeMod(latest.id)}>Switch it off</Btn>
                </>
              ) : (
                <>
                  <Btn def onClick={() => actions.playDrama(latest.id)}>
                    {on ? "Swap it in" : "Play it"}
                  </Btn>
                  <small>Starts a new lab: mods load before the first brick. Your current lab will be fine. Probably.</small>
                </>
              )}
            </div>
          )}
          {drama.archive.length > 0 && (
            <fieldset className="f95-drama-archive">
              <legend>Previously on Today's Drama</legend>
              <div className="inset f95-modlist" role="list" aria-label="Past packs">
                {drama.archive.map((p) => (
                  <div key={p.id} role="listitem">
                    <Ico name="doc" size={18} />
                    <b>{p.title}</b>
                    <span>{p.dateText}</span>
                    {p.on ? (
                      <span className="f95-drama-live">● On</span>
                    ) : (
                      <Btn className="f95-modoff" onClick={() => actions.playDrama(p.id)} aria-label={`Play ${p.title}`}>
                        Play
                      </Btn>
                    )}
                    <small>{p.summary}</small>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
          <small>
            One small mod a day, written from the morning's AI news and checked by a human before it airs. Parody names only.{" "}
            <button
              type="button"
              className="f95-link"
              onClick={() => {
                actions.closeDrama();
                actions.openMods();
              }}
            >
              Add/Remove Mods…
            </button>
          </small>
        </div>
        <div className="f95-row">
          <Btn def={!latest || latest.on} onClick={() => actions.closeDrama()}>
            Close
          </Btn>
        </div>
      </Win>
    </Dialog>
  );
}

const PALETTE = ["#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"];

/** Photo mode: the picture is the canvas of a paint program. The frame is only the edges; the campus shows through. */
export function PhotoOverlay({ photo, actions }: SlotPropsMap["PhotoOverlay"]) {
  const shot = photo.shot;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!shot) return;
    setShown(shot.id);
    const id = window.setTimeout(() => setShown((cur) => (cur === shot.id ? 0 : cur)), 7000);
    return () => window.clearTimeout(id);
  }, [shot?.id]);
  return (
    <div className="photo-ui f95-photo">
      {photo.on && (
        <>
          {photo.flash > 0 && <div key={photo.flash} className="shutter-flash" />}
          <div className="f95-paint-top f95-win" role="toolbar" aria-label="Photo mode">
            <div className="f95-tb">
              <Ico name="camera" size={18} />
              <span className="f95-tt">campus.bmp — Paint Job</span>
              <span className="f95-btns">
                <button type="button" className="f95-b" data-g="close" aria-label="Done" title="Done" onClick={() => actions.setPhoto(false)}>
                  <span className="f95-glyph" />
                </button>
              </span>
            </div>
            <div className="f95-menubar live">
              <span className="grp">
                <b>File</b>
                <Btn def onClick={() => actions.takePhoto()} title="Take photo (Enter)">
                  Save As…
                </Btn>
                <Btn onClick={() => actions.setPhoto(false)}>Exit</Btn>
              </span>
              <span className="grp" role="group" aria-label="Time of day">
                <b>View</b>
                {photo.times.map((x) => (
                  <Btn key={x.key} className={photo.time === x.key ? "on" : ""} aria-pressed={photo.time === x.key} onClick={() => actions.setPhotoTime(x.key)}>
                    {x.label}
                  </Btn>
                ))}
              </span>
            </div>
          </div>
          <div className="f95-paint-left f95-win" aria-hidden>
            {["pencil", "rect", "ellipse", "text", "eraser", "fill", "line", "zoom"].map((g, i) => (
              <span key={g} className={i === 0 ? "on" : ""}>
                <Ico name={`tool-${g}`} size={20} />
              </span>
            ))}
          </div>
          <div className="f95-paint-bottom f95-win" aria-hidden>
            <div className="pal">
              {PALETTE.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </div>
            <span>For Help, press F1. Press Enter to Save As… campus.bmp</span>
          </div>
        </>
      )}
      {shot && shown === shot.id && (
        <Win className="f95-saveas" title="Save As" icon="folder" buttons={[{ g: "close", label: "Close", onClick: () => setShown(0) }]}>
          <div className="f95-saveasbody">
            <img src={shot.url} alt="Your photo" />
            <div>
              <div className="f95-fl">File name:</div>
              <div className="inset f95-fname">{shot.label}</div>
              <div className="f95-hint">Saved to your Downloads.</div>
            </div>
          </div>
          <div className="f95-row">
            <Btn def onClick={() => setShown(0)}>Save</Btn>
            <Btn onClick={() => setShown(0)}>Cancel</Btn>
          </div>
        </Win>
      )}
    </div>
  );
}

/**
 * Display Properties → Settings (FLT-73): the picture tube. The little monitor shows the pick before the big one does
 * (both change at once, but the little one is cuter). Applies at once and is remembered, like Reduce motion.
 */
function TubeSettings({ crt, actions }: { crt: NonNullable<SlotPropsMap["SkinPicker"]["skins"]["crt"]>; actions: SlotPropsMap["SkinPicker"]["actions"] }) {
  const t = useT();
  return (
    <>
      <div className={`f95-monitor f95-tube-${crt.mode}`} aria-hidden>
        <span />
      </div>
      <fieldset className="f95-tube">
        <legend>{t("skin.crt")}</legend>
        {(["off", "subtle", "full"] as const).map((m) => (
          <label key={m}>
            <input type="radio" name="f95-tube" checked={crt.mode === m} onChange={() => actions.setCrt(m)} /> {t(`skin.crt.${m}`)}
            {crt.choice === null && crt.mode === m && <small> {t("skin.crt.default")}</small>}
          </label>
        ))}
      </fieldset>
      {crt.reduced && <p className="f95-hint">{t("skin.crt.reduced")}</p>}
    </>
  );
}

/** Display Properties → Appearance: pick a scheme (a skin), see it change live, OK to keep it. */
export function SkinPicker({ skins, actions }: SlotPropsMap["SkinPicker"]) {
  const t = useT();
  const [tab, setTab] = useState<"background" | "saver" | "appearance" | "settings">("appearance");
  const current = skins.list.find((s) => s.id === skins.active) ?? skins.list[0];
  return (
    <Dialog label="Display Properties" close={actions.cancelSkinPicker} layerClass="f95-layer" dialogClass="f95-dialogbox">
      <Win className="f95-display" title="Display Properties" icon="display" buttons={[{ g: "help", label: "Help" }, { g: "close", label: "Close", onClick: () => actions.cancelSkinPicker() }]}>
        <Tabs
          label="Display Properties"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "background", label: "Background" },
            { id: "saver", label: "Screen Saver" },
            { id: "appearance", label: "Appearance" },
            { id: "settings", label: "Settings" },
          ]}
        />
        <div className="f95-page" role="tabpanel">
          {tab === "settings" && skins.crt ? (
            <TubeSettings crt={skins.crt} actions={actions} />
          ) : tab !== "appearance" ? (
            <p className="f95-hint">Nothing to see here. This monitor is entirely virtual.</p>
          ) : (
            <>
              <div className="f95-monitor" aria-hidden>
                {current?.preview ? <img src={current.preview} alt="" /> : <span />}
              </div>
              <label className="f95-scheme">
                <span>Scheme:</span>
                <select value={skins.active} onChange={(e) => actions.previewSkin(e.target.value)}>
                  {skins.list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <p className="f95-hint">
                  {current.description} <small>by {current.author} · v{current.version}</small>
                </p>
              )}
              <ul className="f95-thumbs" aria-label="Installed schemes">
                {skins.list.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={skins.active === s.id ? "on" : ""} onClick={() => actions.previewSkin(s.id)} aria-pressed={skins.active === s.id} title={s.name}>
                      {s.preview ? <img src={s.preview} alt="" /> : <span className="none" />}
                      <small>{s.name}</small>
                    </button>
                  </li>
                ))}
              </ul>
              {skins.rejected.map((r) => (
                <p key={r.id} className="f95-hint warn">
                  ⚠ {r.id} was refused: {r.errors[0]}
                </p>
              ))}
              <label className="f95-check-row">
                <input type="checkbox" checked={skins.reducedMotion} onChange={(e) => actions.setReducedMotion(e.target.checked)} /> {t("skin.reduceMotion")}
              </label>
            </>
          )}
          <div className="f95-row">
            <Btn def onClick={() => actions.applySkin()}>
              OK
            </Btn>
            <Btn onClick={() => actions.cancelSkinPicker()}>{t("skin.cancel")}</Btn>
          </div>
        </div>
      </Win>
    </Dialog>
  );
}

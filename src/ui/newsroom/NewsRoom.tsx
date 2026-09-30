import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef } from "react";
import { atoms, registry, sim } from "../../app/game";
import { useApp, useAutoPause } from "../../app/hooks";
import { mixerAtom, mixerOpenAtom, playCue, setMixer } from "../../audio/state";
import { NewsDesk } from "../../newsroom/desk";
import { frontPage, recap } from "../../newsroom/edition";
import { loadRoom, pressCamera, publish, resetRoom, roomAtom, skipNews, viewRoom } from "../../newsroom/state";
import { formatDate } from "../../sim/format";
import { Dialog } from "./Dialog";
import { FrontPage } from "./FrontPage";
import { GroupChat } from "./GroupChat";
import { Mixer } from "./Mixer";
import "./newsroom.css";
const desk = new NewsDesk();
export function NewsRoom() {
  const snap = useApp(atoms.snap);
  const event = useApp(atoms.event);
  const room = useAtomValue(roomAtom);
  const mixer = useAtomValue(mixerAtom);
  const demoOpened = useRef(false);
  const pausedForReading = room.view !== null;
  useAutoPause("newsroom", pausedForReading);
  useEffect(() => { loadRoom(); }, []);
  useEffect(() => {
    const result = desk.poll(sim.world);
    if (result.reset) { pressCamera.pending.length = 0; resetRoom(); }
    if (result.editions.length) pressCamera.pending.push(result.editions);
  }, [snap]);
  useEffect(() => {
    if (!pausedForReading) return;
    playCue("card");
  }, [pausedForReading]);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("debug")) return;
    const demo = () => {
      const lab = sim.world.labName;
      const stories = [
        { id: 701, day: 27, kind: "release" as const, text: `${lab} releases Frontier-4.5-Reasoner-Mini-Pro-Preview; benchmarks up, expectations up, sleep down` },
        { id: 702, day: 26, kind: "protest" as const, text: "Protesters chant 'H2O LIES'; a passing pigeon joins in" },
        { id: 703, day: 25, kind: "rival" as const, text: "Open-ish AI drops free weights on launch day. Again." },
        { id: 704, day: 24, kind: "money" as const, text: "CFO says 'runway is a state of mind'; investors request a different state" },
      ];
      pressCamera.pending.push([frontPage(stories, 28, lab), recap(stories, 30, lab)]);
    };
    Object.assign(window, { __press: {
      publish, room: () => registry.get(roomAtom),
      // A deterministic showroom, using the real transforms and camera pipeline. No changes to the sim.
      demo,
    } });
    if (new URLSearchParams(location.search).has("newsdemo")) demo();
    return () => { Reflect.deleteProperty(window, "__press"); };
  }, []);
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get("newsdemo");
    if (!mode || demoOpened.current || !room.archive.some((e) => e.id === "chat-30")) return;
    demoOpened.current = true;
    viewRoom(mode === "archive" ? "archive" : room.archive.find((e) => e.id === (mode === "paper" ? "paper-28" : "chat-30")) ?? null);
  }, [room.archive]);
  const newest = room.archive.slice().reverse().find((e) => room.unread.includes(e.id));
  return <>
    <div className="news-controls panel"><button onClick={() => viewRoom("archive")} aria-label="Open News Room">▤ <span>News Room</span>{room.unread.length > 0 && <b className="unread-count">{room.unread.length}</b>}</button><button onClick={() => setMixer({ muted: !mixer.muted })} aria-label={mixer.muted ? "Unmute sound" : "Mute sound"}>{mixer.muted ? "♪̸" : "♪"}</button><button onClick={() => registry.set(mixerOpenAtom, true)} aria-label="Open sound mixer">☷</button></div>
    {newest && !room.view && !event && <aside className="news-arrival panel"><span>{newest.type === "paper" ? "The Frontier Times is here." : "Mom and 3 others have thoughts."}</span><button onClick={() => viewRoom(newest)}>Read</button><button onClick={skipNews}>Skip</button></aside>}
    {room.view && !event && <Dialog label={room.view === "archive" ? "News Room archive" : room.view.type === "paper" ? "The Frontier Times" : "Monthly group chat"} close={() => viewRoom(null)}>
      <div className="news-toolbar"><button onClick={() => viewRoom(room.view === "archive" ? null : "archive")}>{room.view === "archive" ? "← Campus" : "← Archive"}</button><span>News Room · campus paused</span><button onClick={() => viewRoom(null)} aria-label="Skip and return to campus">Back to campus ×</button></div>
      {room.view === "archive" ? <div className="news-archive"><span className="paper-section">Your lab, in the public record</span><h1>News Room</h1><p>A weekly paper. A monthly group chat. A permanent record of your temporary confidence.</p>{!room.storage && <p className="archive-note">Storage is unavailable. Editions are kept for this visit.</p>}{room.archive.length === 0 ? <div className="archive-empty"><b>The presses are warming up.</b><p>Your first front page arrives after day 7. The chat checks in after day 30.</p></div> : <div className="archive-list">{room.archive.slice().reverse().map((e) => <button key={e.id} onClick={() => viewRoom(e)}><span className={`edition-icon ${e.type}`}>{e.type === "paper" ? "▤" : "···"}</span><span><small>{e.type === "paper" ? "THE FRONTIER TIMES" : "WHAT JUST HAPPENED IN AI"} · {formatDate(e.day - 1)}</small><b>{e.type === "paper" ? e.lead.text : e.topic}</b></span>{room.unread.includes(e.id) && <em>NEW</em>}<span>↗</span></button>)}</div>}<footer>Latest 30 editions · saved on this device · rival ticker is a fictional sentiment index</footer></div> : room.view.type === "paper" ? <FrontPage page={room.view}/> : <GroupChat key={room.view.id} chat={room.view}/>}
    </Dialog>}
    {!room.view && !event && <Mixer/>}
  </>;
}

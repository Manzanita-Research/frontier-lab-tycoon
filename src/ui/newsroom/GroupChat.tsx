import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useRef } from "react";
import { registry } from "../../app/game";
import { FRIENDS } from "../../content/newsroom";
import type { Recap } from "../../newsroom/edition";
import { formatDate } from "../../sim/format";
const playbackAtom = Atom.make(0);
export function GroupChat({ chat }: { chat: Recap }) {
  const count = useAtomValue(playbackAtom);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    registry.set(playbackAtom, 0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { registry.set(playbackAtom, chat.messages.length); return; }
    const timers = chat.messages.map((_, i) => window.setTimeout(() => registry.set(playbackAtom, Math.max(registry.get(playbackAtom), i + 1)), 900 + i * 1150));
    return () => timers.forEach(clearTimeout);
  }, [chat]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [count]);
  const next = chat.messages[count];
  return <article className="group-chat">
    <header className="chat-header"><div className="chat-icon" aria-hidden="true"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2Z"/><path d="M18 8h2a2 2 0 0 1 2 2v10l-4-3h-4"/></svg></div><div><h1>what just happened in AI</h1><p>Nell, Ash, Zip, Mom · notifications absolutely on</p></div></header>
    <div className="chat-month">{formatDate(chat.from)} — {formatDate(chat.day - 1)}</div>
    <div className="chat-link"><span>THE FRONTIER TIMES · MONTH IN REVIEW</span><p>{chat.topic}</p><small>Shared from {chat.lab}</small></div>
    <div className="chat-messages" aria-live="polite" aria-relevant="additions">
      {chat.messages.slice(0, count).map((m, i) => <div className={`chat-row friend-${m.friend}`} key={i}><div className="friend-avatar" aria-hidden="true">{FRIENDS[m.friend].avatar}</div><div className="chat-message"><span className="friend-name">{FRIENDS[m.friend].name} <small>{FRIENDS[m.friend].subtitle}</small></span><p>{m.text}</p></div></div>)}
      {next && <div className={`chat-row friend-${next.friend} typing-row`}><div className="friend-avatar" aria-hidden="true">{FRIENDS[next.friend].avatar}</div><div><span className="friend-name">{FRIENDS[next.friend].name} is typing</span><span className="typing-dots" aria-label={`${FRIENDS[next.friend].name} is typing`}><i/><i/><i/></span></div></div>}
      <div ref={bottom}/>
    </div>
    <div className="chat-bottom">{count < chat.messages.length ? <button onClick={() => registry.set(playbackAtom, chat.messages.length)}>Read all messages</button> : <span>Seen by everyone. Understood by no one.</span>}<span className="chat-reply">Replies disabled. You're busy running a lab.</span></div>
  </article>;
}

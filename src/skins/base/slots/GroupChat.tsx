import { useEffect, useRef } from "react";
import type { SlotPropsMap } from "../../types";

export function GroupChat({ chat, actions }: SlotPropsMap["GroupChat"]) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = chat.messages.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [count]);
  return (
    <article className="group-chat">
      <header className="chat-header">
        <div className="chat-icon" aria-hidden="true">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2Z" />
            <path d="M18 8h2a2 2 0 0 1 2 2v10l-4-3h-4" />
          </svg>
        </div>
        <div>
          <h1>what just happened in AI</h1>
          <p>Nell, Ash, Zip, Mom · notifications absolutely on</p>
        </div>
      </header>
      <div className="chat-month">{chat.range}</div>
      <div className="chat-link">
        <span>THE FRONTIER TIMES · MONTH IN REVIEW</span>
        <p>{chat.topic}</p>
        <small>Shared from {chat.lab}</small>
      </div>
      <div className="chat-messages" aria-live="polite" aria-relevant="additions">
        {chat.messages.map((m, i) => (
          <div className={`chat-row friend-${m.friend}`} key={i}>
            <div className="friend-avatar" aria-hidden="true">
              {m.avatar}
            </div>
            <div className="chat-message">
              <span className="friend-name">
                {m.name} <small>{m.subtitle}</small>
              </span>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
        {chat.typing && (
          <div className={`chat-row friend-${chat.typing.friend} typing-row`}>
            <div className="friend-avatar" aria-hidden="true">
              {chat.typing.avatar}
            </div>
            <div>
              <span className="friend-name">{chat.typing.name} is typing</span>
              <span className="typing-dots" aria-label={`${chat.typing.name} is typing`}>
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="chat-bottom">
        {chat.done ? <span>Seen by everyone. Understood by no one.</span> : <button onClick={() => actions.revealChat()}>Read all messages</button>}
        <span className="chat-reply">Replies disabled. You're busy running a lab.</span>
      </div>
    </article>
  );
}

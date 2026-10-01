// The Bird App's small parts (FLT-69), for any skin: a poster's banger↔cancel meter, the Aura sparkline, a post's
// likes/reposts/replies, and one post as a card. Semantic `bird-*` classes, styled by the base (base/birdapp.css) so a
// skin that uses them looks right before it restyles them. FLT-92: a rival lab's post wears its lab's colour
// (`--bird-lab`), a chip with the lab's name, the beat's tag and the post it quotes; BirdFilter is the Everyone / Us /
// Them switch (the skin keeps which is on).
import type { CSSProperties } from "react";
import type { BirdPostVM, BirdPosterVM } from "../../ui/hud/types";
import { useT } from "../context";

/** FLT-92: which posts the timeline shows. */
export type BirdSide = "all" | "us" | "them";
export const BIRD_SIDES: readonly BirdSide[] = ["all", "us", "them"];
/** A post's side: a post from before FLT-92 (no `side`) is one of ours. */
export const sideOf = (p: Pick<BirdPostVM, "side">): "us" | "them" => p.side ?? "us";
export const onSide = (side: BirdSide) => (p: Pick<BirdPostVM, "side">) => side === "all" || sideOf(p) === side;

/** Everyone / Us / Them, as a row of three toggles. Labels are `birdapp.filter.*`. */
export function BirdFilter({ value, onChange, className = "" }: { value: BirdSide; onChange: (side: BirdSide) => void; className?: string }) {
  const t = useT();
  return (
    <div className={`bird-filter ${className}`} role="radiogroup" aria-label={t("birdapp.filter")}>
      {BIRD_SIDES.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? "on" : ""} onClick={() => onChange(id)}>
          {t(`birdapp.filter.${id}`)}
        </button>
      ))}
    </div>
  );
}

/** The rival lab's chip: its colour and short name. */
export function BirdLabChip({ lab, className = "" }: { lab: NonNullable<BirdPostVM["lab"]>; className?: string }) {
  return (
    <span className={`bird-lab ${className}`} style={{ "--bird-lab": lab.color } as CSSProperties} title={lab.name}>
      <i aria-hidden />
      {lab.name}
    </span>
  );
}

/** Odds as a bar that grows left (banger, green) and right (cancel, red) from the middle; 25% fills a side. */
export function BirdMeter({ poster, className = "" }: { poster: Pick<BirdPosterVM, "banger" | "cancel" | "meterText" | "name">; className?: string }) {
  const side = (x: number) => `${Math.min(50, x * 200)}%`;
  return (
    <span className={`bird-meter ${className}`} role="meter" aria-label={`${poster.name}: ${poster.meterText}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(poster.banger * 100)}>
      <i className="banger" style={{ right: "50%", width: side(poster.banger) }} />
      <i className="cancel" style={{ left: "50%", width: side(poster.cancel) }} />
    </span>
  );
}

/** The last thirty midnights of Aura (0 to 100) as a line. */
export function AuraSpark({ values, className = "" }: { values: readonly number[]; className?: string }) {
  if (values.length < 2) return <svg className={`bird-spark ${className}`} viewBox="0 0 60 16" aria-hidden />;
  const step = 60 / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(15 - (Math.max(0, Math.min(100, v)) / 100) * 14).toFixed(1)}`).join(" ");
  return (
    <svg className={`bird-spark ${className}`} viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" />
    </svg>
  );
}

/** Likes, reposts, replies: the numbers climb while the post is live. The glyphs are drawn, since few UI fonts have ♡ or ⟲. */
export function BirdCounts({ post, className = "" }: { post: BirdPostVM; className?: string }) {
  return (
    <span className={`bird-counts ${className} ${post.ratioing ? "ratioing" : ""}`}>
      <span title={`${post.likes} likes`}>
        <CountIcon d="M5 8.5 1.6 5.2a2 2 0 0 1 3.4-2.4 2 2 0 0 1 3.4 2.4z" /> {post.likesText}
      </span>
      <span title={`${post.reposts} reposts`}>
        <CountIcon d="M2 4.5V3h5L5.5 1.5M8 5.5V7H3l1.5 1.5" /> {post.repostsText}
      </span>
      <span title={`${post.replies} replies`} className="replies">
        <CountIcon d="M1.5 2h7v4.5h-4L2.5 8.5v-2h-1z" /> {post.repliesText}
      </span>
    </span>
  );
}

function CountIcon({ d }: { d: string }) {
  return (
    <svg className="bird-ic" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** One post: avatar, name and handle, the text, the counts, how it landed, the viral sticker and the top reply. */
export function BirdPostCard({ post, compact = false, className = "" }: { post: BirdPostVM; compact?: boolean; className?: string }) {
  const t = useT();
  return (
    <article
      className={`bird-post ${className} outcome-${post.outcome} tone-${post.tone} ${post.viral ? "viral" : ""} side-${sideOf(post)}`}
      data-lab={post.lab?.id}
      style={post.lab ? ({ "--bird-lab": post.lab.color } as CSSProperties) : undefined}
      aria-label={`${post.lab ? `${post.lab.name}, ` : ""}${post.handle}: ${post.text}`}
    >
      <span className="bird-av" aria-hidden>
        {post.glyph}
      </span>
      <div className="bird-post-body">
        <header>
          {post.lab && <BirdLabChip lab={post.lab} />}
          <b>{post.name}</b> <span className="bird-handle">{post.handle}</span> <span className="bird-time">· {post.time}</span>
          {post.momentText && <em className="bird-moment">{post.momentText}</em>}
        </header>
        {post.replyTo && <small className="bird-replyto">↳ {post.replyTo}</small>}
        <p>{post.text}</p>
        {post.quote && (
          <blockquote className="bird-quote">
            <b>{post.quote.handle}</b> {post.quote.text}
          </blockquote>
        )}
        <footer>
          <BirdCounts post={post} />
          {post.outcome !== "live" && <span className={`bird-outcome tone-${post.tone}`}>{t(`birdapp.outcome.${post.outcome}`)}</span>}
          {post.outcome === "live" && post.ratioing && <span className="bird-outcome tone-joke">{t("birdapp.ratio")}</span>}
          {post.reviewed && <small className="bird-reviewed">{t("birdapp.reviewed")}</small>}
          {post.handledText && <small className="bird-handled">{post.handledText}</small>}
          {post.quote && post.tone === "bad" && <small className="bird-cost">{post.outcomeText}</small>}
          {post.beatText && <em className="bird-beat">{post.beatText}</em>}
        </footer>
        {!compact && post.reply && <blockquote className="bird-reply">{post.reply}</blockquote>}
      </div>
      {post.viral && (
        <span className="bird-viral" aria-label={t("birdapp.viral")}>
          {t("birdapp.viral")}
        </span>
      )}
    </article>
  );
}

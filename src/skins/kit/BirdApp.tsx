// The Bird App's small parts (FLT-69), for any skin: a poster's banger↔cancel meter, the Aura sparkline, a post's
// likes/reposts/replies, and one post as a card. Semantic `bird-*` classes, styled by the base (base/birdapp.css) so a
// skin that uses them looks right before it restyles them.
import type { BirdPostVM, BirdPosterVM } from "../../ui/hud/types";
import { useT } from "../context";

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

/** ♡ likes, ⟲ reposts, ↩ replies: the numbers climb while the post is live. */
export function BirdCounts({ post, className = "" }: { post: BirdPostVM; className?: string }) {
  return (
    <span className={`bird-counts ${className} ${post.ratioing ? "ratioing" : ""}`}>
      <span title={`${post.likes} likes`}>♡ {post.likesText}</span>
      <span title={`${post.reposts} reposts`}>⟲ {post.repostsText}</span>
      <span title={`${post.replies} replies`} className="replies">↩ {post.repliesText}</span>
    </span>
  );
}

/** One post: avatar, name and handle, the text, the counts, how it landed, the viral sticker and the top reply. */
export function BirdPostCard({ post, compact = false, className = "" }: { post: BirdPostVM; compact?: boolean; className?: string }) {
  const t = useT();
  return (
    <article className={`bird-post ${className} outcome-${post.outcome} tone-${post.tone} ${post.viral ? "viral" : ""}`} aria-label={`${post.handle}: ${post.text}`}>
      <span className="bird-av" aria-hidden>
        {post.glyph}
      </span>
      <div className="bird-post-body">
        <header>
          <b>{post.name}</b> <span className="bird-handle">{post.handle}</span> <span className="bird-time">· {post.time}</span>
          {post.momentText && <em className="bird-moment">{post.momentText}</em>}
        </header>
        {post.replyTo && <small className="bird-replyto">↳ {post.replyTo}</small>}
        <p>{post.text}</p>
        <footer>
          <BirdCounts post={post} />
          {post.outcome !== "live" && <span className={`bird-outcome tone-${post.tone}`}>{t(`birdapp.outcome.${post.outcome}`)}</span>}
          {post.outcome === "live" && post.ratioing && <span className="bird-outcome tone-joke">{t("birdapp.ratio")}</span>}
          {post.reviewed && <small className="bird-reviewed">{t("birdapp.reviewed")}</small>}
          {post.handledText && <small className="bird-handled">{post.handledText}</small>}
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

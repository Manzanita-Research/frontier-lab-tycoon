import type { AuctionPaddleVM } from "../../../ui/hud/types";

/** The auction room: three rival paddles, each hovering, and the lot. Sits between the card's text and the bids. */
export function AuctionStrip({ paddles }: { paddles: AuctionPaddleVM[] }) {
  return (
    <div className="auction-strip" aria-hidden="true">
      {paddles.map((r, i) => (
        <div key={r.id} className="paddle" style={{ animationDelay: `${i * 0.35}s` }}>
          <span className="paddle-board" style={{ background: r.color }}>
            {r.number}
          </span>
          <span className="paddle-stick" />
          <span className="paddle-name">{r.name}</span>
        </div>
      ))}
      <div className="gavel">🔨</div>
    </div>
  );
}

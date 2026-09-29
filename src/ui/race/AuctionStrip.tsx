import { atoms } from "../../app/game";
import { useApp } from "../../app/hooks";

/** The auction room: three rival paddles, each hovering, and the lot. Sits between the card's text and the bids. */
export function AuctionStrip() {
  const race = useApp(atoms.race);
  const rivals = race.board.filter((r) => !r.you).slice(0, 3);
  return (
    <div className="auction-strip" aria-hidden="true">
      {rivals.map((r, i) => (
        <div key={r.id} className="paddle" style={{ animationDelay: `${i * 0.35}s` }}>
          <span className="paddle-board" style={{ background: r.color }}>
            {200 + ((r.score * 7 + i * 31) % 800)}
          </span>
          <span className="paddle-stick" />
          <span className="paddle-name">{r.short}</span>
        </div>
      ))}
      <div className="gavel">🔨</div>
    </div>
  );
}

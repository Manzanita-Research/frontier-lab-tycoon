import type { SlotPropsMap } from "../types";

/**
 * The karaoke machine: the console, the song on the screen and the queue down the left; the tape deck, the contestant's
 * card, the high scores, the applause meter and the leaderboard down the right; the arcade along the bottom with the star toasts above it; and AI News
 * Karaoke underneath everything.
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="kn-hud">
      <div className="kn-left">
        {slots.Stats}
        <div className="kn-under">
          {slots.Training}
          {slots.Objectives}
        </div>
      </div>
      <div className="kn-right">
        <div className="kn-deck kn-plastic">
          <div className="kn-deck-row">
            {slots.Speed}
            {slots.PhotoButton}
          </div>
          {slots.NewsControls}
        </div>
        {slots.NewsArrival}
        <div className="kn-stack">
          {slots.Inspector}
          {slots.Benchmarks}
          {slots.Voice}
          {slots.Arena}
          {slots.Papers}
          {slots.ThoughtsPanel}
        </div>
      </div>
      {slots.Staff}
      <div className="kn-toasts-host">{slots.Toasts}</div>
      <div className="kn-bottom">
        {slots.Assistant}
        {slots.BuildBar}
      </div>
      {slots.Ticker}
    </div>
  );
}

import type { SlotPropsMap } from "../types";

/**
 * Where the docked slots go: the top bar, the two columns, the toast stack, the build bar and the ticker. The News Room
 * controls live in the right-hand column (not floating over it), so they never sit on the Thoughts header, and the
 * assistant rides just above the build bar, where it covers only campus. On a phone the toasts stack there too, above
 * the assistant, so nothing ever sits on the tool the tutorial points at; on a desktop they stay top-centre.
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="hud">
      {slots.Stats}
      <div className="hud-row">
        <div className="left-col">
          {slots.Training}
          {slots.Objectives}
          {slots.Benchmarks}
          {slots.Voice}
          {slots.Papers}
          {slots.Factions}
          {slots.BirdApp}
        </div>
        <div className="right-col">
          {slots.Speed}
          {slots.NewsControls}
          {slots.DramaButton}
          {slots.NewsArrival}
          {slots.PhotoButton}
          {slots.DisasterAlert}
          {slots.ThoughtsPanel}
          {slots.Inspector}
          {slots.Arena}
        </div>
      </div>
      <div className="bottom-dock">
        {slots.Toasts}
        {slots.Assistant}
        {slots.BuildBar}
      </div>
      {slots.Ticker}
      {slots.Staff}
    </div>
  );
}

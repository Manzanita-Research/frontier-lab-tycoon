import type { SlotPropsMap } from "../types";

/**
 * The CD-ROM's main screen: the banner and stickers top-left with the Star Chart under them, the Pace buttons and the
 * Field Trip Badge hanging off the right, the guide bot and the Build Stamps along the bottom, and the tape underneath.
 * (The bot reads the toasts out loud, so the Toasts slot is left out.)
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="dd-hud">
      <div className="dd-left">
        {slots.Stats}
        <div className="dd-chart">
          {slots.Training}
          {slots.Objectives}
        </div>
      </div>
      <div className="dd-right">
        {slots.Speed}
        <div className="dd-toolbar">
          {slots.NewsControls}
          {slots.DramaButton}
          {slots.PhotoButton}
        </div>
        <div className="dd-stack">
          {slots.Staff}
          {slots.Inspector}
          {slots.DisasterAlert}
          {slots.Arena}
          {slots.Papers}
          {slots.Benchmarks}
          {slots.Voice}
          {slots.Factions}
          {slots.BirdApp}
          {slots.ThoughtsPanel}
        </div>
      </div>
      {slots.NewsArrival}
      <div className="dd-bottom">
        {slots.Assistant}
        {slots.BuildBar}
      </div>
      {slots.Ticker}
    </div>
  );
}

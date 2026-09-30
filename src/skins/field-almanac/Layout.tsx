import type { SlotPropsMap } from "../types";

/**
 * The Almanac's page: the header strip across the top-left with the field notes under it, a column down the right
 * (the speed pill and the lens, the reading room, the specimen card, the Arena, Overheard), the tool shelf standing
 * on the bottom edge and the dispatches tape beneath it. Toasts hang from the header. Everything sits on the campus
 * instead of framing it: the middle of the screen is left empty.
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="fa-hud">
      <div className="fa-top">
        {slots.Stats}
        {slots.Toasts}
      </div>
      <div className="fa-left">
        <div className="fa-notes">
          {slots.Training}
          {slots.Objectives}
        </div>
      </div>
      <div className="fa-right">
        <div className="fa-controls fa-paper">
          {slots.Speed}
          {slots.PhotoButton}
        </div>
        {slots.NewsControls}
        {slots.NewsArrival}
        {slots.Inspector}
        {slots.Arena}
        {slots.ThoughtsPanel}
      </div>
      {slots.Staff}
      {slots.BuildBar}
      {slots.Ticker}
      {slots.Assistant}
    </div>
  );
}

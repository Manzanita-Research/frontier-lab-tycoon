import type { SlotPropsMap } from "../types";

/** Where the docked slots go: the top bar, the two columns, the toast stack, the build bar and the ticker. */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="hud">
      {slots.Stats}
      <div className="hud-row">
        <div className="left-col">
          {slots.Training}
          {slots.Objectives}
        </div>
        <div className="right-col">
          {slots.Speed}
          {slots.ThoughtsPanel}
          {slots.Inspector}
          {slots.Arena}
        </div>
      </div>
      {slots.Toasts}
      {slots.BuildBar}
      {slots.Ticker}
      {slots.Staff}
      {slots.NewsControls}
      {slots.NewsArrival}
      {slots.PhotoButton}
      {slots.Assistant}
    </div>
  );
}

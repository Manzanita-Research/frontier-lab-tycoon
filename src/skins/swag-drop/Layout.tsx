import type { SlotPropsMap } from "../types";

/**
 * The desk: the plaque, the dial and the sticky notes down the left; the speed keys, the corkboard and the lanyard down
 * the right; the keyboard along the bottom above the terminal ticker, and the news dock bottom-left.
 */
export function Layout({ vm, slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="sd-desk">
      <div className="sd-left">
        {slots.Stats}
        {slots.Training}
        {slots.Objectives}
        {slots.Factions}
        {slots.BirdApp}
      </div>
      <div className={`sd-right ${slots.Inspector ? "badge-open" : ""} ${vm.arena.open ? "arena-open" : ""} ${vm.disasters.running.length + vm.disasters.understaffed.length > 0 ? "dz-on" : ""}`}>
        <div className="sd-keys">
          {slots.Speed}
          {slots.PhotoButton}
          {slots.DramaButton}
        </div>
        {slots.ThoughtsPanel}
        {slots.Inspector}
        {slots.DisasterAlert}
        {slots.Arena}
        {slots.Papers}
      </div>
      {slots.Toasts}
      {slots.BuildBar}
      {slots.Ticker}
      {slots.Staff}
      {slots.NewsControls}
      {slots.NewsArrival}
      {slots.Assistant}
    </div>
  );
}

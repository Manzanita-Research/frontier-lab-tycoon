import type { SlotPropsMap } from "../types";

/**
 * The Almanac's page: the header strip across the top-left with the field notes, the leaderboard and the news cycle
 * under it, a column down the right (the speed pill and the lens, the reading room, the specimen card, the Arena,
 * Overheard), the tool shelf standing on the bottom edge and the dispatches tape beneath it. Toasts hang from the
 * header. Everything sits on the campus instead of framing it: the middle of the screen is left empty.
 */
export function Layout({ vm, slots }: SlotPropsMap["Layout"]) {
  // A window the game hides arrives as null: its wrapper goes with it.
  // On a phone the leaderboard is a pill beside Overheard under the speed buttons; on a desktop it hangs under the field notes.
  const compact = vm.layout.compact;
  return (
    <div className="fa-hud">
      <div className="fa-top">
        {slots.Stats}
        {slots.Toasts}
      </div>
      <div className="fa-left">
        {(slots.Training || slots.Objectives) && (
          <div className="fa-notes">
            {slots.Training}
            {slots.Objectives}
          </div>
        )}
        {!compact && slots.Benchmarks}
        {slots.Voice}
        {slots.Factions}
        {slots.BirdApp}
      </div>
      <div className="fa-right">
        {(slots.Speed || slots.PhotoButton) && (
          <div className="fa-controls fa-paper">
            {slots.Speed}
            {slots.PhotoButton}
          </div>
        )}
        {slots.NewsControls}
        {slots.DramaButton}
        {slots.WindowTray}
        {slots.NewsArrival}
        {slots.Inspector}
        {slots.DisasterAlert}
        {slots.Arena}
        {slots.Papers}
        {compact ? (
          <div className="fa-pills">
            {slots.Benchmarks}
            {slots.ThoughtsPanel}
          </div>
        ) : (
          slots.ThoughtsPanel
        )}
      </div>
      {slots.Staff}
      {slots.BuildBar}
      {slots.Ticker}
      {slots.Assistant}
    </div>
  );
}

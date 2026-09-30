import { IconSprite } from "./icons";
import { WindowStack } from "./stack";
import type { SlotPropsMap } from "../types";

/**
 * The desktop: windows on the left, a managed stack of windows on the right with the paperclip beneath it, and the
 * taskbar along the bottom. The paperclip's balloon lives in the same column as the stack (not floating over it), so it
 * can never cover a window: the stack gets the height that is left, and folds its oldest window when that is not enough.
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="f95-desktop">
      <IconSprite />
      <div className="f95-left">
        {slots.Stats}
        {/* on a phone the error box sits under the lab bar; on a desktop, at the top of the side column (CSS picks one) */}
        {slots.DisasterAlert}
        {slots.Training}
        {slots.Objectives}
      </div>
      <div className="f95-side">
        {slots.DisasterAlert}
        <WindowStack>
          {slots.Staff}
          {slots.Inspector}
          {slots.Arena}
          {slots.Papers}
          {slots.ThoughtsPanel}
        </WindowStack>
        {slots.NewsArrival}
        {slots.Assistant}
      </div>
      <div className="f95-taskbar">
        {slots.BuildBar}
        {slots.Ticker}
        <div className="f95-tray">
          {slots.Voice}
          {slots.Factions}
          {slots.NewsControls}
          {slots.PhotoButton}
          {slots.Speed}
        </div>
      </div>
    </div>
  );
}

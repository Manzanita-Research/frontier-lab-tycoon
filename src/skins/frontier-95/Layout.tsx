import { IconSprite } from "./icons";
import { Fold, TrayMore } from "./phone";
import { WindowStack } from "./stack";
import type { SlotPropsMap } from "../types";

/**
 * The desktop: windows on the left, a managed stack of windows on the right with the paperclip beneath it, and the
 * taskbar along the bottom. The paperclip's balloon lives in the same column as the stack (not floating over it), so it
 * can never cover a window: the stack gets the height that is left, and folds its oldest window when that is not enough.
 *
 * On a phone (FLT-87) the campus comes first: Training, the goal and the Objectives fold into one strip, and the taskbar
 * keeps to one row, the tray icons and waiting windows that don't fit behind a » button.
 */
export function Layout({ vm, slots }: SlotPropsMap["Layout"]) {
  const phone = vm.layout.compact;
  return (
    <div className="f95-desktop">
      <IconSprite />
      <div className="f95-left">
        {slots.Stats}
        {/* on a phone the error box sits under the lab bar; on a desktop, at the top of the side column (CSS picks one) */}
        {slots.DisasterAlert}
        {phone ? (
          <Fold vm={vm}>
            {slots.Training}
            {slots.Objectives}
          </Fold>
        ) : (
          <>
            {slots.Training}
            {slots.Objectives}
          </>
        )}
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
        {!phone && slots.WindowTray}
        {slots.Ticker}
        <div className="f95-tray">
          {phone ? (
            <TrayMore>
              {slots.WindowTray}
              {slots.Voice}
              {slots.Factions}
              {slots.BirdApp}
              {slots.NewsControls}
              {slots.DramaButton}
              {slots.PhotoButton}
            </TrayMore>
          ) : (
            <>
              {slots.Voice}
              {slots.Factions}
              {slots.BirdApp}
              {slots.NewsControls}
              {slots.DramaButton}
              {slots.PhotoButton}
            </>
          )}
          {slots.Speed}
        </div>
      </div>
    </div>
  );
}

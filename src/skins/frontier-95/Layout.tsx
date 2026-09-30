import { IconSprite } from "./icons";
import type { SlotPropsMap } from "../types";

/** The desktop: windows on the left and right, the paperclip bottom-right, and the taskbar along the bottom. */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="f95-desktop">
      <IconSprite />
      <div className="f95-left">
        {slots.Stats}
        {slots.Training}
        {slots.Objectives}
      </div>
      <div className="f95-right">
        {slots.Staff}
        {slots.Inspector}
        {slots.Arena}
        {slots.ThoughtsPanel}
      </div>
      {slots.NewsArrival}
      {slots.Assistant}
      <div className="f95-taskbar">
        {slots.BuildBar}
        {slots.Ticker}
        <div className="f95-tray">
          {slots.NewsControls}
          {slots.PhotoButton}
          {slots.Speed}
        </div>
      </div>
    </div>
  );
}

import { GcSprite } from "./icons";
import type { SlotPropsMap } from "../types";

/**
 * The home page: the welcome header and the construction site down the left, a web form (speed, news, camera) and the
 * About Me / guestbook pages down the right, pop-ups in the middle, the WebRing and the marquee across the bottom.
 */
export function Layout({ slots }: SlotPropsMap["Layout"]) {
  return (
    <div className="gc-page">
      <GcSprite />
      <div className="gc-top">
        <div className="gc-left">
          {slots.Stats}
          <div className="gc-box gc-parch gc-site">
            {slots.Training}
            {slots.Objectives}
          </div>
        </div>
        <div className="gc-right">
          <div className="gc-tools">
            {slots.Speed}
            <div className="gc-tools2">
              {slots.NewsControls}
              {slots.DramaButton}
              {slots.PhotoButton}
            </div>
          </div>
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
      {slots.Staff}
      <div className="gc-toasts">{slots.Toasts}</div>
      {slots.NewsArrival}
      {slots.Assistant}
      <div className="gc-bottom">
        {slots.BuildBar}
        {slots.Ticker}
      </div>
    </div>
  );
}

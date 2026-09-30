import { EVENTS, eventById } from "../content/events";
import { EVENT_STORY_KIND } from "../content/newsroom";
import { openEventOf } from "../sim/events";
import type { GameState } from "../sim/types";
import { frontPage, recap, storyFromNews, type Edition, type Story } from "./edition";

/** Display-only press clock. At boundaries, assemble the completed period, then retain the current month's notes. */
export class NewsDesk {
  private world: GameState | null = null;
  private day = 0;
  private seen = new Set<number>();
  private stories: Story[] = [];
  private cards = new Set<string>();

  poll(world: GameState): { reset: boolean; editions: Edition[] } {
    const reset = this.world !== null && (world !== this.world || world.day < this.day);
    if (!this.world || reset) {
      this.world = world;
      this.seen.clear();
      this.cards.clear();
      this.stories = [];
      this.day = world.day;
    }
    for (const n of world.news) {
      if (this.seen.has(n.id)) continue;
      this.seen.add(n.id);
      this.stories.push(storyFromNews(n));
    }
    const open = openEventOf(world);
    if (open && !this.cards.has(`${open.id}:${open.day}`)) {
      this.cards.add(`${open.id}:${open.day}`);
      const def = eventById(open.id);
      if (def) this.stories.push({ id: -10000 - EVENTS.findIndex((e) => e.id === open.id) * 1000 - open.day, day: open.day, text: def.title, kind: EVENT_STORY_KIND[open.id] ?? "filler" });
    }
    const editions: Edition[] = [];
    // No historical editions fabricated on load/warp. Subsequent boundaries use their precise period.
    for (let d = this.day + 1; d <= world.day; d++) {
      if (d % 7 === 0) editions.push(frontPage(this.stories, d, world.labName, { classified: world.collusion?.classified, scandal: world.collusion?.frontPage }));
      if (d % 30 === 0) editions.push(recap(this.stories, d, world.labName));
    }
    this.day = world.day;
    this.stories = this.stories.filter((s) => s.day >= Math.floor(world.day / 30) * 30 - 7);
    // The sim keeps only fifty headlines; ids absent from both sources cannot reappear in this World.
    this.seen = new Set([...world.news.map((n) => n.id), ...this.stories.map((s) => s.id)]);
    return { reset, editions };
  }
}

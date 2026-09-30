import type { VisibleVM } from "../../ui/hud/types";

/** What `visible` means when a slot is handed none (an older host, a test): every panel is earned. */
export const ALL_VISIBLE: VisibleVM = { revenue: true, vibes: true, arena: true, rnd: true, thoughts: true, news: true, staff: true, events: true, papers: true, disasters: true };

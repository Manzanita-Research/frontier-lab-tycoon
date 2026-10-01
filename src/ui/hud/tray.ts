// The view-model's side of the window budget (FLT-54): which of the VM's windows the game opened by itself, and the VM
// with the budget applied (windows over budget hidden, the taskbar's waiting buttons and unread panels in `tray`).
import type { NewsItem, NewsPanel } from "../../sim/types";
import type { HudVM, TrayItemVM } from "./types";
import { isDocked, isUp, type AutoWindowId, type Budget, type Want } from "./windows";

/** What a waiting window's button says, before a skin renames it. */
const PAPER_LABEL = { drop: "Your paper is out", scoop: "Scooped!", award: "An award" } as const;

/**
 * The windows in `vm` that the game opened: the paper boy, the New! card, a paper moment, the wiki, and the Arena when
 * a rank drop called it (`arenaCall`, the host's key for that drop; only while the player has it folded).
 */
export function wantsOf(vm: HudVM, arenaCall: string | null): Want[] {
  const wants: Want[] = [];
  if (arenaCall && !vm.arena.open && vm.visible.arena) wants.push({ id: "arena", key: arenaCall });
  if (vm.newsroom.arrival) wants.push({ id: "news", key: vm.newsroom.arrival.id });
  if (vm.unlock) wants.push({ id: "unlock", key: vm.unlock.id });
  if (vm.paperMoment) wants.push({ id: "paper", key: vm.paperMoment.key });
  if (vm.crumbWiki) wants.push({ id: "wiki", key: vm.crumbWiki.key });
  return wants;
}

/** Headlines about each panel newer than the last one the player saw with it open. */
export function unreadOf(news: readonly NewsItem[], seen: Partial<Record<NewsPanel, number>>): Record<NewsPanel, number> {
  const out: Record<NewsPanel, number> = { arena: 0, papers: 0, factions: 0 };
  for (const n of news) if (n.panel && n.id > (seen[n.panel] ?? -1)) out[n.panel]++;
  return out;
}

/** The newest headline id about each panel: what "seen" becomes while it is open. */
export function newestOf(news: readonly NewsItem[]): Partial<Record<NewsPanel, number>> {
  const out: Partial<Record<NewsPanel, number>> = {};
  for (const n of news) if (n.panel) out[n.panel] = Math.max(out[n.panel] ?? -1, n.id);
  return out;
}

/**
 * The VM as the player sees it: a window the budget does not hold up is hidden (docked or closed), the Arena is open
 * while the budget holds it up, the panels carry their unread counts, and `tray` lists what waits on the taskbar.
 */
export function windowed(vm: HudVM, budget: Budget, unread: Record<NewsPanel, number>): HudVM {
  const up = (id: AutoWindowId, has: boolean) => has && isUp(budget, id);
  const arenaOpen = vm.arena.open || isUp(budget, "arena");
  const papersShown = vm.papers.enabled && vm.visible.papers;
  const factionsShown = vm.factions.enabled && vm.visible.factions;
  const tray: TrayItemVM[] = [];
  const waiting = (id: AutoWindowId, label: string | undefined) => {
    if (label !== undefined && isDocked(budget, id)) tray.push({ id, label, flashing: true, unread: id === "arena" ? unread.arena : 0 });
  };
  for (const w of budget) {
    if (w.id === "arena") waiting("arena", "Arena");
    if (w.id === "news") waiting("news", vm.newsroom.arrival?.type === "chat" ? "Group chat" : "Frontier Times");
    if (w.id === "unlock") waiting("unlock", vm.unlock?.title);
    if (w.id === "paper") waiting("paper", vm.paperMoment ? PAPER_LABEL[vm.paperMoment.kind] : undefined);
    if (w.id === "wiki") waiting("wiki", vm.crumbWiki?.site.split(":")[0]);
  }
  if (!arenaOpen && vm.visible.arena && unread.arena > 0 && !tray.some((t) => t.id === "arena")) tray.push({ id: "arena", label: "Arena", flashing: false, unread: unread.arena });
  if (papersShown && !vm.papers.open && unread.papers > 0) tray.push({ id: "papers", label: "Papers", flashing: false, unread: unread.papers });
  if (factionsShown && !vm.factions.open && unread.factions > 0) tray.push({ id: "factions", label: "Discourse", flashing: false, unread: unread.factions });
  return {
    ...vm,
    arena: { ...vm.arena, open: arenaOpen, auto: vm.arena.open ? vm.arena.auto : arenaOpen, unread: arenaOpen ? 0 : unread.arena },
    papers: { ...vm.papers, unread: vm.papers.open ? 0 : unread.papers },
    factions: { ...vm.factions, unread: vm.factions.open ? 0 : unread.factions },
    newsroom: { ...vm.newsroom, arrival: up("news", vm.newsroom.arrival !== null) ? vm.newsroom.arrival : null },
    unlock: up("unlock", vm.unlock !== null) ? vm.unlock : null,
    paperMoment: up("paper", vm.paperMoment !== null) ? vm.paperMoment : null,
    crumbWiki: up("wiki", vm.crumbWiki !== null) ? vm.crumbWiki : null,
    tray,
  };
}

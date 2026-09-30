import { Atom } from "effect/unstable/reactivity";
import { registry, sim } from "../app/game";
import { appendArchive, readArchive } from "./archive";
import type { Edition } from "./edition";
export interface Room { archive: Edition[]; view: "archive" | Edition | null; unread: string[]; storage: boolean }
export const roomAtom = Atom.make<Room>({ archive: [], view: null, unread: [], storage: true });
const key = () => `frontier-news-v1:${sim.world.seed}:${sim.world.labName}`;
export function loadRoom() {
  let archive: Edition[] = []; let storage = true;
  try { archive = readArchive(localStorage.getItem(key())); } catch { storage = false; }
  registry.set(roomAtom, { archive, view: null, unread: [], storage });
}
export function resetRoom() {
  try { localStorage.removeItem(key()); } catch { /* Fresh lab still starts with an empty in-memory archive. */ }
  registry.set(roomAtom, { archive: [], view: null, unread: [], storage: true });
}
export function publish(editions: Edition[]) {
  const old = registry.get(roomAtom);
  const archive = appendArchive(old.archive, editions);
  let storage = true;
  try { localStorage.setItem(key(), JSON.stringify(archive)); } catch {
    storage = false;
    // Preserve stories if images exceed the browser's quota.
    try { localStorage.setItem(key(), JSON.stringify(archive.map((e) => e.type === "paper" ? { ...e, photo: undefined } : e))); storage = true; } catch { /* UI makes session-only persistence explicit. */ }
  }
  const ids = new Set(archive.map((e) => e.id));
  registry.set(roomAtom, { ...old, archive, storage, unread: [...new Set([...old.unread, ...editions.map((e) => e.id)])].filter((id) => ids.has(id)) });
}
export function viewRoom(view: Room["view"]) {
  const room = registry.get(roomAtom);
  registry.set(roomAtom, { ...room, view, unread: typeof view === "object" && view ? room.unread.filter((id) => id !== view.id) : room.unread });
}
export function skipNews() { const room = registry.get(roomAtom); registry.set(roomAtom, { ...room, unread: [] }); }
/** The render bridge supplies a freshly rendered camera frame, never a stale canvas from another feature. */
export const pressCamera: { pending: Edition[][] } = { pending: [] };

// Mods that come and go mid-game (FLT-78): Today's Drama's "Add to my lab", the Mod Manager's Remove, and a save that
// had one added. A data-only mod joins the running lab: fetch it, recompose the session's definition, and send the sim
// an `addMod` command; the sim swaps the definition on that command's tick. No reload, no new lab.
import { Atom } from "effect/unstable/reactivity";
import { dramaPath } from "../drama/feed";
import type { SaveFile, SaveMod } from "../save";
import { setSessionDefinition } from "../sim/defs";
import type { Command } from "../sim/commands";
import type { LiveModNews } from "../sim/liveMods";
import { registry, send, sim, toast } from "./game";
import { cardsOf, fetchOne, modSession, needsRestart, setModSession, withMod, withoutModId, type ModSession, type SessionManifest } from "./mods";

/** Bumped whenever the session's mods change mid-game, so the HUD's mod lists are read again. */
export const modsRevision = Atom.keepAlive(Atom.make(0));

/** Make `next` the session: what the HUD, the renderer and the next save read. The sim's own definition moves with its commands. */
export function installSession(next: ModSession) {
  setModSession(next);
  setSessionDefinition(next.def);
  registry.set(modsRevision, registry.get(modsRevision) + 1);
}

/** What the lab says when a mod arrives. A Drama pack is "Today's Drama"; its first plain headline goes on the ticker. */
export function arrivalNews({ manifest, source }: SessionManifest, href: string): LiveModNews {
  const drama = dramaPath(source, href) !== null;
  const title = drama ? manifest.name.replace(/^Daily Drama:\s*/, "") : manifest.name;
  const line = (manifest.content?.headlines?.add ?? []).find((h) => !h.when && !h.text.includes("{"));
  return {
    toast: drama ? "📼 Today's Drama added" : `🧩 ${manifest.name} added`,
    flash: drama ? `📼 Just in: today's Drama, "${title}". Arriving in your lab now.` : `🧩 ${manifest.name} arrives in the lab.`,
    ...(line ? { headline: { text: line.text, tone: line.tone } } : {}),
  };
}

type ModCommand = Extract<Command, { type: "addMod" | "removeMod" }>;

function queue(command: ModCommand, next: ModSession) {
  sim.stageDef(command, next.def);
  send({ type: "COMMAND", command });
  installSession(next);
}

/** The `removeMod` command for a mod in `session`, and the session without it. */
async function removal(session: ModSession, id: string): Promise<{ command: ModCommand; next: ModSession } | null> {
  const m = session.manifests.find((x) => x.manifest.id === id);
  if (!m) return null;
  const next = await withoutModId(session, id);
  return { command: { type: "removeMod", id, cards: cardsOf(m.manifest), run: next.run }, next };
}

export type AddResult = { ok: true } | { ok: false; reason: string };

/**
 * Add the mod at `source` to the lab on screen. `replaces` says which mods it makes way for (another Drama pack: one
 * drama at a time); they leave first, in the same tick. A mod that needs a fresh start is refused, with why.
 */
export async function addModLive(source: string, replaces: (source: string) => boolean = () => false): Promise<AddResult> {
  let fetched: SessionManifest;
  try {
    fetched = await fetchOne(source, { baseUrl: location.href });
  } catch (error) {
    return { ok: false, reason: `Couldn't fetch it: ${error instanceof Error ? error.message : String(error)}` };
  }
  const restart = needsRestart(fetched.manifest);
  if (restart) return { ok: false, reason: restart };
  let session = modSession();
  if (session.mods.some((m) => m.id === fetched.manifest.id)) return { ok: true };
  try {
    for (const old of session.mods.filter((m) => m.source !== source && replaces(m.source) && !m.needsRestart)) {
      const r = await removal(session, old.id);
      if (!r) continue;
      queue(r.command, r.next);
      session = r.next;
    }
    const next = await withMod(session, fetched);
    const { manifest } = fetched;
    const hash = next.mods.find((m) => m.id === manifest.id)!.hash;
    queue({ type: "addMod", mod: { id: manifest.id, name: manifest.name, version: manifest.version, hash, url: source, cards: cardsOf(manifest) }, run: next.run!, news: arrivalNews(fetched, location.href) }, next);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `It doesn't fit with the mods already on: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Take a data-only mod out of the lab on screen. Answers false for one that needs a fresh start (the caller reloads). */
export async function removeModLive(id: string): Promise<boolean> {
  const session = modSession();
  const mod = session.mods.find((m) => m.id === id);
  if (!mod || mod.needsRestart) return false;
  const r = await removal(session, id);
  if (!r) return false;
  queue(r.command, r.next);
  // A mod that came in on the address would come back with a reload: it leaves the address too.
  const url = new URL(location.href);
  const mods = url.searchParams.getAll("mod");
  if (mods.includes(mod.source)) {
    url.searchParams.delete("mod");
    for (const m of mods) if (m !== mod.source) url.searchParams.append("mod", m);
    history.replaceState(history.state, "", url.href);
  }
  toast(`Removed ${mod.name}. Its card is off the table.`, "neutral");
  return true;
}

/** The mods a save lists that were added mid-game (and can be fetched again). */
const addedIn = (save: Pick<SaveFile, "mods">): SaveMod[] => save.mods.filter((m) => m.tick !== undefined && m.source !== undefined);

/**
 * Before a save loads: mods it had added mid-game come back, and mods this lab added mid-game that it doesn't have go,
 * all without a word (the World already says what it has). Answers the session to install with the load (nothing
 * changes until then), or what couldn't be fetched (the ordinary mods prompt takes over).
 */
export async function matchSave(save: Pick<SaveFile, "mods">): Promise<{ ok: true; session: ModSession } | { ok: false; reason: string }> {
  let session = modSession();
  const live = new Set((sim.world.modsAdded ?? []).map((m) => m.id));
  const wanted = new Set(save.mods.map((m) => m.id));
  try {
    for (const m of session.mods) if (live.has(m.id) && !wanted.has(m.id) && !m.needsRestart) session = await withoutModId(session, m.id);
    for (const m of addedIn(save)) {
      if (session.mods.some((x) => x.id === m.id)) continue;
      const fetched = await fetchOne(m.source!, { baseUrl: location.href });
      if (needsRestart(fetched.manifest)) return { ok: false, reason: `${m.id} needs a fresh start` };
      session = await withMod(session, fetched);
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, session };
}

// The session's mod looks for one renderer (FLT-102): the walkers', the staff's (`staff:<job>`) or the visitor groups'
// (`group:<kind>`). Rebuilt when a mod comes or goes mid-game, and disposed with the old set.
import { useEffect, useMemo, useState } from "react";
import { registry } from "../app/game";
import { modsRevision } from "../app/liveMods";
import { modSession } from "../app/mods";
import { buildModLooks, type ModLooks } from "./modLooks";

/** Which renderer draws a target: the staff, the visitor groups, or (everything else) the walkers. */
export type LookAudience = "walkers" | "staff" | "groups";
export const audienceOf = (target: string): LookAudience => (target.startsWith("staff:") ? "staff" : target.startsWith("group:") ? "groups" : "walkers");

export function useSessionLooks(audience: LookAudience): ModLooks {
  const [rev, setRev] = useState(() => registry.get(modsRevision));
  useEffect(() => registry.subscribe(modsRevision, setRev), []);
  const looks = useMemo(() => {
    const all = modSession().presentation?.looks ?? {};
    return buildModLooks(Object.fromEntries(Object.entries(all).filter(([target]) => audienceOf(target) === audience)));
  }, [audience, rev]);
  useEffect(() => () => looks.dispose(), [looks]);
  return looks;
}

import { useEffect, useState, useSyncExternalStore } from "react";
import { cloudApi } from "./cloud/api";
import { createCloud, OFF, type Cloud, type CloudActions, type CloudVM } from "./cloud/controller";
import { gamePort } from "./game";

const none = () => () => undefined;
const off = () => OFF;
const idle: CloudActions = { load: () => undefined, dismiss: () => undefined };

/** A member's cloud saves, for as long as they are logged on. */
export function useCloud(member: boolean): { cloud: CloudVM; cloudActions: CloudActions } {
  const [c, setC] = useState<Cloud | null>(null);
  useEffect(() => {
    if (!member) return;
    const next = createCloud(gamePort, cloudApi);
    setC(next);
    void next.start();
    return () => {
      next.stop();
      setC(null);
    };
  }, [member]);
  const cloud = useSyncExternalStore(c?.subscribe ?? none, c?.get ?? off);
  return { cloud, cloudActions: c?.actions ?? idle };
}

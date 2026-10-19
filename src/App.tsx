import { RegistryContext } from "@effect/atom-react";
import { Suspense, useEffect } from "react";
import { registry, startApp } from "./app/game";
import { Scene } from "./render/Scene";
import { Glass, useGlass } from "./ui/glass/Glass";
import { HudHost } from "./ui/hud/HudHost";
import { WorldOverlay } from "./ui/WorldOverlay";
import { Sky, Tube } from "./ui/juice";

export function App() {
  // Mounting the actor atom starts the app machine and its frame loop (and its watchdog); releasing it stops them.
  useEffect(() => startApp(), []);
  return (
    <RegistryContext.Provider value={registry}>
      <Suspense fallback={null}>
        <Screen />
      </Suspense>
    </RegistryContext.Provider>
  );
}

/** With the glass up (FLT-88) the sky and the 2D UI move inside it, and it is the tube; otherwise the usual stack. */
function Screen() {
  const glass = useGlass();
  return (
    <>
      {!glass && <Sky />}
      <Scene />
      <Glass back={<Sky />}>
        <WorldOverlay />
        <HudHost />
      </Glass>
      {!glass && <Tube />}
    </>
  );
}

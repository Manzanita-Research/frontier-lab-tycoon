import { RegistryContext } from "@effect/atom-react";
import { Suspense, useEffect } from "react";
import { registry, startApp } from "./app/game";
import { Scene } from "./render/Scene";
import { HudHost } from "./ui/hud/HudHost";
import { WorldOverlay } from "./ui/WorldOverlay";
import { Sky } from "./ui/juice";

export function App() {
  // Mounting the actor atom starts the app machine and its frame loop (and its watchdog); releasing it stops them.
  useEffect(() => startApp(), []);
  return (
    <RegistryContext.Provider value={registry}>
      <Suspense fallback={null}>
        <Sky />
        <Scene />
        <WorldOverlay />
        <HudHost />
      </Suspense>
    </RegistryContext.Provider>
  );
}

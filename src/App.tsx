import { RegistryContext } from "@effect/atom-react";
import { Suspense, useEffect } from "react";
import { app, registry } from "./app/game";
import { Scene } from "./render/Scene";
import { HudHost } from "./ui/hud/HudHost";
import { WorldOverlay } from "./ui/WorldOverlay";
import { Sky, Tube } from "./ui/juice";

export function App() {
  // Mounting the actor atom starts the app machine and its frame loop; releasing it stops both.
  useEffect(() => registry.mount(app.actor), []);
  return (
    <RegistryContext.Provider value={registry}>
      <Suspense fallback={null}>
        <Sky />
        <Scene />
        <WorldOverlay />
        <HudHost />
        <Tube />
      </Suspense>
    </RegistryContext.Provider>
  );
}

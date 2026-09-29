import { RegistryContext } from "@effect/atom-react";
import { Suspense, useEffect } from "react";
import { app, registry } from "./app/game";
import { Scene } from "./render/Scene";
import { HUD } from "./ui/HUD";
import { WorldOverlay } from "./ui/WorldOverlay";
import { Sky } from "./ui/juice/Sky";
import "./ui/ui.css";
import "./ui/juice/juice.css";

export function App() {
  // Mounting the actor atom starts the app machine and its frame loop; releasing it stops both.
  useEffect(() => registry.mount(app.actor), []);
  return (
    <RegistryContext.Provider value={registry}>
      <Suspense fallback={null}>
        <Sky />
        <Scene />
        <WorldOverlay />
        <HUD />
      </Suspense>
    </RegistryContext.Provider>
  );
}

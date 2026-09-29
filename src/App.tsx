import { useEffect } from "react";
import { Scene } from "./render/Scene";
import { startLoop } from "./store";
import { HUD } from "./ui/HUD";
import { WorldOverlay } from "./ui/WorldOverlay";
import "./ui/ui.css";

export function App() {
  useEffect(() => startLoop(), []);
  return (
    <>
      <Scene />
      <WorldOverlay />
      <HUD />
    </>
  );
}

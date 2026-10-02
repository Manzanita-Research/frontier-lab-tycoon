import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Account } from "./Account";
import "./account.css";

let booted = false;

/**
 * Mounts the account UI in a root of its own beside the game's, once the game and its skin are up. Only builds with
 * VITE_FLT_AUTH=on (the prod deploy with the FLT_AUTH switch on) ever load this module; see src/main.tsx (the game's
 * own boot, or the /box intro's hand-over to it).
 */
export function bootAccount() {
  if (booted) return;
  booted = true;
  const host = document.createElement("div");
  host.className = "hud-host flt-account";
  document.body.append(host);
  createRoot(host).render(
    <StrictMode>
      <Account />
    </StrictMode>,
  );
}

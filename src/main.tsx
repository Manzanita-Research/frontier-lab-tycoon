import { StrictMode, Suspense, lazy, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-900.css";
import { App } from "./App";
import "./index.css";

// Standalone demo pages: any file named `*.page.tsx` with a default export is
// reachable at `?page=<name>` (for example src/render/gallery.page.tsx is
// `?page=gallery`). Tasks use these to show their work in isolation without
// touching shared files.
const pages = import.meta.glob<{ default: ComponentType }>("./**/*.page.tsx");

function resolvePage() {
  const name = new URLSearchParams(window.location.search).get("page");
  if (!name) return null;
  const entry = Object.entries(pages).find(([path]) => path.endsWith(`/${name}.page.tsx`));
  return entry ? lazy(entry[1]) : null;
}

const Page = resolvePage();

// Canvas text (the gate sign, the placards) is drawn once, so wait for Nunito, but never for long.
const fonts = Promise.race([
  Promise.all([600, 700, 800, 900].map((w) => document.fonts.load(`${w} 16px Nunito`))),
  new Promise((done) => setTimeout(done, 1500)),
]).catch(() => undefined);

void fonts.then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {Page ? (
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      ) : (
        <App />
      )}
    </StrictMode>,
  ),
);

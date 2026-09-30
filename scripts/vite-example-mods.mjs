// The example mods ship with the site (FLT-37), so `?mod=/mods/examples/every-lab-is-steve/mod.json` works on any
// build or preview: served from the repo in dev, copied into dist/ by a build. Only the JSON files under mods/examples.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../mods/examples/", import.meta.url).pathname;
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : name.endsWith(".json") ? [path] : [];
  });

/** @returns {import("vite").Plugin} */
export function exampleMods() {
  return {
    name: "flt-example-mods",
    configureServer(server) {
      server.middlewares.use("/mods/examples/", (req, res, next) => {
        const wanted = decodeURIComponent((req.url ?? "").split("?")[0]);
        const path = files(root).find((f) => `/${relative(root, f)}` === wanted);
        if (!path) return next();
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(path));
      });
    },
    generateBundle() {
      for (const path of files(root)) this.emitFile({ type: "asset", fileName: `mods/examples/${relative(root, path)}`, source: readFileSync(path) });
    },
  };
}

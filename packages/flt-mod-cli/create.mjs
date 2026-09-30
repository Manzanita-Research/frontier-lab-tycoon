#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gameRoot } from "./io.mjs";

export async function scaffold(name, parent = process.cwd()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? "")) throw new Error("Usage: pnpm create-mod <kebab-case-name>");
  const destination = resolve(parent, name);
  await mkdir(destination); // Fail on an existing directory; never overwrite someone's mod.
  await cp(resolve(gameRoot, "templates/create-flt-mod"), destination, { recursive: true });
  await cp(resolve(gameRoot, ".agents/skills/flt-modding/SKILL.md"), resolve(destination, "SKILL.md"));
  for (const file of ["mod.json", "mod.ts", "package.json"]) {
    const path = resolve(destination, file);
    await writeFile(path, (await readFile(path, "utf8")).replaceAll("starter-mod", name).replaceAll("Starter Mod", name));
  }
  // Private, source-linked kit: works outside the workspace without publishing an SDK.
  const path = resolve(destination, "package.json");
  const pkg = JSON.parse(await readFile(path, "utf8"));
  pkg.scripts.test = `node ${JSON.stringify(resolve(gameRoot, "packages/flt-mod-cli/cli.mjs"))} check mod.json`;
  pkg.devDependencies["@flt/mod-sdk"] = `link:${resolve(gameRoot, "packages/flt-mod-sdk")}`;
  await writeFile(path, JSON.stringify(pkg, null, 2) + "\n");
  return destination;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  scaffold(process.argv[2]).then((path) => console.log(`Created ${path}\nEdit mod.json; run pnpm --dir ${JSON.stringify(path)} test. Optional: pnpm install for mod.ts authoring.`))
    .catch((error) => { console.error(String(error)); process.exitCode = 1; });
}

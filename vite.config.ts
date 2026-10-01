/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { exampleMods } from "./scripts/vite-example-mods.mjs";
import { dramaFeed } from "./scripts/drama-feed.mjs";
import { accounts } from "./scripts/vite-accounts.mjs";
import { introGuard } from "./scripts/vite-intro-guard.mjs";

export default defineConfig({
  plugins: [accounts(), react(), exampleMods(), dramaFeed(), introGuard()],
  resolve: {
    alias: {
      // @xstate/effect 0.1.0-alpha.5 was built against effect rc.115, where the reactivity module lived under
      // `unstable/`. effect rc.118 (and @effect/atom-react rc.118) moved it to `effect/reactivity`.
      "effect/unstable/reactivity": "effect/reactivity",
    },
  },
  base: "/",
  server: {
    // Dev servers run on Modal and are reached through `bb connect expose`.
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  test: {
    // Run @xstate/effect through vite so the alias above applies to its imports too.
    server: { deps: { inline: ["@xstate/effect"] } },
    globals: true,
    environment: "node",
    // Timing-budget tests need an idle CPU, especially on the 1-vCPU Modal builders: the wall-clock perf tests share
    // the box with every other test file, so run the files one at a time and they measure the sim, not the neighbours.
    fileParallelism: false,
    include: ["src/**/*.test.{ts,tsx}", "worker/**/*.test.ts", "infra/*.test.ts"],
    // The skin tests read each skin's CSS as text (scoping, tokens); everything else stays an empty module.
    css: { include: [/src\/skins\/[^/]+\/skin\.css/] },
  },
});

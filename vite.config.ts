/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    // Timing-budget tests need an idle CPU, especially on the 1-vCPU Modal builders.
    fileParallelism: false,
    globals: true,
    environment: "node",
    // The wall-clock perf tests share a 1-vCPU box with every other test file: run the files one at a time so
    // they measure the sim, not the neighbours.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
  },
});

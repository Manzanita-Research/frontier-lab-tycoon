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
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

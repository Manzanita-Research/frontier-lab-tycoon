/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any static host or sub-path.
  base: "./",
  server: {
    // Dev servers run on Modal and are reached through `bb connect expose`.
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

// The big box intro (FLT-70) is its own chunk: a build fails if any module under src/intro/ lands in an entry chunk.
// src/intro/split.test.ts checks the same thing from the import graph; this checks what Rollup actually emitted.
export function introGuard() {
  return {
    name: "flt-intro-guard",
    apply: "build",
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.isEntry) continue;
        const leaked = Object.keys(chunk.modules).filter((id) => id.includes("/src/intro/"));
        if (leaked.length) this.error(`the intro leaked into the entry chunk ${chunk.fileName} (FLT-70): ${leaked.join(", ")}`);
      }
    },
  };
}

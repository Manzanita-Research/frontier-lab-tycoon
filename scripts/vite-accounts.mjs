// Accounts (FLT-67) are compiled in only when the build runs with VITE_FLT_AUTH=on (the prod deploy, once Jem flips
// the repo variable; docs/ACCOUNTS.md). With the flag off, main.tsx's flagged `import("./account/boot")` is dead code
// that Rollup drops, but it still walks the import while it builds the module graph, and meeting the skin modules the
// account UI imports that early reorders a shared chunk. So with the flag off, that import resolves to an empty stub:
// src/account never enters the graph, and the bundle is byte for byte what it is without this task.
const STUB = "\0flt-accounts-off";

export function accounts() {
  let on = false;
  return {
    name: "flt-accounts",
    enforce: "pre",
    configResolved(config) {
      on = config.env.VITE_FLT_AUTH === "on";
    },
    resolveId(source, importer) {
      if (on || source !== "./account/boot" || !importer?.replace(/\\/g, "/").endsWith("/src/main.tsx")) return null;
      return STUB;
    },
    load(id) {
      return id === STUB ? "export const bootAccount = () => {};\n" : null;
    },
  };
}

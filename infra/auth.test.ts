import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTH_HOSTS, AUTH_SECRETS, authEnabled } from "./auth";

// FLT-67: accounts are prod-only and off until the repo variable FLT_AUTH=on.

describe("the FLT_AUTH switch", () => {
  it("is off unless the variable says exactly on, and never on a PR preview", () => {
    expect(authEnabled("prod", "")).toBe(false);
    expect(authEnabled("prod", undefined)).toBe(false);
    expect(authEnabled("prod", "true")).toBe(false);
    expect(authEnabled("prod", "off")).toBe(false);
    expect(authEnabled("pr-70", "on")).toBe(false);
    expect(authEnabled("prod", "on")).toBe(true);
  });

  it("guards everything the stack adds: off, the site is the edge-script Worker it was", () => {
    const stack = readFileSync(new URL("./alchemy.run.ts", import.meta.url), "utf8");
    // Every account resource, the Worker script, its secrets and the build flag live inside the `auth ?` branch.
    const branch = stack.slice(stack.indexOf("const accounts = auth"), stack.indexOf(": undefined;", stack.indexOf("const accounts = auth")));
    for (const piece of ["main: fileURLToPath", "D1.Database", "R2.Bucket", ...AUTH_SECRETS.map((s) => `Config.Redacted("${s}")`), 'VITE_FLT_AUTH: "on"']) {
      expect(branch).toContain(piece);
      expect(stack.split(piece).length - 1).toBe(1);
    }
    // Players' data survives the flag going off again, and comes back under the same names when it goes on.
    expect(branch.match(/RemovalPolicy\.retain\(\)/g)).toHaveLength(2);
    expect(branch).toContain("name: `flt-${stack.stage}-accounts`");
    expect(branch).toContain("name: `flt-${stack.stage}-saves`");
    // Off (and on every PR Preview), the Worker keeps main's edge script; on, worker/index.ts takes its place.
    expect(stack).toContain("...(accounts ?? { script: EDGE_SCRIPT }),");
    expect(stack.split("script: EDGE_SCRIPT").length - 1).toBe(1);
    // On, the Worker runs edge.mjs itself (worker/index.ts), so the redirect and link previews have one home.
    expect(branch).not.toMatch(/APP_HOST|REDIRECT_HOSTS/);
    expect(readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8")).toContain('import edge from "../infra/edge.mjs"');
    // The preview branch declares no bindings of its own.
    const preview = stack.slice(stack.indexOf("preview: {"), stack.indexOf("}),", stack.indexOf("preview: {")));
    expect(preview).not.toMatch(/env|DB|SAVES|Redacted|main/);
  });

  it("passes the secrets by name, only to a production deploy with the flag on", () => {
    const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
    expect(workflow).toContain("FLT_AUTH: ${{ vars.FLT_AUTH }}");
    for (const name of AUTH_SECRETS) expect(workflow).toContain(`${name}: \${{ vars.FLT_AUTH == 'on' && github.event_name == 'push' && secrets.${name} || '' }}`);
  });

  it("registers the callback hosts Jem set up with Hugging Face", () => {
    expect(AUTH_HOSTS).toEqual(["app.frontierlabtycoon.com", "flt-prod.manzanita.workers.dev"]);
  });
});

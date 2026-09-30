import { describe, expect, it } from "vitest";
import { parseModels } from "./variants";

describe("parseModels (?models=)", () => {
  it("stays procedural without the param", () => {
    expect(parseModels(null)).toEqual({});
    expect(parseModels("proc")).toEqual({});
  });
  it("gen swaps every subject to its best model", () => {
    const all = parseModels("gen");
    expect(Object.keys(all).sort()).toEqual(["cluster", "float", "hall"]);
    expect(all.hall).toMatch(/models\/gen\/hall\.glb$/);
  });
  it("names subjects and candidates, ignoring unknown kinds", () => {
    expect(parseModels("hall,float:tripo-B,gateway")).toEqual({
      hall: expect.stringMatching(/models\/gen\/hall\.glb$/),
      float: expect.stringMatching(/models\/gen\/candidates\/float-tripo-B\.glb$/),
    });
  });
});

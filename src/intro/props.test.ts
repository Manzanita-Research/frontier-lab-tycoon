// FLT-89: the store's 3D props, generated on Fal and cleaned in Blender by scripts/fal3d/props.mjs. Each job in
// props.jobs.json has exactly one shipped model, small enough that the shelf stays cheap to download and draw.
import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import jobs from "./assets/props.jobs.json";

const models = Object.keys(import.meta.glob("./assets/props/*.glb")).map((path) => path.slice("./assets/props/".length, -".glb".length));

describe("the store's props", () => {
  it("every job has a model, and every model a job", () => {
    expect(models.sort()).toEqual(jobs.map((j) => j.id).sort());
  });
  it("every model is decimated and packed: a few thousand triangles, under 100 kB", () => {
    for (const job of jobs) {
      expect(job.tris, job.id).toBeLessThanOrEqual(3000);
      expect(statSync(new URL(`./assets/props/${job.id}.glb`, import.meta.url)).size, job.id).toBeLessThan(100_000);
    }
  });
  it("asks for no words, so nothing printed on a model escapes the parody scan", () => {
    for (const job of jobs) expect(job.prompt, job.id).toMatch(/No text, no letters, no logos\.$/);
  });
});

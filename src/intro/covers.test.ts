// FLT-89: every box on the shelf wears a printed cover, generated from a job in art.jobs.json whose `text` lists every
// word in the picture. The parody scan reads that file, so a cover can't print a real name without failing it.
import { describe, expect, it } from "vitest";
import jobs from "./assets/art.jobs.json";
import { SHELF } from "./content";

const covers = Object.keys(import.meta.glob("./assets/shelf-*.webp")).map((path) => path.slice("./assets/".length, -".webp".length));
const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

describe("the shelf's covers", () => {
  it("every box has a cover, and every cover a box", () => {
    expect(covers.sort()).toEqual(SHELF.map((b) => `shelf-${b.id}`).sort());
  });
  it("every cover's job lists its printed words, and they spell the box's title", () => {
    for (const box of SHELF) {
      const job = jobs.find((j) => j.id === `shelf-${box.id}`);
      expect(job, box.id).toBeDefined();
      expect(job!.text?.length, box.id).toBeGreaterThan(0);
      expect(letters(job!.text!.join(" ")), box.id).toContain(letters(box.title));
    }
  });
});

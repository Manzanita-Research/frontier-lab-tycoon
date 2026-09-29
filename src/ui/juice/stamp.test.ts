import { describe, expect, it } from "vitest";
import { photoFileName, stampDate, stampText } from "./stamp";

describe("photo stamp", () => {
  it("reads 'Frontier Lab Tycoon · {lab} · Y1 Mar 4'", () => {
    // Day 63 is Y1 Mar 4 (30-day months, day 0 is Jan 1).
    expect(stampDate(63)).toBe("Y1 Mar 4");
    expect(stampText("Mostly Harmless Compute", 63)).toBe("Frontier Lab Tycoon · Mostly Harmless Compute · Y1 Mar 4");
    expect(stampDate(360 + 29)).toBe("Y2 Jan 30");
  });

  it("makes a tidy file name", () => {
    expect(photoFileName("Mostly Harmless Compute", 63)).toBe("frontier-lab-tycoon-mostly-harmless-compute-y1-mar-4.png");
    expect(photoFileName("Foo & Bar, Inc.", 0)).toBe("frontier-lab-tycoon-foo-bar-inc-y1-jan-1.png");
  });
});

import { formatDate } from "../../sim/format";

/** "Y1 Mar 4": the date on the photo stamp. */
export const stampDate = (day: number) => formatDate(day).replace(" · ", " ");

/** The tiny stamp on every saved photo. */
export const stampText = (lab: string, day: number) => `Frontier Lab Tycoon · ${lab} · ${stampDate(day)}`;

/** A file name for the saved PNG: "frontier-lab-tycoon-mostly-harmless-compute-y1-mar-4.png". */
export function photoFileName(lab: string, day: number) {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `frontier-lab-tycoon-${slug(lab)}-${slug(stampDate(day))}.png`;
}

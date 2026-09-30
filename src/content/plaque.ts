// FLT-56: the plaque the auditors leave by the gate, with the last report card's grade on it. Data only.

export const PLAQUE_HEAD = "EVALS WITHOUT BORDERS";

/** Under the letter, by grade ("caught" when they lifted a box). */
export const PLAQUE_SUB = {
  A: "CERTIFIED (MOSTLY)",
  B: "BASICALLY FINE",
  C: "SEE FOOTNOTES",
  D: "UNDER REVIEW",
  F: "DO NOT FEED THE MODEL",
  caught: "SEE: BOXES",
} as const;

/** The letter's colour. */
export const PLAQUE_INK = { A: "#1f8a3a", B: "#2b6fb3", C: "#b88a12", D: "#c2571b", F: "#b3263a" } as const;

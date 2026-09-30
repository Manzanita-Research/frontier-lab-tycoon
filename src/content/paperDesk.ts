// Papers UI copy (FLT-45): the policy blurbs, the arXive listing around your preprint, and the buttons that only close things.
// Data only. The sim's papers content (titles, venues, awards, headlines) lives in mods/base-papers.

export const PAPERS_TITLE = "Publish or Perish";

export const POLICY_COPY = {
  Open: { label: "Open", blurb: "Publish everything. Recruits love you. Rivals read along, taking notes." },
  Selective: { label: "Selective", blurb: "Publish the safe bits. Legal skims the abstract and nods." },
  Closed: { label: "Closed", blurb: "Publish nothing. Your researchers publish long blog posts about it instead." },
} as const;

/** How loudly the researchers want to publish, by publish pressure (0 to 1). */
/** The summary before the lab has written anything up. */
export const PAPERS_NONE = "Nothing written up yet. Suspicious, for a lab.";

export const PRESSURE_LINES: readonly [number, string][] = [
  [0.75, "Researchers are drafting an open letter about the open letters"],
  [0.5, "Researchers keep leaving LaTeX open on shared screens"],
  [0.25, "Researchers ask, casually, about the publication policy"],
  [0, "Researchers are content (for researchers)"],
];

/** Everyone else's preprints the same night: "{rival}" is a rival lab's short name. */
export const ARXIVE_FILLER = [
  { title: "A Survey of Surveys of Agent Surveys", rival: true },
  { title: "Emergent Abilities Are a Mirage, and So Is This Paper", rival: false },
  { title: "Chain-of-Thought Prompting Elicits Longer Invoices", rival: true },
  { title: "We Trained It on Its Own Reviews: Results Were Positive", rival: true },
  { title: "Scaling Laws for Scaling-Law Papers", rival: false },
  { title: "Tokenizers Considered Harmful (Considered Harmful)", rival: false },
] as const;

export const ARXIVE_BANNER = "arXive is experiencing unusual load. (It's you. You're the load.)";

export const SCOOP_TITLE = "Scooped";
export const SCOOP_BUTTONS = ["Add a 'concurrent work' footnote", "Subtweet them", "Close"] as const;
export const DROP_BUTTONS = ["Refresh the citation count", "Post the thread (1/37)", "Close"] as const;
export const AWARD_BUTTONS = ["Frame it", "Put it on the careers page", "Close"] as const;

/** Rival preprints that beat yours by eighteen hours. "{title}" is yours; theirs is suspiciously close. */
export const SCOOP_TITLES = [
  "{title} (Concurrent Work)",
  "Towards {title}",
  "{title}: A Simpler Baseline",
  "Rethinking {title}",
] as const;

export const AWARD_FOOT = "Presented at a ballroom with bad Wi-Fi. The appendix remains unread.";

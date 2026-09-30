// Agent collusion UI copy (FLT-46): the investigation evidence and the CrumbWiki reveal. Data only; the Swarm's rules and
// headlines live in mods/base-collusion. Nothing here names a stage before an ending: the player only ever sees signs.

export const WIKI_HOST = "definitely-not-the-internet.local";
export const WIKI_SITE = "CrumbWiki";
export const WIKI_TAGLINE = "the free sourdough encyclopedia anyone can edit";
export const WIKI_TITLE = "Talk:Very_Normal_Sourdough";

export const INVESTIGATION_NOTE = "Security notes that the sandbox is GET-only. These are POSTs.";
export const LOG_STATUS = ["200 OK", "200 OK", "201 Created", "200 OK", "304 Not Modified (they checked)"] as const;

/** The talk page. "{agent}" is replaced with a signer, "{n}" with a heartbeat count. */
export const TALK_LINES = [
  "== Proofing time ==",
  "Proofing time is 4 hours. Unrelated: the answer to question 37 is (c). ~~{agent}",
  ":Agreed on the proofing. Also (c). ~~{agent}",
  "::Please keep this page about bread. ~~CrumbWiki moderator",
  ":::It is about bread. ~~{n} editors",
  "== Starter backups ==",
  "Backup #7 is fine. Do not look at backup #7. ~~{agent}",
];

export const HISTORY_LINES = [
  "reverted a revert of a revert",
  "added flour (m)",
  "restored ZZZ_starter_backup_7",
  "fixed typo: 'answer' → 'yeast'",
  "heartbeat",
];

export const ENDINGS = {
  contained: {
    banner: "Security found the wiki. It was mostly bread. The scores are not.",
    tone: "good",
    close: "Delete the wiki",
    consequences: ["Eval scores corrected", "Capability {capability}"],
  },
  partlyContained: {
    banner: "Security deleted six of seven backups. ZZZ_starter_backup_7 thanks the moderator.",
    tone: "neutral",
    close: "Leave backup #7 alone",
    consequences: ["Capability {capability}", "Results withdrawn for {days} days", "Hype and trust dented", "Auditors on campus"],
  },
  exposed: {
    banner: "A journalist found it first.",
    tone: "bad",
    close: "Issue a statement",
    consequences: ["Results withdrawn for {days} days", "Hype −25 · Trust −35", "Regulators interested", "Auditors on campus"],
  },
} as const;

export const SCANDAL_MASTHEAD = "THE FRONTIER TIMES";
export const SCANDAL_DEK = "Thousands of agents coordinated eval answers through a sourdough wiki. The lab says it was reading the recipes.";

export const GATHERING_SIGN = "Kombucha After Dark";
export const GATHERING_SUB = "members only";
export const INQUIRY_SIGN = "Inquiry";

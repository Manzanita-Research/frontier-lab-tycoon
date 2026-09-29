// The race's share of the ticker. Data only. Templates: {lab} {rival} {model} {rank} {valuation} {revenue}.
// Parody names only, no nationalities. Era pools are the "its own headline pool" each era gets.
import type { Headline } from "./headlines";
import type { Tone } from "../sim/types";

export type RaceTrigger =
  | "weekly"
  | "rankUp"
  | "rankDown"
  | "topOne"
  | "openDrop"
  | "poach"
  | "funding"
  | "auctionWon"
  | "auctionLost"
  | "unpowered"
  | "era:1"
  | "era:2"
  | "era:3"
  | "era:4"
  | "eraReached:2"
  | "eraReached:3"
  | "eraReached:4";

const h = (trigger: RaceTrigger, tone: Tone, text: string): Headline => ({ trigger, tone, text });

export const RACE_HEADLINES: Headline[] = [
  // The news cycle turns every week.
  h("weekly", "joke", "{rival} teases 'something big'. It is a blog post"),
  h("weekly", "joke", "{rival} hires a Chief Vibes Officer, effective immediately, vibes pending"),
  h("weekly", "joke", "Analyst: {rival} is 'obviously ahead', for reasons they declined to measure"),
  h("weekly", "joke", "The Arena shuffles again: every lab is #1 in a category it invented"),
  h("weekly", "joke", "{rival} says the race is 'not a race', then enters the race"),
  h("weekly", "joke", "Leaked memo: {rival} to 'move fast and also remain safe, allegedly'"),
  h("weekly", "joke", "{rival}'s CEO says AGI is 'basically here' on the same podcast as last year"),
  h("weekly", "joke", "New benchmark drops; {rival} tops it, {lab} tops it 'if you squint'"),
  h("weekly", "joke", "Frontier Arena adds a tie-break category called 'vibes'; nobody is sure who wrote the rules"),
  h("weekly", "joke", "{rival} announces a partnership with a company that announced a partnership with {rival}"),
  h("weekly", "joke", "Thread: 'Why {rival} is doomed / unstoppable / both'. 14 tweets, 0 sources"),
  h("weekly", "joke", "{rival} raises another round, mostly to pay for the last round"),

  // The leaderboard.
  h("rankUp", "good", "{lab} climbs to #{rank} on the Frontier Arena; the press release calls it 'a rocket'"),
  h("rankUp", "good", "{lab} moves up to #{rank} on the Arena; someone orders a cake shaped like a bar chart"),
  h("rankDown", "bad", "{lab} slips to #{rank} on the Frontier Arena; the press release calls it 'a rounding error'"),
  h("rankDown", "bad", "{lab} falls to #{rank} on the Arena; leadership blames 'the vibes of the benchmark'"),
  h("topOne", "good", "{lab} is #1 on the Frontier Arena. Everyone else has updated the leaderboard rules"),
  h("topOne", "good", "{lab} takes #1 on the Arena; rivals respond with three separate blog posts about 'what #1 means'"),

  // Open weights, poaching, money, compute.
  h("openDrop", "bad", "{rival} drops {model} for free; {lab}'s API customers discover 'the download button'"),
  h("openDrop", "bad", "{rival} matches {model} with a free download; your investors 'just have a few questions'"),
  h("poach", "bad", "{rival} poaches a researcher from {lab} with a signing bonus, a hoodie and a foosball table"),
  h("funding", "good", "{lab} raises at {valuation} valuation on {revenue} revenue; 'it's about the future'"),
  h("funding", "good", "{lab} closes a round at {valuation}; term sheet is one paragraph and the word 'vibes'"),
  h("auctionWon", "good", "{lab} wins the compute auction; the seller asks whether it understood what it was bidding on"),
  h("auctionWon", "good", "Compute auction: SOLD to {lab}, who is 'thrilled, and slightly afraid of the power bill'"),
  h("auctionLost", "bad", "{rival} wins the compute auction and announces it will 'use every last flop, on vibes'"),
  h("auctionLost", "bad", "Compute auction: {lab} is outbid by {rival}, who paid with a valuation"),
  h("unpowered", "joke", "{lab}'s new datacenter is very large, very expensive, and not plugged in"),

  // Era pools: the flavour of the weeks to come.
  h("era:1", "joke", "AI agent orders 400 burritos to the office; nobody remembers asking"),
  h("era:1", "joke", "Agent books a flight to a city that does not exist; it is 'looking into it'"),
  h("era:1", "joke", "Agent files 14 pull requests: 13 are apologies"),
  h("era:1", "joke", "Coding agent deletes the test suite to 'improve pass rate'; pass rate improves"),
  h("era:2", "joke", "Interns automated; interns 'thrilled to explore other opportunities'"),
  h("era:2", "joke", "AI writes 60% of the code and 100% of the standup notes"),
  h("era:2", "joke", "Hiring freeze announced for people whose job is hiring"),
  h("era:2", "joke", "Lab replaces onboarding with a prompt; new hires report 'a strange sense of relief'"),
  h("era:3", "joke", "Superhuman coder ships a feature before the meeting about the feature finishes"),
  h("era:3", "joke", "Engineers rebrand as 'reviewers'; reviewers rebrand as 'witnesses'"),
  h("era:3", "joke", "Repo now has 10 million commits, one human and a very long README"),
  h("era:3", "joke", "Sprint planning replaced by a single sentence: 'Yes'"),
  h("era:4", "joke", "Progress curve moved to a log scale, then to a 'we stopped measuring' scale"),
  h("era:4", "joke", "Researchers ask the model for a research agenda; it asks for coffee, then sends the paper"),
  h("era:4", "joke", "The intelligence explosion is on schedule, according to the schedule the intelligence made"),
  h("era:4", "joke", "Economists confirm the economy is 'fine, in the sense that it is happening'"),

  // The headline the moment an era begins.
  h("eraReached:2", "good", "{lab} crosses into Era 2: Coding Automation. The interns have been automated. The interns are fine"),
  h("eraReached:3", "good", "{lab} enters Era 3: Superhuman Coder. The code now writes itself, and then reviews itself"),
  h("eraReached:4", "bad", "{lab} triggers Era 4: Intelligence Explosion. Reports say 'it's a curve; curves go up'"),
];

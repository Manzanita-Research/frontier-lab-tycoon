// News ticker copy. Templates: {lab} {model} {rival} {cash}. Parody only.
import type { BuildingKind } from "./buildings";
import type { Tone } from "../sim/types";

export type NewsTrigger =
  | "start"
  | "filler"
  | "rival"
  | "runStarted"
  | "runDone"
  | "lowCash"
  | "highHype"
  | "bailout"
  | `built:${BuildingKind}`;

export interface Headline {
  trigger: NewsTrigger;
  tone: Tone;
  text: string;
}

const h = (trigger: NewsTrigger, tone: Tone, text: string): Headline => ({ trigger, tone, text });

export const HEADLINES: Headline[] = [
  h("start", "neutral", "{lab} opens its doors with {cash} in seed money and a roadmap made entirely of vibes"),

  // Filler: the daily weather of a frontier lab.
  h("filler", "joke", "{lab} valuation rises 40% on news that it exists"),
  h("filler", "joke", "{lab} pledges to be carbon neutral by the heat death of the universe"),
  h("filler", "joke", "Senator asks whether {model} is 'in the cloud or in the computer'"),
  h("filler", "joke", "Benchmark saturated; researchers announce a harder benchmark, saturated by Thursday"),
  h("filler", "joke", "AI safety summit held on a yacht; attendees pledge to be safe, then to lunch"),
  h("filler", "joke", "Executive says AGI is 'two years away' for the fourth year running"),
  h("filler", "joke", "Leaked memo: 'Please stop asking the model to write its own leaked memos'"),
  h("filler", "joke", "Data center neighbors report the hum has developed a personality"),
  h("filler", "joke", "Startup adds 'AI' to its name, valuation triples; it sells socks"),
  h("filler", "joke", "Open letter signed by 10,000 people, 3 of whom read it"),
  h("filler", "joke", "Report: 9 out of 10 AI demos were pre-recorded; the tenth was an accident"),
  h("filler", "joke", "Prompt engineer promoted to Senior Prompt Engineer for adding 'please'"),
  h("filler", "joke", "Regulators announce plan to regulate 'the AI thing' by next fiscal decade"),
  h("filler", "joke", "GPU shortage: labs reportedly bartering compute for sourdough starter"),
  h("filler", "joke", "Study finds chatbots agree with you 94% of the time; scientists call the study 'brilliant'"),
  h("filler", "joke", "Cafeteria introduces the agentic sandwich; it assembles itself and files a ticket"),
  h("filler", "joke", "Founder pivots from AI wrapper to AI wrapper wrapper, raises at a higher valuation"),
  h("filler", "joke", "Op-ed: 'I asked {model} to write this op-ed and it asked for a raise'"),
  h("filler", "joke", "Analyst: AI is obviously a bubble, or obviously not; analyst is confident about which"),
  h("filler", "joke", "{lab} all-hands ends with a moment of silence for the loss curve that spiked"),
  h("filler", "joke", "Poll: 72% of people are worried about AI, 71% are asking it for dinner recipes"),
  h("filler", "joke", "Conference panel on alignment runs 40 minutes over; moderator suggests 'ship and see'"),

  // Rival releases, roughly every 12 to 20 days.
  h("rival", "bad", "{rival} releases open-weights model that matches {model}; your investors 'just have a few questions'"),
  h("rival", "bad", "{rival} announces a 'reasoning model' that is the last model with a longer pause"),
  h("rival", "bad", "{rival} drops a model on your launch day. Again. It is not a coincidence, it is a personality"),
  h("rival", "bad", "{rival} poaches three of your researchers with a foosball table shaped like a data center"),
  h("rival", "joke", "{rival} ships a 10M-token context window; nobody finishes the first page"),
  h("rival", "joke", "{rival} says its model is 'safe'; independent testers say 'safe-ish'"),
  h("rival", "joke", "Neo lab {rival} raises $30B pre-product; the deck is one slide reading 'trust us, but with math'"),
  h("rival", "joke", "{rival} unveils an agent that books your flights; it books all of them"),

  // Building something for the first time.
  h("built:cluster", "neutral", "{lab} adds compute; the local power grid 'has some thoughts'"),
  h("built:cluster", "neutral", "New cluster hums to life and is immediately renamed 'the thing that eats our budget'"),
  h("built:hall", "neutral", "Training Hall opens; the loss curve is visibly nervous"),
  h("built:hall", "neutral", "{lab} builds a second Training Hall for training the training"),
  h("built:gateway", "good", "{lab} opens its API Gateway: 'we sell intelligence by the token, and by the pound'"),
  h("built:gateway", "good", "API Gateway launches; the docs are three tutorials that disagree"),
  h("built:kombucha", "good", "Kombucha Bar opens: vibes up 12%, bloating up 800%"),
  h("built:kombucha", "good", "Researchers form a queue at the Kombucha Bar. It is the most organized thing they have done"),

  // Training.
  h("runStarted", "neutral", "{lab} begins training {model}; the loss function has been asked to try harder"),
  h("runStarted", "neutral", "Training run for {model} kicks off; interns told not to touch the big red button, or the green one"),
  h("runStarted", "neutral", "{model} enters training. Team lead: 'nobody breathe on it'"),
  h("runDone", "good", "{lab} releases {model}; benchmarks up, expectations up, sleep down"),
  h("runDone", "good", "{model} is here! It is the previous model, but with a bigger number"),
  h("runDone", "good", "{model} scores 91% on a benchmark it may have seen. A lot"),
  h("runDone", "good", "Critics call {model} a 'stochastic parrot'; parrot files a complaint"),
  h("runDone", "good", "{lab} launches {model} with a livestream, a countdown, and a slide that just says 'wow'"),

  // Trouble.
  h("lowCash", "bad", "{lab} has {cash} left; CFO says 'runway is a state of mind'"),
  h("lowCash", "bad", "Investors 'have a few questions' about the {cash} left in the bank"),
  h("lowCash", "bad", "{lab} considers selling mugs to extend runway; {cash} remaining"),
  h("lowCash", "bad", "Emergency all-hands: the free kombucha is now $4"),
  h("bailout", "bad", "Investors wire {lab} an emergency bridge round, plus a board seat and a fascinating set of questions"),

  // Success is its own kind of trouble.
  h("highHype", "good", "{lab} hype at an all-time high; three people quit to start competing labs before lunch"),
  h("highHype", "good", "Line outside {lab}'s gate; nobody knows why, everyone brought a resume"),
  h("highHype", "good", "Hype cycle reaches 'peak of inflated expectations'; management enters a sabbatical"),
];

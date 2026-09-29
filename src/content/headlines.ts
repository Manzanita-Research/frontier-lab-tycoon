// News ticker copy. Templates: {lab} {model} {rival} {cash}; people headlines also get {name} {their} {amount}. Parody only.
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
  | "protest"
  | "won"
  | "lost"
  | "researcherLeft"
  | "applicant"
  | "demoOk"
  | "demoFail"
  | "investorPays"
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
  h("rival", "bad", "{rival} announces a 'reasoning model' that is last year's model with a longer pause"),
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

  h("built:nap", "good", "Nap Pods open at {lab}; productivity is up, according to an anonymous and sleeping source"),
  h("built:nap", "good", "{lab} installs Nap Pods; researchers call it 'asynchronous collaboration'"),
  h("built:snack", "good", "Snack Wall unveiled at {lab}: focus up 30%, pretzel supply down 100%"),
  h("built:snack", "good", "{lab}'s Snack Wall is 40% snacks and 60% liability waivers"),
  h("built:demo", "good", "Demo Stage opens at {lab}; the model will attend in spirit"),
  h("built:demo", "good", "{lab} builds a Demo Stage; first rehearsal was 'a huge success', per the person who wrote the script"),

  // The crowd.
  h("researcherLeft", "bad", "Researcher leaves {lab} to 'spend more time with {their} GPUs'"),
  h("researcherLeft", "bad", "{name} quits {lab} via a 4,000-word blog post titled 'What I Learned Here (Legally, Nothing)'"),
  h("researcherLeft", "bad", "{name} walks out of {lab} with a box, a plant and a strongly worded resignation about the kombucha"),
  h("researcherLeft", "bad", "{lab} loses {name} to burnout; exit interview describes the vibes as 'load-bearing'"),
  h("researcherLeft", "bad", "{name} leaves {lab} to found a startup, working title: 'Like {lab}, but the snacks are real'"),
  h("applicant", "good", "{name} joins {lab}; first question: 'is the kombucha free, or is it equity?'"),
  h("applicant", "good", "{lab} hires {name}, who asked for a signing bonus in tokens"),
  h("applicant", "good", "Vibes draw applicants: {name} drove past two rivals to reach {lab}'s gate"),
  h("demoOk", "good", "Demo went flawlessly (it was pre-recorded)"),
  h("demoOk", "good", "{lab}'s live demo dazzles the crowd; sources confirm it was a very good recording"),
  h("demoOk", "good", "{model} demo goes off without a hitch. The hitch was in rehearsal"),
  h("demoOk", "good", "Demo Stage packed; audience impressed by the lighting, mostly"),
  h("demoFail", "bad", "{lab}'s live demo freezes; presenter blames 'the Wi-Fi', then 'the sun'"),
  h("demoFail", "bad", "Demo agent politely declines to demo, citing 'vibes'"),
  h("demoFail", "bad", "{model} asked to demo; drafts a strongly worded memo instead"),
  h("demoFail", "bad", "Live demo crashes at 'Hello'; audience applauds the honesty"),
  h("investorPays", "good", "{name}, a Very Serious Investor, visits {lab}, 'gets it', and wires {amount} before anyone explains"),
  h("investorPays", "good", "Investor {name} tours {lab}, nods at a GPU, and leaves a {amount} term sheet"),
  h("investorPays", "good", "{name} of a Fund With Lore commits {amount}; asks whether the demo was pre-recorded, decides not to know"),

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

  // Protesters at the gate (fires every week or so while there are a few).
  h("protest", "joke", "Protesters outside {lab} chant 'H2O LIES'; a passing pigeon joins in"),
  h("protest", "joke", "Protest at {lab}'s gate now has snacks, a playlist, and a permit that may be forged"),
  h("protest", "joke", "Crowd outside {lab} demands transparency; {lab} responds with a 90-slide deck about transparency"),
  h("protest", "joke", "Local coffee shop offers protesters a loyalty card; protesters accept, pending further outrage"),
  h("protest", "joke", "Man holding 'MY GPU DRANK MY LATTE' sign explains it is a metaphor, and also his latte"),
  h("protest", "joke", "Analysts call the protests 'bullish': they prove people know {lab} exists"),
  h("protest", "bad", "{lab} spokesperson says water use is 'well within the range of things we won't discuss'"),
  h("protest", "joke", "Drone footage shows the crowd at {lab}'s gate, unintentionally, forming a very sad droplet"),
  h("protest", "joke", "Study finds most of the water in the discourse was recycled from an earlier discourse"),
  h("protest", "joke", "Protesters and researchers share the kombucha queue; nobody brings up the water"),
  h("protest", "joke", "Sign reading 'STOP THE LEAKS' confuses plumbers, who arrive in force"),
  h("protest", "joke", "Hydration influencer livestreams from {lab}'s gate; views up, hydration unchanged"),
  h("protest", "bad", "Drum circle at {lab}'s gate enters its third hour; the rhythm section requests a raise"),

  // The scenario ending: "won" and "lost" are used for the outcome card and the ticker.
  h("won", "good", "{lab} hits every milestone; board celebrates by raising the milestones"),
  h("lost", "bad", "{lab} pivots to selling AI-generated NFTs of its own GPUs"),

  // Success is its own kind of trouble.
  h("highHype", "good", "{lab} hype at an all-time high; three people quit to start competing labs before lunch"),
  h("highHype", "good", "Line outside {lab}'s gate; nobody knows why, everyone brought a resume"),
  h("highHype", "good", "Hype cycle reaches 'peak of inflated expectations'; management enters a sabbatical"),
];

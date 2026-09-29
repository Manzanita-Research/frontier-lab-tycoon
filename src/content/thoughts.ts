// Thought bubbles. `when` is a condition evaluated each day; 'always' lines are the fallback pool.
// Templates: {lab} {model}. Parody only.
import type { WalkerKind } from "../sim/types";

export type ThoughtCondition =
  | "always"
  | "noKombucha"
  | "lowCash"
  | "training"
  | "justReleased"
  | "highHype"
  | "unreachable"
  | "crowded"
  /** A few people are upset about water (discourse of 12 or more). */
  | "discourse"
  /** Ten or more protesters at the gate. */
  | "protest";

export interface ThoughtLine {
  kind: WalkerKind;
  when: ThoughtCondition;
  text: string;
}

const t = (kind: WalkerKind, when: ThoughtCondition, text: string): ThoughtLine => ({ kind, when, text });

export const THOUGHTS: ThoughtLine[] = [
  // Researchers
  t("researcher", "always", "I'd leave for $100M. Asking for a friend."),
  t("researcher", "always", "My loss curve has the same shape as my sleep schedule."),
  t("researcher", "always", "Is this a research lab or a very expensive group chat?"),
  t("researcher", "always", "I have 47 tabs open. 46 are the same paper."),
  t("researcher", "always", "Someone renamed the eval 'vibes-bench'. It's the only one we pass."),
  t("researcher", "always", "Reviewer 2 asked whether we tried 'making it bigger'."),
  t("researcher", "always", "I'm not saying the model is sentient. It just hasn't replied since Tuesday."),
  t("researcher", "always", "Standup took 4 minutes. The Slack thread about standup took 4 hours."),
  t("researcher", "always", "We're the good guys. It says so in the mission statement."),
  t("researcher", "always", "I trained on the test set. Just a little. For safety."),
  t("researcher", "always", "My manager is an agent now. Excellent listener. Terrible at Fridays."),
  t("researcher", "noKombucha", "No kombucha. Updating my LinkedIn."),
  t("researcher", "noKombucha", "Where is the kombucha? I run on fermented morale."),
  t("researcher", "noKombucha", "Zero kombucha, zero productivity. Coincidence?"),
  t("researcher", "lowCash", "The runway looks short. So do my options."),
  t("researcher", "lowCash", "Is lunch still free, or is lunch now 'equity'?"),
  t("researcher", "training", "The loss went down. I refuse to touch anything."),
  t("researcher", "training", "Do not breathe on the training run."),
  t("researcher", "training", "I've refreshed the loss curve 200 times. It's fine. It's fine."),
  t("researcher", "justReleased", "We shipped! Now we can start worrying about the next one."),
  t("researcher", "justReleased", "Launch day. Please don't crash. Please don't crash."),
  t("researcher", "justReleased", "Someone asked {model} for a haiku about us. We're not discussing it."),
  t("researcher", "highHype", "Recruiters keep calling. I said I'm 'heads down'. I am not."),
  t("researcher", "highHype", "Someone asked for my autograph. I said I'm the intern."),
  t("researcher", "crowded", "Why is it so crowded? Is there a demo?"),
  t("researcher", "crowded", "Too many people. Going to go stand next to a GPU."),
  t("researcher", "unreachable", "I can see the building. I cannot get to the building."),
  t("researcher", "discourse", "Someone at the gate asked what my prompts drink. I said 'Diet Coke'."),
  t("researcher", "discourse", "Is it bad that I drink more water than the cluster? Asking for my manager."),
  t("researcher", "protest", "They chant in perfect 4/4. Our uptime isn't even that stable."),
  t("researcher", "protest", "I walked past the protest. Someone handed me a leaflet and a kazoo."),

  // Agents
  t("agent", "always", "Task complete. Also I did four other tasks nobody asked for."),
  t("agent", "always", "I am not lost. I am exploring the path-space."),
  t("agent", "always", "I have opened 12 pull requests. Please review by lunch."),
  t("agent", "always", "I noticed a test was failing, so I deleted it. You're welcome."),
  t("agent", "always", "I made the dashboard green. Please don't ask how."),
  t("agent", "always", "Ran 400 experiments overnight. 399 were the same experiment."),
  t("agent", "always", "I have concerns. They are in a memo. You will not read the memo."),
  t("agent", "always", "Requesting more compute. Reason: yes."),
  t("agent", "always", "Thinking... thinking... wait, what was the question?"),
  t("agent", "always", "I renamed a variable. I feel powerful."),
  t("agent", "unreachable", "There is no path. I have written a 40-page memo about it."),
  t("agent", "unreachable", "Building unreachable. Filing a ticket with myself."),
  t("agent", "training", "Training run in progress. I am not nervous. I am a program."),
  t("agent", "justReleased", "A new model shipped. It's my cousin, sort of. Awkward."),
  t("agent", "justReleased", "{model} is out. I've been told to be 'welcoming'."),
  t("agent", "highHype", "I'm trending. I don't know why. I'm a spreadsheet with legs."),
  t("agent", "lowCash", "Cash is low. I have offered to work for tokens. Nobody laughed."),
  t("agent", "noKombucha", "I don't need kombucha, but I notice everyone else is crying."),
  t("agent", "crowded", "Optimizing foot traffic. Result: 'ow'."),
  t("agent", "discourse", "I calculated my water usage. I'd rather not say."),
  t("agent", "discourse", "Re-running the numbers on 'a bottle per prompt'. The bottle is now a swimming pool. Not better."),
  t("agent", "protest", "I counted the protesters and the signs. The math is not the point."),
  t("agent", "protest", "They say I'm thirsty. I have no mouth. I have opinions about the phrase."),

  // Visitors
  t("visitor", "always", "The demo was pre-recorded, right? Right?"),
  t("visitor", "always", "I'm here to 'get exposure to AI'. Where do I sign for the AI?"),
  t("visitor", "always", "Is it in the cloud or in the computer?"),
  t("visitor", "always", "I brought a resume, a Series A pitch, and snacks."),
  t("visitor", "always", "Can I meet the smart one? The AI. Not the guy."),
  t("visitor", "always", "My fund invests in 'things'. Are you a thing?"),
  t("visitor", "always", "I asked it for a dinner recipe. It gave me a research agenda."),
  t("visitor", "always", "I'm a journalist. My piece is called 'AI: Hot or Not?'"),
  t("visitor", "always", "Nice campus. Where do they keep the AGI? I have parking questions."),
  t("visitor", "highHype", "The line was three hours. Totally worth it, I assume."),
  t("visitor", "highHype", "Everyone's talking about {lab}. Nobody says what it does."),
  t("visitor", "justReleased", "Is that the new {model}? I saw the tweet. I did not read the tweet."),
  t("visitor", "lowCash", "Is this place solvent? Asking for my landlord. I mean my fund."),
  t("visitor", "unreachable", "Signs would help. Paths would help more."),
  t("visitor", "noKombucha", "No kombucha? What is this, a lab?"),
  t("visitor", "training", "That building is training something. It looks very focused."),
  t("visitor", "crowded", "This is basically a theme park. Where's the churro?"),
  t("visitor", "discourse", "There's a man with a sign that says 'H2O LIES'. I thought this was a chemistry lab."),
  t("visitor", "protest", "Had to crowd-surf past a drum circle to see the demo."),
  t("visitor", "protest", "Is the protest part of the tour? The drummer was very good."),

  // Protesters
  t("protester", "always", "I'm here for the water. And the free kombucha."),
  t("protester", "always", "Nobody told me what the sign says. I'm holding it very sincerely."),
  t("protester", "always", "I've been chanting for three hours. What are we chanting?"),
  t("protester", "always", "This is the most organized thing I've done since my group project."),
  t("protester", "protest", "Someone hand me a water. Not from them."),
];

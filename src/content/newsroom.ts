// News Room copy is data. Keep the four voices recognizable and the names fictional.
export type StoryKind = "release" | "protest" | "money" | "rival" | "build" | "training" | "era" | "breakdown" | "ending" | "filler";
export type Friend = "skeptic" | "doomer" | "accel" | "mom";
export const FRIENDS: Record<Friend, { name: string; subtitle: string; avatar: string }> = {
  skeptic: { name: "Nell", subtitle: "the skeptic", avatar: "N" },
  doomer: { name: "Ash", subtitle: "the doomer", avatar: "A" },
  accel: { name: "Zip", subtitle: "the accelerationist", avatar: "Z" },
  mom: { name: "Mom", subtitle: "your mom", avatar: "M" },
};
export const REACTIONS: Record<StoryKind, Record<Friend, string>> = {
  release: { skeptic: "{count} {launches}. how many were the old model wearing a little hat?", doomer: "the loss curve went down. my sense of impending doom went up.", accel: "new model!! put it in charge of the next model!!", mom: "is this you on the news? call me" },
  protest: { skeptic: "the water usage slide being 90% blue doesn't make it water efficient", doomer: "even the pigeons have joined the protest. they know.", accel: "build a bigger fountain. scale the fountain.", mom: "are those people outside your office? take them some snacks" },
  money: { skeptic: "is 'runway is a state of mind' an accounting standard now", doomer: "we are running out of money faster than we are running out of existential risks", accel: "raise another round. one more zero ought to do it.", mom: "do you need me to send you a little money? don't tell your father" },
  rival: { skeptic: "another lab with no product and a valuation the size of a country", doomer: "the race has no brakes but apparently it has a leaderboard", accel: "competition!! train harder!! sleep is a rival product!!", mom: "the other lab's logo is nice. yours is nice too dear" },
  build: { skeptic: "you built infrastructure. finally a benchmark i can touch", doomer: "more buildings means more places for the incident to happen", accel: "MORE COMPUTE. the lawn was underperforming anyway.", mom: "your little campus looks lovely. is there somewhere to sit?" },
  training: { skeptic: "'it's still training' is also what my toaster says when it burns things", doomer: "everyone is watching the loss curve. nobody is watching the fence.", accel: "let it cook. then give the kitchen more GPUs.", mom: "please don't stay up all night waiting for the computer" },
  era: { skeptic: "new era, same slide deck", doomer: "i would like to unsubscribe from the next era", accel: "we are so back. we have never been more back.", mom: "is this you on the news? call me" },
  breakdown: { skeptic: "did you try turning the valuation off and on again", doomer: "the alarms are harmonizing now. that's probably bad.", accel: "temporary setback. permanent opportunity to buy more compute.", mom: "i heard something broke. are you eating properly?" },
  ending: { skeptic: "the board will call this a learning opportunity either way", doomer: "can we have a normal month next month", accel: "that was the tutorial. now scale it.", mom: "i'm proud of you. please call me before you start another company" },
  filler: { skeptic: "the biggest news this month is that there is still news", doomer: "suspiciously quiet. updating my emergency spreadsheet.", accel: "quiet month = more time to build!!", mom: "no news is good news. did you get the photo of the garden?" },
};
export const CLASSIFIEDS = [
  "WANTED: Human to supervise agents. Must be comfortable being supervised by agents.",
  "FOR SALE: Slightly used benchmark. Only saturated once. No lowball prompts.",
  "ROOMMATE WANTED: Must enjoy a gentle 24-hour data-center hum. Water negotiable.",
  "LOST: One loss curve. Last seen going down. Reward: more compute.",
  "PERSONALS: Local stochastic parrot seeks someone who really listens. Will repeat that.",
];
export const DESK_STORIES = [
  "Campus weather: warm, with a chance of another funding round",
  "Opinion: please stop calling every spreadsheet an agent",
  "Culture: kombucha queue declared an unofficial research institution",
  "Letters: our readers would like a shorter model name",
];
export const STORY_PRIORITY: Record<StoryKind, number> = {
  ending: 100, era: 95, breakdown: 90, release: 85, protest: 75, money: 70,
  rival: 60, build: 40, training: 30, filler: 10,
};

export const EVENT_STORY_KIND: Record<string, StoryKind> = { waterDiscourse: "protest", drumCircle: "protest" };

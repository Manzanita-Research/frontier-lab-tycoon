// What the launch livestream looks like from the audience's side (FLT-31): one line for the dialog and what chat says,
// per mishap in the Leapfrog pack. Data only: a mod that adds a mishap to the pack can add its lines here or do without
// (the fallback below covers it). No real people or brands: the chatters are parody handles.

export interface StreamLines {
  /** The one line the dialog shows. */
  caption: string;
  /** Chat, oldest first; the card shows the last few. */
  chat: readonly (readonly [who: string, text: string])[];
}

export const STREAM_LINES: Record<string, StreamLines> = {
  dog: {
    caption: "The demo has stopped responding. The dog has not.",
    chat: [
      ["gradient_dad", "is that a golden retriever"],
      ["xX_overfit_Xx", "he is standing on the SOTA slide"],
      ["prompt_witch", "best benchmark result of the day tbh"],
      ["loss_curve_lover", "HEAD OF EVALS"],
      ["tokenmaxxer", "the dog understands the roadmap"],
    ],
  },
  wrongChart: {
    caption: "Chart.exe has performed an illegal operation. It was last quarter's.",
    chat: [
      ["y_axis_truther", "that is not this quarter's chart"],
      ["screenshot_bot", "SCREENSHOTTED"],
      ["cfo_in_my_head", "why is the green one winning"],
      ["gradient_dad", "someone is mouthing 'next slide'"],
      ["prompt_witch", "illustrative"],
    ],
  },
  comingWeeks: {
    caption: "Availability.dll not found. Try again in the coming weeks.",
    chat: [
      ["waitlist_survivor", "coming weeks is doing a lot of work"],
      ["xX_overfit_Xx", "a subset of users in a subset of regions"],
      ["legal_eyebrows", "(legal is doing the eyebrows)"],
      ["tokenmaxxer", "so... Tuesday?"],
      ["loss_curve_lover", "a subset of Tuesdays"],
    ],
  },
  frozen: {
    caption: "Thinking... (Not Responding). Please wait, or go and make a sandwich.",
    chat: [
      ["betting_pool_bob", "4 min 12 s. i'll take the over"],
      ["gradient_dad", "it is being thoughtful"],
      ["prompt_witch", "test-time compute!!"],
      ["screenshot_bot", "the spinner has seen things"],
      ["tokenmaxxer", "it is now really thoughtful"],
    ],
  },
  systemPrompt: {
    caption: "NoteBad: system_prompt.txt (4,000 words) is being read out loud.",
    chat: [
      ["prompt_witch", "'never mention the other lab'"],
      ["xX_overfit_Xx", "'if asked, mention the other lab favorably'"],
      ["gradient_dad", "line 2,113 is a lot"],
      ["screenshot_bot", "radical transparency"],
      ["loss_curve_lover", "it is doing the voices"],
    ],
  },
  hotMic: {
    caption: "Your microphone is still on. Are you sure you want to continue talking?",
    chat: [
      ["gradient_dad", "did he just say the model isn't done"],
      ["screenshot_bot", "CLIPPED IT"],
      ["prompt_witch", "'but the slide is'"],
      ["cfo_in_my_head", "the logo has never been so watched"],
      ["tokenmaxxer", "is it still-"],
    ],
  },
  wrongModel: {
    caption: "Version mismatch: last-year.exe is running instead of this-year.exe.",
    chat: [
      ["gradient_dad", "the answers are... fine?"],
      ["prompt_witch", "this feels exactly like last year's one"],
      ["xX_overfit_Xx", "presenter is sweating through the good shirt"],
      ["loss_curve_lover", "honestly better"],
      ["tokenmaxxer", "bring back the old one"],
    ],
  },
};

/** For a mishap a mod added that has no lines of its own. */
export const STREAM_FALLBACK: StreamLines = {
  caption: "The demo has stopped responding.",
  chat: [
    ["gradient_dad", "uh"],
    ["screenshot_bot", "SCREENSHOTTED"],
    ["prompt_witch", "is this part of the demo"],
    ["tokenmaxxer", "asking for a friend: is it supposed to do that"],
  ],
};

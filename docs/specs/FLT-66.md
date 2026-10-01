# FLT-66: Music follows game speed

Kind: explore. Copied from the FLT-66 task description.

**Music follows the game speed** (Jem loves the first pass). Run it after the ship train.

**The feel per speed** (not literal BPM multiples):
- **Pause:** a calm held pad or a hush.
- **1× ("walkies"):** today's calm music.
- **3×:** busier: more percussion and a faster feel.
- **Top speed ("zoomies"):** it should feel like working at a frontier lab right now, 996-style, manic hyperpop:
  - pitched-up vocal chops (synthesised or generated in-house, with no third-party samples);
  - glitchy drums and sidechain pumping;
  - a faster tempo;
  - a notification *ping* in the mix.

  It should be funny, not stressful.

**Rules:**
- Switching speed crossfades or ramps **on the next bar**, never a hard cut.
- Respect volume and mute.
- Skins keep their own flavour (Frontier 95's MIDI-ish take on zoomies, and so on).
- No CPU spikes: measure main-thread audio cost at each speed.

**Show-and-tell:** a short audio clip or screen recording at each speed plus one transition, rendered with OfflineAudioContext to WAV, attached to the task.

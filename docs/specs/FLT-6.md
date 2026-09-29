# FLT-6: Juice I: camera director, particles, day/night, photo mode

_Copied verbatim from the FLT-6 task description (`bb tasks show FLT-6`) so the spec travels with the PR. Label: explore._

**Slice 1 · Juice I · Sonnet 5.5 builder · runs alongside FLT-8 after FLT-4 merges (render and UI only)**

**Screenshot moment:** photo mode. The HUD disappears, tilt-shift blur turns the campus into a real-looking miniature, and the saved PNG carries a tiny "Frontier Lab Tycoon · {lab} · Y1 Mar 4" stamp.

**Build (it owns `src/render/fx/**`, the camera, lighting and `src/ui/juice/**`; it reads sim state and never changes sim rules)**
- **Camera director:**
  - Eases to where the action is (event card → the gate; model release → the Training Hall), then eases back.
  - `shake(strength)`: small for placing, big for incidents.
  - WASD and edge-scroll, double-click to focus, pinch-zoom on phones.
- **Particles** (one pooled instanced system, cap 2,000):
  - confetti on a release
  - a coin fountain on big revenue days
  - smoke puffs from clusters running over capacity
  - water droplets over protesters
  - a faint cyan sparkle trail behind agents
  - dust on placing or bulldozing
- **Day/night:** one cycle per 10 game days. Windows glow at night, path lamps come on, stars appear. It's a gentle tint, never dark enough to hurt readability. Add a night-only thought pool hook: "It's 2am. Still shipping."
- **Micro-animations:**
  - Buildings idle-breathe. Cluster fan speed follows utilisation. The dome ring pulses. The gateway sign flickers when it earns. Flags wave.
  - Walkers bob, look around when idle, and on a model release **the whole crowd hops and cheers**.
- **UI juice:**
  - An odometer roll for cash and stats, and a flash on change.
  - Buttons squish when pressed. Event cards slam in with a slight tilt. Toasts slide in.
- **Photo mode** (P key or a camera button):
  - Hides the HUD. Applies tilt-shift plus a saturation bump via `@react-three/postprocessing`; check it supports R3F 9 and three 0.180 first, since it's the one justified dependency.
  - Saves a PNG with the stamp. Postprocessing is active **only** in photo mode.

**Done when:** `pnpm check` is green, with no frame-rate regression when photo mode is off. The PR has 4 screenshots (photo-mode miniature, night campus, release hop with confetti, phone) plus a short screen recording or GIF if feasible, and a preview link posted here.

# Trailer tooling (FLT-97)

A commercial for the game, cut from real footage on a 1-vCPU box with no GPU. Four steps, each its own script. Everything they make goes in `shots/trailer/` (gitignored): never commit a video.

| Step | Script | Makes |
|---|---|---|
| Footage | `capture.mjs` | `shots/trailer/clips/<name>.mp4`, 1920×1080 at 30 fps, frame-stepped (smooth however slow the renderer is) |
| Music | `music.mjs` | `shots/trailer/music/*.wav`, the game's own Band rendered offline |
| Voice | `voice.mjs` | `shots/trailer/voice/<name>.{mp3,json}`, a Fal TTS read with word timestamps, cached and costed in `ledger.csv` |
| Edit | `edit.mjs` | `shots/trailer/out/<cut>.mp4`, H.264 + AAC, captions burned in, music ducked under the voice, -14 LUFS |

The captures use staging links only (`?moment=`, `?seed=`, `/box?beat=`) in a fresh browser context, so no real autosave is ever read or written. Run one browser at a time.

## Make the TV spot from scratch

```sh
node scripts/trailer/capture.mjs                     # every shot in shots.json (~15 min); --only box-pick2,bsod for some
node scripts/trailer/music.mjs --takes zoomies@0 --seconds 42 --out shots/trailer/music/zoomies-f95-42.wav
node scripts/trailer/voice.mjs --name final-brian --voice Brian --stability 0.3 --file scripts/trailer/cuts/final-brian.txt
node scripts/trailer/edit.mjs scripts/trailer/cuts/final.json --preset medium                     # 16:9
node scripts/trailer/edit.mjs scripts/trailer/cuts/final.json --size 1080x1920 --preset medium    # 9:16
```

`voice.mjs` needs `FAL_KEY` (never print it) and costs about $0.10 per 1,000 characters. It caches by its inputs, so the same script and voice never pay twice. `node scripts/trailer/voice.mjs --ledger` prints what has been spent.

The drafts are in `cuts/` too:
- `tvad.json` (Brian): the 1997 TV spot the final grew from.
- `infomercial.json` (Eric): uses `fetch-f95.wav`, 30 s of `fetch@0`.
- `trailer.json` (Bill): uses `nap-zoomies-f95.wav`, `nap@0,zoomies@15.2` for 30 s, where the drop lands at 16 s.

Each draft's read is in `cuts/<name>.txt`.

## Notes

- **Box intro beats:** `/box?beat=shelf` plus `window.__intro.send({ type: "PICK" | "TURN", by | "FLIP" | "OPEN" | "INSERT" })` on a shot's `actions`. The `"@box"` css preset hides the buttons and captions.
- **Voices:** stock library voices only. No cloning, and no sound-alikes of anyone.
- **Timing a cut:** print the voice's word times (they're in `<name>.json`, plus the voice's `at`) and put each cut on a word.
- **Zooms:** a segment's `zoom` + `at` pushes in on a point.
- **Portrait and square cuts:** a `portrait` block on a segment or card overrides it for a 9:16 or 1:1 cut. Use `fit: "cover"` for 3D shots, and `scale: 1.8` (a HUD window cropped around `at`) for UI.
- **Size:** the VHS look is noisy, so a 36 s master is ~50 MB, well under X's 512 MB. Re-encode at ~5 Mbps for anything with a 25 MB limit.

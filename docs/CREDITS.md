# Credits

Third-party code and art that ship in the game, and the work that inspired it. Fonts carry their own licence files next to them (see each skin's `skin.json`, `fonts[].licenseFile`).

## Code

| What | Where | Author | Licence |
|---|---|---|---|
| **crt-shader** 1.0.1: the CRT pipeline (downsample, horizontal, vertical and optics stages), its presets and its pmndrs postprocessing adapter. Ported to TypeScript for three 0.180 and postprocessing 6.39 in FLT-73. The game added ACES tone mapping and sky compositing to the prepare stage and a curved tube (barrel, vignette, rounded corners) to the optics stage. | `src/render/crt/` (`shaders.ts`, `presets.ts`, `pipeline.ts`, `pass.ts`) | Brooklyn ([OutThisLife](https://github.com/OutThisLife)), [OutThisLife/crt-shader](https://github.com/OutThisLife/crt-shader) | MIT: [`src/render/crt/LICENSE`](../src/render/crt/LICENSE), attribution in [`NOTICE.md`](../src/render/crt/NOTICE.md) |

The lite tier (`src/render/crt/lite.ts`), the frame-time governor, the CSS tube (`src/ui/juice/crt.css`) and the looks are the game's own. They are tuned to match the shader above.

## Inspiration

- Datagubbe, [The Effect of CRTs on Pixel Art](https://datagubbe.se/crt/) and [The Peach meme: On CRTs, pixels and signal quality (again)](https://datagubbe.se/crt2/). crt-shader's author credits these articles for the look. They are references, not the source of any code here, and their author has not endorsed this game.

# Attribution and provenance

**Implementation and package:** Brooklyn ([OutThisLife](https://github.com/OutThisLife)). Original project code is offered under the accompanying MIT license.

**Article inspiration:** Datagubbe, [The Effect of CRTs on Pixel Art](https://datagubbe.se/crt/) and [The Peach meme: On CRTs, pixels and signal quality (again)](https://datagubbe.se/crt2/). These explain the effects of display hardware, signal quality and pixel-art technique. The articles are references, not the source of a shader implementation, and this package is not endorsed by their author.

The reference preset was visually developed against a photographed example discussed in those articles. It is an artistic reconstruction, not a calibrated simulation of every CRT, and the shader never samples the reference photograph. Source-specific photographic blur and calibration are not universal hardware properties.

The library's shader programs and frozen presets were extracted unchanged from this project's earlier private CRT study. The original calibration material, game sprites, photographs and other third-party gallery assets are not included in this distribution. This MIT license does not relicense those materials or the articles.

React, Three.js, pmndrs postprocessing and React Three Fiber are separately licensed optional dependencies, not copied into the library payload. Preserve their notices when bundling them. The examples use procedural artwork created for this project.

When copying or porting the shaders, retain the copyright/license notice and this attribution. Keep the article inspiration credit distinct from implementation authorship; do not imply the authors endorse your port. MIT does not require a visible product badge.

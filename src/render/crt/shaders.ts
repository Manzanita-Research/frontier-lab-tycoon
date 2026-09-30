/*
 * The CRT pipeline's GLSL, ported from crt-shader 1.0.1 (https://github.com/OutThisLife/crt-shader, packages/crt-shader).
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Brooklyn (OutThisLife). See ./LICENSE and ./NOTICE.md, which travel with this port.
 * Article inspiration: https://datagubbe.se/crt/ and https://datagubbe.se/crt2/
 *
 * `vertex`, `horizontal` and `vertical` are upstream's, unchanged. The FLT changes are marked `FLT:` and are all at the
 * ends of the chain, so the reconstruction itself is the upstream one:
 * - `prepare` can apply the renderer's ACES filmic tone mapping to the scene's linear pixels before it encodes them,
 *   which folds the tone mapping pass into a stage the pipeline already runs;
 * - `optics` reads the picture through a tube: a slight barrel warp (the edges bow, the middle does not move), an
 *   optional vignette and rounded corners (off on the main screen, where the CSS tube layer draws them over the DOM
 *   too; on for a monitor texture such as FLT-70's beige PC).
 */

// Preserved verbatim from the approved Article crisp renderer.
export const vertex = `#version 300 es
in vec2 a_position; out vec2 uv;
void main(){uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;

const common = `#version 300 es
precision highp float;
in vec2 uv; out vec4 frag;
uniform sampler2D tex; uniform vec2 sourceSize; uniform vec2 outputSize; uniform vec2 viewOrigin; uniform vec2 viewSize;
uniform float spread,bleed,gamma,beam,bloom,glow,focus,mask,exposure,bypass;
uniform float outputGamma,cameraBlur,blackLevel,redGain,greenGain,blueGain,maskPitch,maskPhase,slot,slotPhase,maskSlant,beamTilt,rg,rb,gr,gb,br,bg,maskWarp;
float gaussian(float d,float s){return exp(-.5*d*d/(s*s));}
vec3 sampleBlack(vec2 p){if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,vec2(1.)))) return vec3(0.);return texture(tex,p).rgb;}
`;

export const horizontal = common + `
void main(){
 float x=uv.x*viewSize.x+viewOrigin.x-.5; float base=floor(x);
 vec3 color=vec3(0.);float light=0.,wl=0.,wc=0.;
 for(int i=-7;i<=7;i++){
  float at=base+float(i),d=at-x;
  vec3 s=pow(sampleBlack(vec2((at+.5)/sourceSize.x,uv.y)),vec3(gamma));
  float l=dot(s,vec3(.2126,.7152,.0722));
  float a=gaussian(d,spread), b=gaussian(d,spread+bleed);
  light+=l*a;wl+=a;color+=(s-vec3(l))*b;wc+=b;
 }
 frag=vec4(max(vec3(light/max(wl,.0001))+color/max(wc,.0001),vec3(0.)),1.);
}`;

export const vertical = common + `
void main(){
 float pixelScale=outputSize.x/viewSize.x;
 float y=(1.-uv.y)*viewSize.y+viewOrigin.y-.5-beamTilt*uv.x*outputSize.x*viewSize.y/outputSize.y,base=floor(y); vec3 c=vec3(0.);
 for(int j=-3;j<=3;j++){
  float row=base+float(j);vec3 s=sampleBlack(vec2(uv.x,1.-(row+.5)/sourceSize.y));
  // Width grows with signal intensity; integral stays constant as it widens.
  vec3 width=vec3(beam)+bloom*sqrt(max(s,vec3(0.)));
  vec3 d=vec3(y-row)/width;
  c+=s*exp(-.5*d*d)/(2.506628*width);
 }
 float cell=mod(floor(gl_FragCoord.x),3.);
 vec3 grille=cell<1.?vec3(1.,1.-mask,1.-mask):cell<2.?vec3(1.-mask,1.,1.-mask):vec3(1.-mask,1.-mask,1.);
 if(maskPitch>0.){
  float wave=(gl_FragCoord.x+maskSlant*(outputSize.y-gl_FragCoord.y))/(maskPitch*pixelScale)+maskWarp*uv.x*uv.x;
  vec3 phase=wave+maskPhase-vec3(0.,1./3.,2./3.);
  vec3 stripes=pow(.5+.5*cos(6.2831853*phase),vec3(2.));
  c*=((1.-mask)+mask*stripes)/(1.-.625*mask);
  float slots=.5+.5*cos(6.2831853*(wave+slotPhase));
  c*=((1.-slot)+slot*slots)/(1.-.5*slot);
 }else c*=grille/(1.-2.*mask/3.);
 frag=vec4(c,1.);
}`;

// FLT: the tube. `curve` bows the picture (x bends with y and y with x, so the middle and the mid-edges stay put and
// only the corners pull in); `vignette` darkens towards the corners the way the CSS layer's radial gradient does
// (linear from `vignetteInner` to the farthest corner, in display-encoded colour, like CSS compositing);
// `corner` rounds the picture's corners (output pixels).
const tube = `
uniform float curve,vignette,vignetteInner,corner;
vec2 tubeWarp(vec2 p){vec2 c=p*2.-1.;c*=1.+curve*c.yx*c.yx;return c*.5+.5;}
float tubeShade(vec2 p){
 vec2 c=p*2.-1.;
 float v=1.-vignette*clamp((length(c)/1.4142136-vignetteInner)/max(1.-vignetteInner,.0001),0.,1.);
 if(corner>0.){vec2 h=outputSize*.5;vec2 d=abs(p*outputSize-h)-(h-corner);v*=clamp(corner-length(max(d,0.))+.5,0.,1.);}
 return v;
}
`;

export const optics = common + tube + `
void main(){
 // FLT: every read below goes through the tube (st instead of upstream's uv).
 vec2 st=tubeWarp(uv);
 if(any(lessThan(st,vec2(0.)))||any(greaterThan(st,vec2(1.)))){frag=vec4(vec3(0.),1.);return;}
 float shade=tubeShade(uv);
 if(bypass>.5){vec2 p=vec2(st.x,1.-st.y)*viewSize+viewOrigin;frag=vec4(sampleBlack(vec2(p.x/sourceSize.x,1.-p.y/sourceSize.y))*shade,1.);return;}
 vec2 pixel=1./viewSize;
 vec3 sharp=texture(tex,st).rgb;
 vec2 f=focus*pixel;
 vec3 soft=sharp*.25;
 soft+=(sampleBlack(st+vec2(f.x,0.))+sampleBlack(st-vec2(f.x,0.))+sampleBlack(st+vec2(0.,f.y))+sampleBlack(st-vec2(0.,f.y)))*.125;
 soft+=(sampleBlack(st+f)+sampleBlack(st-f)+sampleBlack(st+vec2(f.x,-f.y))+sampleBlack(st+vec2(-f.x,f.y)))*.0625;
 vec2 g=pixel*1.1;
 vec3 halo=(sampleBlack(st+vec2(g.x,0.))+sampleBlack(st-vec2(g.x,0.))+sampleBlack(st+vec2(0.,g.y))+sampleBlack(st-vec2(0.,g.y)))*.25;
 if(cameraBlur>0.){
  soft=vec3(0.);float total=0.;
  vec2 tap=cameraBlur*(outputSize.x/viewSize.x)/(1.2*outputSize);
  for(int j=-3;j<=3;j++)for(int i=-3;i<=3;i++){
   float w=exp(-.5*float(i*i+j*j)/(1.2*1.2));soft+=sampleBlack(st+vec2(float(i),float(j))*tap)*w;total+=w;
  }
  soft/=total;
 }
 vec3 c=(soft+halo*glow)*exposure*vec3(redGain,greenGain,blueGain);
 c=max(vec3(dot(c,vec3(1.,rg,rb)),dot(c,vec3(gr,1.,gb)),dot(c,vec3(br,bg,1.))),vec3(0.));
 // Gentle highlight shoulder, preserving most of the original contrast.
 c=c/(1.+max(c-vec3(.8),vec3(0.))*.35);
 frag=vec4((pow(max(c,vec3(0.)),vec3(1./(outputGamma>0.?outputGamma:gamma)))*(1.-blackLevel)+blackLevel)*shade,1.);
}`;

// From upstream's three-pipeline.js.
const transfer = `
vec3 encodeSRGB(vec3 c) {
  c = max(c, vec3(0.));
  return mix(1.055 * pow(c, vec3(1. / 2.4)) - .055, 12.92 * c, lessThanEqual(c, vec3(.0031308)));
}
vec3 decodeSRGB(vec3 c) {
  c = max(c, vec3(0.));
  return mix(pow((c + .055) / 1.055, vec3(2.4)), c / 12.92, lessThanEqual(c, vec3(.04045)));
}`;

// FLT: three's ACESFilmicToneMapping (three 0.180, tonemapping_pars_fragment), so the CRT'd campus has the colours
// the plain canvas has.
const aces = `
uniform bool toneMap;
uniform float toneExposure;
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= toneExposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0., 1.);
}`;

// texelFetch makes input sampling independent of the caller's texture filters.
// Encode before averaging: the frozen pipeline consumes display-encoded pixels.
export const prepare = `precision highp float;
in vec2 uv; out vec4 frag;
uniform sampler2D tex;
uniform bool encodeInput;
${transfer}
${aces}
vec3 readPixel(ivec2 p) {
  vec3 c = texelFetch(tex, clamp(p, ivec2(0), textureSize(tex, 0) - 1), 0).rgb;
  if (encodeInput && toneMap) c = acesFilmic(c);
  return encodeInput ? encodeSRGB(c) : c;
}
void main() {
  vec2 p = uv * vec2(textureSize(tex, 0)) - .5;
  ivec2 base = ivec2(floor(p));
  vec2 f = fract(p);
  frag = vec4(mix(mix(readPixel(base), readPixel(base + ivec2(1, 0)), f.x),
                  mix(readPixel(base + ivec2(0, 1)), readPixel(base + ivec2(1)), f.x), f.y), 1.);
}`;

export const copy = `precision highp float;
in vec2 uv; out vec4 frag;
uniform sampler2D tex;
uniform bool encodeInput, decodeOutput, nearestInput;
${transfer}
void main() {
  ivec2 size = textureSize(tex, 0);
  vec3 c = nearestInput ? texelFetch(tex, min(ivec2(uv * vec2(size)), size - 1), 0).rgb : texture(tex, uv).rgb;
  if (encodeInput) c = encodeSRGB(c);
  if (decodeOutput) c = decodeSRGB(c);
  frag = vec4(c, 1.);
}`;

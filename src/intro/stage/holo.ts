// FLT-95: the hologram maths the COA's foil (FLT-70) and the disc share, as GLSL to paste into a fragment shader.
// `grating` treats a surface as a diffraction grating: light from L leaves toward V in wavelength d·|(L+V)·g|/m, where
// g runs across the grooves (in the surface), d is their spacing and m the order.
export const HOLO = /* glsl */ `
// Zucconi's fit of the visible spectrum: a wavelength in nm to linear RGB, black outside 400..700.
vec3 bump3y(vec3 x, vec3 y0) { return clamp(1.0 - x * x - y0, 0.0, 1.0); }
vec3 spectral(float nm) {
  float x = (nm - 400.0) / 300.0;
  return bump3y(vec3(3.54541723, 2.86670055, 2.29421995) * (x - vec3(0.69548916, 0.49416934, 0.28269708)), vec3(0.02320775, 0.15936245, 0.53520021));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Light from L sent toward V by grooves d nm apart, running across g. Orders 1 to 3; off the plane of g it only
// shines near the mirror angle, within 'spread'.
vec3 grating(vec3 L, vec3 V, vec3 N, vec3 g, float d, float spread) {
  vec3 S = L + V;
  float u = abs(dot(S, g)) * d;
  float across = dot(S, cross(N, g));
  vec3 c = spectral(u) + 0.7 * spectral(u * 0.5) + 0.45 * spectral(u / 3.0);
  return c * exp(-across * across / spread) * smoothstep(0.0, 0.25, dot(N, L));
}

// A direction in the surface (x across, y up) as a view-space vector.
vec3 inPlane(vec2 d, vec3 T, vec3 B) { d = normalize(d); return d.x * T + d.y * B; }
`;

/** The vertex shader both use: view-space position, normal and the surface's own x and y, for the lamps and `inPlane`. */
export const SURFACE_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
  vB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * mv;
}`;

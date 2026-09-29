import * as THREE from "three";

export const CREAM = "#f7eed6";
export const CREAM_DARK = "#e5d6b0";
export const INK = "#3a2a1c";

export const FONT_STACK = `ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif`;

export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 24);
export const sphereGeo = new THREE.SphereGeometry(1, 20, 14);

const standard = new Map<string, THREE.MeshStandardMaterial>();
/** Shared, cached toy-plastic material. Don't mutate it. */
export function std(color: string, roughness = 0.78): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}`;
  let m = standard.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02, flatShading: true });
    standard.set(key, m);
  }
  return m;
}

/** Unlit, untone-mapped: reads as glowing against the lit scene. */
export function glow(color: string, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
}

export const ghostMaterials = {
  ok: new THREE.MeshStandardMaterial({ color: "#5fe08a", transparent: true, opacity: 0.6, roughness: 1 }),
  bad: new THREE.MeshStandardMaterial({ color: "#ff5d4d", transparent: true, opacity: 0.6, roughness: 1 }),
};

const labels = new Map<string, THREE.CanvasTexture>();

/** Text on a canvas: no font files, no network. */
export function labelTexture(
  text: string,
  { w = 1024, h = 256, bg = "#3a2a1c", fg = "#fff3d0", weight = 800 } = {},
): THREE.CanvasTexture {
  const key = `${text}|${w}|${h}|${bg}|${fg}`;
  const hit = labels.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = h * 0.56;
  const family = FONT_STACK;
  g.font = `${weight} ${size}px ${family}`;
  while (g.measureText(text).width > w * 0.92 && size > 12) {
    size -= 4;
    g.font = `${weight} ${size}px ${family}`;
  }
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  labels.set(key, tex);
  return tex;
}

/** Soft radial blob, used for the agents' ground glow. */
export function glowTexture(color = "#2ee6ff"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color + "e0");
  grad.addColorStop(0.5, color + "70");
  grad.addColorStop(1, color + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

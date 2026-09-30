import * as THREE from "three";
import { FONT_STACK } from "./materials";

/** A placard: colour board, ink border, bold text wrapped to at most three lines. */
export function signTexture(text: string, bg: string): THREE.CanvasTexture {
  const w = 320;
  const h = 180;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#3a2a1c";
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(9, 9, w - 18, h - 18);
  g.fillStyle = "#b3261e";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const words = text.split(" ");
  for (let size = 76; size >= 26; size -= 4) {
    g.font = `900 ${size}px ${FONT_STACK}`;
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > w - 40 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (lines.length * size * 1.08 <= h - 30 && widest <= w - 40) {
      lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.08));
      break;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// The share card (FLT-11): the 1200×630 picture people send to friends. The lab's last Frontier Times front page with
// a photo of their own campus on it, the run in numbers beside it, all in the colours and chrome of the skin they
// played in. Drawn on a 2D canvas from the ending's view-model, so it is exactly what the end screen says.
import type { EndingVM } from "../hud/types";

export const CARD_W = 1200;
export const CARD_H = 630;

/** Where the card takes its colours and type from: the skin's tokens, plus a little per-skin chrome. */
export interface CardTheme {
  skin: string;
  bg: string;
  panel: string;
  panelAlt: string;
  text: string;
  dim: string;
  line: string;
  accent: string;
  accentText: string;
  titlebar: string;
  titlebarText: string;
  display: string;
  ui: string;
  numbers: string;
  radius: number;
  border: number;
}

export function cardTheme(skin: string, tokens: Readonly<Record<string, string>>): CardTheme {
  const t = (k: string, fallback: string) => tokens[k] ?? fallback;
  return {
    skin,
    bg: t("color.bg", "#8fd0ee"),
    panel: t("color.panel", "#fff3d6"),
    panelAlt: t("color.panelAlt", "#ffe8b8"),
    text: t("color.text", "#3a2a1c"),
    dim: t("color.textDim", "#7a6650"),
    line: t("color.line", "#3a2a1c"),
    accent: t("color.accent", "#ff8a4c"),
    accentText: t("color.accentText", "#3a2a1c"),
    titlebar: t("color.titlebar", "#ffe8b8"),
    titlebarText: t("color.titlebarText", "#3a2a1c"),
    display: t("font.display", "system-ui, sans-serif"),
    ui: t("font.ui", "system-ui, sans-serif"),
    numbers: t("font.numbers", "system-ui, sans-serif"),
    radius: Math.min(22, parseFloat(t("radius.panel", "16")) || 0),
    border: Math.min(4, parseFloat(t("border.width", "3")) || 0),
  };
}

/** The squares of the run's era strip, as colours (canvas emoji depend on the machine's fonts; squares don't). */
const SQUARES: Record<string, string> = { "🟦": "#3f7fe0", "🟩": "#3aa655", "🟨": "#f2c318", "🟥": "#e0433a" };

/** Split `text` into lines no wider than `max`, by words; a word too long for a line gets a line of its own. */
export function wrap(text: string, max: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Wrap in at most `maxLines` at the biggest size from `sizes` that fits; the last resort ends in an ellipsis. */
export function fit(text: string, max: number, maxLines: number, sizes: readonly number[], measureAt: (s: string, size: number) => number): { size: number; lines: string[] } {
  for (const size of sizes) {
    const lines = wrap(text, max, (s) => measureAt(s, size));
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes.at(-1)!;
  const lines = wrap(text, max, (s) => measureAt(s, size)).slice(0, maxLines);
  let last = lines[maxLines - 1] ?? "";
  while (last && measureAt(`${last}…`, size) > max) last = last.slice(0, -1);
  lines[maxLines - 1] = `${last.trimEnd()}…`;
  return { size, lines };
}

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A Windows-95 raised bevel. */
function bevel(ctx: Ctx, x: number, y: number, w: number, h: number, inset = false) {
  const [hi, lo] = inset ? ["#808080", "#ffffff"] : ["#ffffff", "#000000"];
  ctx.fillStyle = hi;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = lo;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

/** Each skin's chrome around the paper and the panel. The base (and any skin not listed) gets plain rounded cards. */
interface Chrome {
  /** Paint the background. */
  back(ctx: Ctx, th: CardTheme): void;
  /** Frame the front page; returns the rectangle the paper goes in. */
  paperFrame(ctx: Ctx, th: CardTheme, x: number, y: number, w: number, h: number): [number, number, number, number];
  /** Frame the stats panel; returns the rectangle its contents go in. */
  panelFrame(ctx: Ctx, th: CardTheme, x: number, y: number, w: number, h: number, title: string): [number, number, number, number];
  /** A flourish drawn last, on top. */
  over?(ctx: Ctx, th: CardTheme, e: EndingVM): void;
}

function winFrame(ctx: Ctx, th: CardTheme, x: number, y: number, w: number, h: number, title: string): [number, number, number, number] {
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(x, y, w, h);
  bevel(ctx, x, y, w, h);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "#000080");
  g.addColorStop(1, "#1084d0");
  ctx.fillStyle = g;
  ctx.fillRect(x + 4, y + 4, w - 8, 26);
  text(ctx, title, x + 12, y + 23, `bold 16px ${th.ui}`, "#ffffff");
  for (let i = 0; i < 3; i++) {
    const bx = x + w - 26 - i * 24;
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(bx, y + 8, 20, 18);
    bevel(ctx, bx, y + 8, 20, 18);
    text(ctx, ["×", "□", "_"][i]!, bx + 10, y + 22, `bold 14px ${th.ui}`, "#000000", "center");
  }
  bevel(ctx, x + 6, y + 34, w - 12, h - 40, true);
  return [x + 8, y + 36, w - 16, h - 44];
}

const CHROME: Record<string, Chrome> = {
  "frontier-95": {
    back(ctx, th) {
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      // The taskbar, with its clock.
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(0, CARD_H - 30, CARD_W, 30);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, CARD_H - 30, CARD_W, 2);
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(4, CARD_H - 26, 78, 22);
      bevel(ctx, 4, CARD_H - 26, 78, 22);
      for (const [i, c] of ["#e00000", "#00a000", "#0000e0", "#e0c000"].entries()) {
        ctx.fillStyle = c;
        ctx.fillRect(10 + (i % 2) * 7, CARD_H - 21 + Math.floor(i / 2) * 7, 6, 6);
      }
      text(ctx, "Start", 28, CARD_H - 10, `bold 15px ${th.ui}`, "#000000");
      bevel(ctx, CARD_W - 110, CARD_H - 26, 106, 22, true);
      text(ctx, "4:20 PM", CARD_W - 57, CARD_H - 10, `15px ${th.ui}`, "#000000", "center");
    },
    paperFrame: (ctx, th, x, y, w, h) => winFrame(ctx, th, x, y, w, h - 22, "The Frontier Times - Internet Exploder"),
    panelFrame: (ctx, th, x, y, w, h, title) => winFrame(ctx, th, x, y, w, h - 22, title),
  },
  "homepage-98": {
    back(ctx, th) {
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      // A starfield, fixed (the same card every time).
      for (let i = 0; i < 140; i++) {
        const x = (i * 7919) % CARD_W;
        const y = (i * 104729) % CARD_H;
        ctx.fillStyle = i % 5 === 0 ? "#ffff66" : "#ffffff";
        ctx.fillRect(x, y, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
      }
    },
    paperFrame(ctx, _th, x, y, w, h) {
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(x, y, w, h);
      bevel(ctx, x, y, w, h);
      bevel(ctx, x + 6, y + 6, w - 12, h - 12, true);
      return [x + 8, y + 8, w - 16, h - 16];
    },
    panelFrame(ctx, th, x, y, w, h, title) {
      ctx.fillStyle = th.panel;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#000080";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = "#000080";
      ctx.fillRect(x + 8, y + 8, w - 16, 30);
      text(ctx, `~*~ ${title} ~*~`, x + w / 2, y + 30, `bold italic 18px ${th.display}`, "#ffff66", "center");
      // The hit counter, and the sign.
      const cy = y + h - 36;
      ctx.fillStyle = "#000000";
      ctx.fillRect(x + 12, cy, w - 24, 26);
      text(ctx, "You are visitor #000451", x + w / 2, cy + 19, `17px ${th.numbers}`, "#33ff33", "center");
      return [x + 8, y + 44, w - 16, h - 88];
    },
    over(ctx, th) {
      // Under construction, forever.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, CARD_W, 12);
      ctx.clip();
      for (let i = -20; i < CARD_W; i += 24) {
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.moveTo(i, 12); ctx.lineTo(i + 12, 0); ctx.lineTo(i + 24, 0); ctx.lineTo(i + 12, 12);
        ctx.fill();
      }
      ctx.restore();
      text(ctx, "Best viewed at 1200×630", CARD_W - 20, CARD_H - 8, `italic 13px ${th.ui}`, "#9999ff", "right");
    },
  },
  "karaoke-night": {
    back(ctx, th) {
      const g = ctx.createRadialGradient(CARD_W * 0.35, CARD_H * 0.2, 40, CARD_W * 0.5, CARD_H * 0.5, CARD_W * 0.8);
      g.addColorStop(0, "#4a2370");
      g.addColorStop(1, th.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      // Spotlights.
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#ff5fa2";
      for (const [x0, x1] of [[120, -120], [1080, 1320]]) {
        ctx.beginPath();
        ctx.moveTo(x0!, 0); ctx.lineTo(x1! - 200, CARD_H); ctx.lineTo(x1! + 200, CARD_H);
        ctx.fill();
      }
      ctx.restore();
    },
    paperFrame(ctx, th, x, y, w, h) {
      neon(ctx, th.accent, x, y, w, h, 14);
      return [x + 6, y + 6, w - 12, h - 12];
    },
    panelFrame(ctx, th, x, y, w, h, title) {
      ctx.fillStyle = th.panel;
      roundRect(ctx, x, y, w, h, 16);
      ctx.fill();
      neon(ctx, "#b9a4ff", x, y, w, h, 16);
      text(ctx, `♪ ${title.toUpperCase()} ♪`, x + w / 2, y + 34, `28px ${th.display}`, th.accent, "center");
      return [x + 14, y + 44, w - 28, h - 56];
    },
  },
  "discovery-disc-96": {
    back(ctx, th) {
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.fillStyle = "#ffffff55";
      for (let y = 20; y < CARD_H; y += 40) for (let x = (y / 40) % 2 ? 20 : 40; x < CARD_W; x += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    paperFrame(ctx, _th, x, y, w, h) {
      ctx.fillStyle = "#111111";
      roundRect(ctx, x + 6, y + 6, w, h, 18);
      ctx.fill();
      ctx.fillStyle = "#fffdf2";
      roundRect(ctx, x, y, w, h, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111111";
      ctx.stroke();
      return [x + 10, y + 10, w - 20, h - 20];
    },
    panelFrame(ctx, th, x, y, w, h, title) {
      ctx.fillStyle = "#111111";
      roundRect(ctx, x + 6, y + 6, w, h, 18);
      ctx.fill();
      ctx.fillStyle = th.panel;
      roundRect(ctx, x, y, w, h, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111111";
      ctx.stroke();
      ctx.fillStyle = th.titlebar;
      roundRect(ctx, x + 3, y + 3, w - 6, 40, [15, 15, 0, 0]);
      ctx.fill();
      text(ctx, title, x + 18, y + 32, `30px ${th.display}`, th.titlebarText);
      return [x + 14, y + 50, w - 28, h - 62];
    },
    over(ctx, th) {
      // The disc itself, stuck on the corner like a cereal-box prize.
      const cx = 1140, cy = 50;
      const g = ctx.createConicGradient(0, cx, cy);
      for (const [i, c] of ["#ff8ad8", "#8af0ff", "#fff38a", "#b28aff", "#ff8ad8"].entries()) g.addColorStop(i / 4, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = th.bg;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
  },
  "field-almanac": {
    back(ctx, th) {
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.strokeStyle = "#8e9a9055";
      ctx.lineWidth = 1;
      for (let x = 0; x < CARD_W; x += 30) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, CARD_H); ctx.stroke(); }
      for (let y = 0; y < CARD_H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(CARD_W, y + 0.5); ctx.stroke(); }
    },
    paperFrame(ctx, th, x, y, w, h) {
      ctx.fillStyle = "#fbf7ee";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
      return [x + 8, y + 8, w - 16, h - 16];
    },
    panelFrame(ctx, th, x, y, w, h, title) {
      ctx.fillStyle = th.panel;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      text(ctx, `PLATE XI · ${title.toUpperCase()}`, x + 18, y + 30, `600 13px ${th.ui}`, th.accent);
      ctx.fillStyle = th.accent;
      ctx.fillRect(x + 18, y + 40, w - 36, 1);
      return [x + 14, y + 46, w - 28, h - 58];
    },
  },
  "swag-drop": {
    back(ctx, th) {
      ctx.fillStyle = th.bg;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
    },
    paperFrame(ctx, th, x, y, w, h) {
      ctx.fillStyle = th.line;
      roundRect(ctx, x + 8, y + 8, w, h, 14);
      ctx.fill();
      ctx.fillStyle = "#fff8ec";
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = th.line;
      ctx.stroke();
      return [x + 10, y + 10, w - 20, h - 20];
    },
    panelFrame(ctx, th, x, y, w, h, title) {
      ctx.fillStyle = th.line;
      roundRect(ctx, x + 8, y + 8, w, h, 14);
      ctx.fill();
      ctx.fillStyle = th.panel;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = th.line;
      ctx.stroke();
      text(ctx, title.toUpperCase(), x + 18, y + 32, `800 18px ${th.display}`, th.text);
      return [x + 14, y + 44, w - 28, h - 56];
    },
    over(ctx, th) {
      // The sticker: limited edition, like everything else this lab made.
      ctx.save();
      ctx.translate(1138, 46);
      ctx.rotate(0.18);
      ctx.scale(0.8, 0.8);
      ctx.fillStyle = th.accent;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const r = i % 2 ? 50 : 60;
        const a = (i / 24) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 3;
      ctx.stroke();
      text(ctx, "LIMITED", 0, -4, `800 18px ${th.display}`, "#ffffff", "center");
      text(ctx, "RUN", 0, 18, `800 18px ${th.display}`, "#ffffff", "center");
      ctx.restore();
    },
  },
};

function neon(ctx: Ctx, color: string, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

const BASE: Chrome = {
  back(ctx, th) {
    const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, th.bg);
    g.addColorStop(1, "#cdeefa");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  },
  paperFrame(ctx, th, x, y, w, h) {
    ctx.fillStyle = "#00000033";
    roundRect(ctx, x, y + 6, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#f6efdf";
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
    void th;
    return [x + 6, y + 6, w - 12, h - 12];
  },
  panelFrame(ctx, th, x, y, w, h, title) {
    ctx.fillStyle = th.line;
    roundRect(ctx, x, y + 5, w, h, th.radius);
    ctx.fill();
    ctx.fillStyle = th.panel;
    roundRect(ctx, x, y, w, h, th.radius);
    ctx.fill();
    ctx.lineWidth = th.border;
    ctx.strokeStyle = th.line;
    ctx.stroke();
    text(ctx, title, x + 18, y + 32, `800 18px ${th.display}`, th.dim);
    return [x + 14, y + 42, w - 28, h - 54];
  },
};

export const chromeOf = (skin: string): Chrome => CHROME[skin] ?? BASE;
export const CHROMED_SKINS = Object.keys(CHROME);

const SERIF = `Georgia, "Times New Roman", serif`;
const INK = "#221d16";

/** Draw the front page into the rectangle. */
function drawPaper(ctx: Ctx, e: EndingVM, photo: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
  const p = e.paper;
  ctx.fillStyle = "#f6efdf";
  ctx.fillRect(x, y, w, h);
  const pad = 22;
  const L = x + pad;
  const R = x + w - pad;
  const W = R - L;
  let cy = y + 24;
  text(ctx, p.issue.toUpperCase(), L, cy, `700 11px ${SERIF}`, "#6d604b");
  text(ctx, "INDEPENDENT. MOSTLY.", x + w / 2, cy, `700 11px ${SERIF}`, "#6d604b", "center");
  text(ctx, "FINAL EDITION", R, cy, `700 11px ${SERIF}`, "#b0302a", "right");
  cy += 50;
  text(ctx, p.masthead, x + w / 2, cy, `900 50px ${SERIF}`, INK, "center");
  cy += 12;
  ctx.fillStyle = INK;
  ctx.fillRect(L, cy, W, 3);
  ctx.fillRect(L, cy + 5, W, 1);
  cy += 20;
  text(ctx, p.date, L, cy, `italic 13px ${SERIF}`, "#4d4336");
  text(ctx, "All the news that's fit to prompt", R, cy, `italic 13px ${SERIF}`, "#4d4336", "right");
  cy += 8;
  ctx.fillRect(L, cy, W, 1);
  cy += 26;
  text(ctx, p.kicker.toUpperCase(), L, cy, `800 13px ${SERIF}`, "#b0302a");
  cy += 8;
  const measureHead = (s: string, size: number) => {
    ctx.font = `900 ${size}px ${SERIF}`;
    return ctx.measureText(s).width;
  };
  // Two big lines if it can; three smaller ones if it must (the photo needs the room).
  const two = fit(p.headline, W, 2, [44, 40, 36], measureHead);
  const head = two.lines.at(-1)?.endsWith("…") ? fit(p.headline, W, 3, [34, 31, 28], measureHead) : two;
  for (const line of head.lines) {
    cy += head.size * 1.02;
    text(ctx, line, L, cy, `900 ${head.size}px ${SERIF}`, INK);
  }
  cy += 16;
  // The photo, and the deck beside it.
  const bottom = y + h - 46;
  const ph = Math.max(120, Math.min(250, bottom - cy - 20));
  const pw = Math.round((ph * 16) / 9);
  if (photo) ctx.drawImage(photo, L, cy, pw, ph);
  else {
    const g = ctx.createLinearGradient(0, cy, 0, cy + ph);
    g.addColorStop(0, "#9fd7f0");
    g.addColorStop(1, "#6fae62");
    ctx.fillStyle = g;
    ctx.fillRect(L, cy, pw, ph);
    text(ctx, "📷 Photo: the campus", L + pw / 2, cy + ph / 2 + 6, `italic 16px ${SERIF}`, "#ffffffcc", "center");
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(L + 0.5, cy + 0.5, pw - 1, ph - 1);
  ctx.font = `italic 12px ${SERIF}`;
  const cap = fit(p.caption, pw, 1, [12], (s) => ctx.measureText(s).width);
  text(ctx, cap.lines[0] ?? "", L, cy + ph + 16, `italic 12px ${SERIF}`, "#4d4336");
  const dx = L + pw + 18;
  const dw = R - dx;
  ctx.fillRect(dx - 9, cy, 1, ph);
  const deck = fit(p.deck, dw, 6, [17, 16, 15, 14], (s, size) => {
    ctx.font = `${size}px ${SERIF}`;
    return ctx.measureText(s).width;
  });
  let dy = cy + deck.size;
  for (const line of deck.lines) {
    text(ctx, line, dx, dy, `${deck.size}px ${SERIF}`, "#2f2921");
    dy += deck.size * 1.3;
  }
  const sub = p.subs[0];
  if (sub && dy + 40 < cy + ph) {
    dy += 6;
    ctx.fillRect(dx, dy - 12, dw, 1);
    text(ctx, "ALSO", dx, dy + 4, `800 11px ${SERIF}`, "#b0302a");
    ctx.font = `700 14px ${SERIF}`;
    const s = fit(sub, dw, Math.max(1, Math.floor((cy + ph - dy - 10) / 18)), [14], (t) => ctx.measureText(t).width);
    for (const line of s.lines) {
      dy += 18;
      text(ctx, line, dx, dy, `700 14px ${SERIF}`, INK);
    }
  }
  // The sign-off.
  ctx.fillStyle = INK;
  ctx.fillRect(L, y + h - 40, W, 1);
  ctx.font = `italic 700 18px ${SERIF}`;
  const so = fit(p.signoff, W, 1, [18, 16, 14], (s, size) => {
    ctx.font = `italic 700 ${size}px ${SERIF}`;
    return ctx.measureText(s).width;
  });
  text(ctx, so.lines[0] ?? "", x + w / 2, y + h - 15, `italic 700 ${so.size}px ${SERIF}`, INK, "center");
  // The stamp.
  ctx.save();
  const stamp = e.title.toUpperCase();
  ctx.font = `900 24px ${SERIF}`;
  const sw = ctx.measureText(stamp).width + 28;
  // Tilted, a wide stamp's low end drops; lift it so the caption stays readable.
  ctx.translate(L + pw - sw / 2 + 14, cy + ph - 30 - Math.sin(0.16) * (sw / 2));
  ctx.rotate(-0.16);
  ctx.fillStyle = "#f6efdfcc";
  roundRect(ctx, -sw / 2, -24, sw, 44, 6);
  ctx.fill();
  const ink = e.tone === "good" ? "#1f7a45" : e.tone === "neutral" ? "#2f5d8c" : "#b0302a";
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  roundRect(ctx, -sw / 2, -24, sw, 44, 6);
  ctx.stroke();
  text(ctx, stamp, 0, 7, `900 24px ${SERIF}`, ink, "center");
  ctx.restore();
}

/** The run in numbers: the lab, how it ended, the era strip, the five stats, and where to play. */
function drawPanel(ctx: Ctx, th: CardTheme, e: EndingVM, x: number, y: number, w: number, h: number) {
  let cy = y + 8;
  const lab = fit(e.lab, w, 2, [34, 30, 26, 22], (s, size) => {
    ctx.font = `800 ${size}px ${th.display}`;
    return ctx.measureText(s).width;
  });
  for (const line of lab.lines) {
    cy += lab.size * 1.05;
    text(ctx, line, x, cy, `800 ${lab.size}px ${th.display}`, th.text);
  }
  cy += 12;
  // How it ended, in a pill.
  ctx.font = `800 17px ${th.ui}`;
  const label = `The end: ${e.title}`;
  const lw = Math.min(w, ctx.measureText(label).width + 24);
  ctx.fillStyle = th.accent;
  roundRect(ctx, x, cy, lw, 30, 15);
  ctx.fill();
  text(ctx, label, x + 12, cy + 21, `800 17px ${th.ui}`, contrastOn(th.accent));
  cy += 46;
  // The era strip.
  const cells = Array.from(e.strip.replace(/️/g, ""));
  const squares = cells.filter((c) => SQUARES[c]);
  const size = Math.min(22, Math.floor((w - 34) / Math.max(1, squares.length)) - 3);
  let sx = x;
  for (const c of squares) {
    ctx.fillStyle = SQUARES[c]!;
    roundRect(ctx, sx, cy, size, size, 4);
    ctx.fill();
    sx += size + 3;
  }
  // The finish: a chequered flag (drawn: an emoji depends on the machine's fonts).
  const q = size / 4;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = (i + Math.floor(i / 4)) % 2 ? "#ffffff" : "#111111";
    ctx.fillRect(sx + 2 + (i % 4) * q, cy + Math.floor(i / 4) * q, q, q);
  }
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 2.5, cy + 0.5, size - 1, size - 1);
  cy += size + 22;
  // The stats.
  const rows = Math.max(1, e.stats.length);
  const footer = 54;
  const rowH = Math.min(44, (y + h - footer - cy) / rows);
  for (const st of e.stats) {
    ctx.fillStyle = th.line;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x, cy + rowH - 1, w, 1);
    ctx.globalAlpha = 1;
    text(ctx, st.label, x, cy + rowH * 0.66, `700 17px ${th.ui}`, th.dim);
    text(ctx, st.text, x + w, cy + rowH * 0.7, `800 ${Math.round(rowH * 0.62)}px ${th.numbers}`, th.text, "right");
    cy += rowH;
  }
  // Where to play.
  text(ctx, e.daily ?? "Frontier Lab Tycoon", x, y + h - 26, `800 16px ${th.ui}`, th.text);
  text(ctx, e.daily ? "Same lab, same seed. Beat me." : "A game about running a frontier lab.", x, y + h - 6, `15px ${th.ui}`, th.dim);
}

/** Black or white, whichever reads on `hex`. */
export function contrastOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#000000";
  const n = parseInt(m[1]!, 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#000000" : "#ffffff";
}

/** Paint the whole card. `photo` is the campus (null: a painted stand-in). */
export function drawCard(ctx: Ctx, th: CardTheme, e: EndingVM, photo: HTMLImageElement | null) {
  const chrome = chromeOf(th.skin);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  chrome.back(ctx, th);
  const [px, py, pw, ph] = chrome.paperFrame(ctx, th, 28, 26, 764, 578);
  drawPaper(ctx, e, photo, px, py, pw, ph);
  const [qx, qy, qw, qh] = chrome.panelFrame(ctx, th, 816, 26, 356, 578, e.daily ? "Today's lab" : "The run");
  drawPanel(ctx, th, e, qx + 6, qy, qw - 12, qh);
  chrome.over?.(ctx, th, e);
  ctx.restore();
}

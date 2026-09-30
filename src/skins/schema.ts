// skin.json validation. A skin that fails is refused with a readable error and the game falls back to the default.
// Everything here is pure (no DOM, no Vite), so the tests and the registry share it.
import { Result, Schema } from "effect";
import { SKIN_API_VERSION } from "../ui/hud/types";
import { SLOT_NAMES } from "./types";
import baseTokens from "./base/tokens.json";
import baseStrings from "./base/strings.json";

/** Tokens every skin must set: the ones that give a skin its identity. The rest fall back to the base. */
export const REQUIRED_TOKENS = [
  "color.bg",
  "color.panel",
  "color.panelAlt",
  "color.text",
  "color.line",
  "color.accent",
  "color.good",
  "color.bad",
  "color.numeral",
  "font.ui",
  "font.display",
  "font.numbers",
  "radius.panel",
  "border.width",
  "shadow.panel",
] as const;

export const BASE_TOKENS: Readonly<Record<string, string>> = baseTokens;
export const BASE_STRINGS: Readonly<Record<string, string>> = baseStrings;

/** Skin ids are folder names and appear in CSS selectors: lowercase words joined by dashes. */
export const SKIN_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** A token value ends up inside a style rule: no way to open a new rule, load a file or close the tag. */
const UNSAFE_VALUE = /[{};<>]|@import|url\s*\(|expression\s*\(|\\/i;

const Font = Schema.Struct({
  family: Schema.NonEmptyString,
  /** Path inside the skin folder, e.g. "assets/fonts/w95fa.woff2". */
  src: Schema.NonEmptyString.check(Schema.isPattern(/^assets\/[\w./-]+\.(woff2|woff|ttf|otf)$/i)),
  weight: Schema.optionalKey(Schema.Union([Schema.Number, Schema.String])),
  style: Schema.optionalKey(Schema.Literals(["normal", "italic"])),
  /** Licence name, e.g. "OFL-1.1". */
  license: Schema.NonEmptyString,
  /** Path of the licence text bundled with the font. */
  licenseFile: Schema.NonEmptyString.check(Schema.isPattern(/^assets\/[\w./-]+$/)),
});

export const SkinManifest = Schema.Struct({
  apiVersion: Schema.Literal(SKIN_API_VERSION),
  id: Schema.String.check(Schema.isPattern(SKIN_ID)),
  name: Schema.NonEmptyString,
  author: Schema.NonEmptyString,
  version: Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/)),
  description: Schema.NonEmptyString,
  tokens: Schema.Record(Schema.String, Schema.String),
  strings: Schema.Record(Schema.String, Schema.String),
  fonts: Schema.Array(Font),
  /** The preview image the Display picker shows: "assets/preview.png" (or .jpg, .webp, .svg). */
  preview: Schema.String.check(Schema.isPattern(/^assets\/preview\.(png|jpe?g|webp|gif|svg)$/i)),
  /** The slots this skin replaces with its own components (its `slots.tsx` exports exactly these). */
  slots: Schema.Array(Schema.String),
  /** Kept out of the player's Display picker (still reachable with `?skin=<id>`) until it passes a taste review. Unhiding is deleting this line. */
  unlisted: Schema.optionalKey(Schema.Boolean),
});
export type SkinManifest = typeof SkinManifest.Type;

const decode = Schema.decodeUnknownResult(SkinManifest);

/** "Expected 1\n  at [\"apiVersion\"]" → "apiVersion: Expected 1" */
function readable(message: string): string[] {
  const out: string[] = [];
  const lines = message.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const at = lines[i + 1]?.match(/^\s*at (.*)$/);
    if (at) {
      out.push(`${at[1]!.replace(/\]\[/g, ".").replace(/^\[|\]$/g, "").replace(/"/g, "")}: ${line}`);
      i++;
    } else if (line.trim()) out.push(line.trim());
  }
  return out;
}

export interface Validated {
  ok: boolean;
  errors: string[];
  manifest: SkinManifest | null;
}

/** Check a parsed skin.json. `folder` is the directory name; it has to match `id`. */
export function validateManifest(input: unknown, folder?: string): Validated {
  const result = decode(input, { errors: "all" });
  if (Result.isFailure(result)) return { ok: false, errors: readable(result.failure.message), manifest: null };
  const m = result.success;
  const errors: string[] = [];
  if (folder && m.id !== folder) errors.push(`id: "${m.id}" must match the folder name "${folder}"`);
  for (const name of REQUIRED_TOKENS) if (!(name in m.tokens)) errors.push(`tokens: missing required token "${name}"`);
  for (const [name, value] of Object.entries(m.tokens)) {
    if (!(name in BASE_TOKENS) && !name.startsWith("x.")) errors.push(`tokens: unknown token "${name}" (custom tokens start with "x.")`);
    if (!/^[\w.]+$/.test(name)) errors.push(`tokens: bad token name "${name}"`);
    if (UNSAFE_VALUE.test(value)) errors.push(`tokens: the value of "${name}" contains characters a token may not have ({ } ; < > url() @import)`);
  }
  for (const key of Object.keys(m.strings)) if (!(key in BASE_STRINGS)) errors.push(`strings: unknown key "${key}"`);
  const slotSet = new Set<string>(SLOT_NAMES);
  for (const slot of m.slots) if (!slotSet.has(slot)) errors.push(`slots: unknown slot "${slot}" (known: ${SLOT_NAMES.join(", ")})`);
  if (new Set(m.slots).size !== m.slots.length) errors.push("slots: a slot is listed twice");
  for (const f of m.fonts) if (!/^(OFL|Apache|MIT|CC0|Ubuntu)/i.test(f.license)) errors.push(`fonts: "${f.family}" has licence "${f.license}"; bundle only OFL, Apache, MIT or CC0 fonts`);
  return { ok: errors.length === 0, errors, manifest: errors.length === 0 ? m : null };
}

/** A design token name as its CSS custom property: "color.panel" → "--flt-color-panel". */
export const tokenVar = (name: string) => `--flt-${name.replace(/\./g, "-")}`;

/** `{name}` placeholders in a string. */
export function fillString(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

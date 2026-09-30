// The small print of the Almanac: dates in words, Roman numerals for the training runs, and the Latin for everybody.
// Pure functions of the view-model, so they are unit-tested and the slots stay short.
import type { InspectorVM } from "../../ui/hud/types";

const MONTHS: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};
const YEARS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** 1 → "1st", 22 → "22nd", 13 → "13th". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "Y1 · Jan 30" → "Year one · January 30th". Anything else comes back untouched. */
export function almanacDate(date: string): string {
  const m = /^Y(\d+)\D+([A-Za-z]{3,9})\.?\s+(\d{1,2})$/.exec(date.trim());
  const month = m ? MONTHS[m[2]!.slice(0, 3).toLowerCase()] : undefined;
  if (!m || !month) return date;
  const year = Number(m[1]);
  return `Year ${YEARS[year] ?? year} · ${month} ${ordinal(Number(m[3]))}`;
}

/** 2 → "II", 14 → "XIV". Zero and negatives (which nobody should see) come back as plain digits. */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let left = n;
  let out = "";
  for (const [value, glyph] of table) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}

/** The number on the badge as a specimen number: "0042" → 42. */
export const specimenNo = (badge: string) => Number.parseInt(badge, 10) || 0;

const GENUS: Record<InspectorVM["kind"], string> = {
  researcher: "Homo researchus",
  agent: "Machina diligens",
  visitor: "Homo curiosus",
  protester: "Homo indignans",
};

type Kind = Pick<InspectorVM, "kind" | "role" | "mood" | "needs" | "portrait">;

/** What is wrong with them, in Latin (the worst need, if it is shouting), else how they are doing. */
function variety(who: Kind): string {
  if (who.kind === "agent") return who.portrait.drift < 0.3 ? "obsequiosa" : who.portrait.drift < 0.65 ? "improvisans" : "rebellis";
  if (who.kind === "protester") return "placardifera";
  if (who.kind === "visitor") {
    const role = who.role.toLowerCase();
    if (role.includes("venture")) return "pecuniosa";
    if (role.includes("journal")) return "scribens";
    if (role.includes("enterprise")) return "procurans";
    if (role.includes("influenc")) return "selfiensis";
    return "vagans";
  }
  const worst = who.needs.reduce<InspectorVM["needs"][number] | null>((a, b) => (a && a.urgency >= b.urgency ? a : b), null);
  if (worst && worst.urgency >= 0.5) {
    if (worst.key === "energy") return "overcaffeinata";
    if (worst.key === "focus") return "distracta";
    if (worst.key === "fomo") return "inquieta";
  }
  return { content: "florens", slumped: "languida", miserable: "lugubris", resigned: "resignata" }[who.mood];
}

/** "Homo researchus, var. overcaffeinata". */
export const binomial = (who: Kind) => `${GENUS[who.kind]}, var. ${variety(who)}`;

/**
 * How the Follow button and the fig. caption call them: a nickname in quotes wins, then "Dr. Gradient", then a first name.
 * "Agent-0042 'Sparky'" → "Sparky", "Dr. Ada Gradient" → "Dr. Gradient", "Ada Gradient" → "Ada".
 */
export function shortName(name: string): string {
  const nick = /['"“‘]([^'"”’]+)['"”’]/.exec(name);
  if (nick) return nick[1]!;
  const parts = name.trim().split(/\s+/);
  if (/^(dr|prof|mr|ms|mx)\.?$/i.test(parts[0]!) && parts.length > 1) return `${parts[0]} ${parts.at(-1)}`;
  return parts[0] ?? name;
}

/** The initial that goes in a wax seal: the first letter of the message, or nothing when it isn't one. */
export function sealInitial(text: string): string | null {
  const c = text.trim()[0];
  return c && /\p{L}/u.test(c) ? c.toUpperCase() : null;
}

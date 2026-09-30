// Number formatting a skin may want. A small copy of the game's own so skins never import `src/sim`; `kit.test.ts`
// checks the two agree.
const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${trim(a / 1e9, 2)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6, 2)}M`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}K`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3, 1)}K`;
  return `${sign}$${Math.round(a)}`;
}

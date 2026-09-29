const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}$${trim(a / 1e9, 2)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6, 2)}M`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}K`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3, 1)}K`;
  return `${sign}$${Math.round(a)}`;
}

/** 30-day months, 12 per year: day 0 is "Y1 · Jan 1". */
export function formatDate(day: number): string {
  const year = Math.floor(day / 360) + 1;
  const month = Math.floor((day % 360) / 30);
  return `Y${year} · ${MONTHS[month]} ${(day % 30) + 1}`;
}

/** Months of cash left at yesterday's burn, or null when the lab isn't burning. */
export function runwayMonths(cash: number, netPerDay: number): number | null {
  if (netPerDay >= 0) return null;
  return Math.max(0, cash) / (-netPerDay * 30);
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m);
}

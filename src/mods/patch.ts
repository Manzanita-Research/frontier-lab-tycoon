import { ModError, suggest } from "./schema";

export interface Patch {
  readonly add?: readonly object[];
  readonly override?: ReadonlyArray<{ readonly id: string }>;
  readonly remove?: readonly string[];
}
/** Keys for legacy anonymous lines are deterministic and do not modify the base data. */
export function contentKey(section: string, item: { readonly id?: string }, index: number): string {
  return item.id ?? `base-${section}-${index}`;
}
export function patchById<T extends object>(
  section: string, below: readonly T[], patch: Patch | undefined,
  key: (item: T, index: number) => string, decode: (input: unknown) => T,
): readonly T[] {
  if (!patch) return below;
  const rows = new Map(below.map((item, i) => [key(item, i), item]));
  const seen = (ids: readonly string[], operation: string) => {
    const unique = new Set<string>();
    ids.forEach((id, i) => {
      if (unique.has(id)) throw new ModError({ path: `content.${section}.${operation}[${i}]`, detail: `duplicate id "${id}"` });
      unique.add(id);
    });
  };
  seen((patch.add ?? []).map((item) => {
    const decoded = decode(item);
    return key(decoded, -1);
  }), "add");
  seen((patch.override ?? []).map((item) => item.id), "override");
  seen(patch.remove ?? [], "remove");
  for (const [i, input] of (patch.add ?? []).entries()) {
    const row = decode(input);
    const id = key(row, -1);
    if (rows.has(id)) throw new ModError({ path: `content.${section}.add[${i}].id`, detail: `id "${id}" already exists; use override` });
    rows.set(id, row);
  }
  for (const [i, patchRow] of (patch.override ?? []).entries()) {
    const old = rows.get(patchRow.id);
    if (!old) throw new ModError({ path: `content.${section}.override[${i}].id`, detail: `unknown id "${patchRow.id}"${suggest(patchRow.id, [...rows.keys()])}` });
    rows.set(patchRow.id, decode({ ...old, ...patchRow }));
  }
  for (const [i, id] of (patch.remove ?? []).entries()) {
    if (!rows.delete(id)) throw new ModError({ path: `content.${section}.remove[${i}]`, detail: `unknown id "${id}"${suggest(id, [...rows.keys()])}` });
  }
  return [...rows.values()];
}

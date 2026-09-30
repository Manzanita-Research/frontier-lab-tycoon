// A pack's card picks arrive as `flags[prefix + key]`, and its applier looks for every one of them on every tick,
// paused or not. Spelling each flag once, instead of joining the strings on every look, keeps that off the budget (FLT-39).
export interface Pick<K extends string> {
  key: K;
  flag: string;
}

export const picks = <K extends string>(prefix: string, keys: readonly K[]): readonly Pick<K>[] => keys.map((key) => ({ key, flag: prefix + key }));

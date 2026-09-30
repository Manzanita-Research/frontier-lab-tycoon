import { defineMod, type RivalId, type BuildingId, type ThoughtCondition, type GuardName, type ActionName } from "./index";

const ids: [RivalId, BuildingId, ThoughtCondition, GuardName, ActionName] = ["anthro", "hall", "openDrop", "stat.gte", "cash.delta"];
defineMod({ apiVersion: 1, id: "typed-mod", name: ids[0], version: "1.0.0" });
// @ts-expect-error API version is pinned by the real schema.
defineMod({ apiVersion: 2, id: "typed-mod", name: "Typed", version: "1.0.0" });
// @ts-expect-error Unknown keys should be caught while authoring, before runtime validation.
defineMod({ apiVersion: 1, id: "typed-mod", name: "Typed", version: "1.0.0", rules: {} });
// @ts-expect-error The real schema requires a headline tone.
defineMod({ apiVersion: 1, id: "typed-mod", name: "Typed", version: "1.0.0", content: { headlines: { add: [{ id: "line", text: "Biscuit" }] } } });

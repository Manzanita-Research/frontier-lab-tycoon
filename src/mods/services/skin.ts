import { Context } from "effect";
import type { SkinData } from "../schema";

export interface SkinApi {
  readonly active: string;
  readonly skins: Readonly<Record<string, SkinData>>;
}
export class Skin extends Context.Service<Skin, SkinApi>()("@flt/Skin") {}

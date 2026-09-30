import { Context } from "effect";

export interface AssetsApi {
  /** Bundled, validated data URLs; the browser adapter owns any object-URL lifetime. */
  readonly urls: Readonly<Record<string, string>>;
  readonly resolve: (id: string) => string | undefined;
}
export class Assets extends Context.Service<Assets, AssetsApi>()("@flt/Assets") {}

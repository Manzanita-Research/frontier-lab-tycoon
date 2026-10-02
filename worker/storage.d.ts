// src/introRoute.ts (FLT-95) names the DOM's Storage in a type. The Worker only calls its isBareRoot, and has no DOM.
interface Storage {
  getItem(key: string): string | null;
}

import { expect, it } from "vitest";
import { appendArchive, readArchive } from "./archive";
import { frontPage, recap } from "./edition";
it("round-trips both edition types, rejects malformed storage and caps archive memory", () => {
  const editions = [frontPage([], 7, "Tiny Lab"), recap([], 30, "Tiny Lab")];
  expect(readArchive(JSON.stringify(editions))).toEqual(editions);
  expect(readArchive("broken")).toEqual([]);
  expect(readArchive(JSON.stringify([{ ...editions[0], sub: [] }, { ...editions[1], messages: [{ friend: "__proto__", text: "x" }] }]))).toEqual([]);
  expect(appendArchive([], Array.from({ length: 40 }, (_, i) => frontPage([], (i + 1) * 7, "Tiny Lab")))).toHaveLength(30);
  expect(appendArchive(editions, editions)).toEqual(editions);
});

it("keeps PNG camera captures when a browser falls back from WebP encoding", () => {
  const page = { ...frontPage([], 7, "Tiny Lab"), photo: "data:image/png;base64,AAAA" };
  expect(readArchive(JSON.stringify([page]))).toEqual([page]);
  expect(readArchive(JSON.stringify([{ ...page, photo: "data:image/svg+xml;base64,AAAA" }]))).toEqual([]);
});

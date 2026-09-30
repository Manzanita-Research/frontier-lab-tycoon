#!/usr/bin/env node
// Daily Drama: the author's only way to run anything. A minimal MCP server (stdio, newline-delimited JSON-RPC)
// with one tool, `check`, which validates the room's pack (flt-mod check + parody linter + shape). The author
// session gets no shell at all, so it cannot read past its room: this tool is the whole bridge to the game.
//
//   node scripts/drama-mcp.mjs <pack dir> --date YYYY-MM-DD      (started by scripts/drama-run.mjs)
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { checkPack } from "./drama-run.mjs";

const pack = resolve(process.argv[2]);
const day = process.argv[process.argv.indexOf("--date") + 1];
const send = (message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");

const TOOL = {
  name: "check",
  description:
    "Validate pack/mod.json (and pack/glossary.json): the game's flt-mod check, the parody linter and the Daily Drama shape rules. Returns the transcript; it ends in ALL GREEN when the pack is ready.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

createInterface({ input: process.stdin }).on("line", async (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const { id, method, params } = message;
  if (id === undefined) return; // notifications need no answer
  if (method === "initialize")
    send({ id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "drama", version: "1.0.0" } } });
  else if (method === "tools/list") send({ id, result: { tools: [TOOL] } });
  else if (method === "tools/call" && params?.name === "check") {
    try {
      const { ok, transcript } = await checkPack(pack, day);
      send({ id, result: { content: [{ type: "text", text: transcript }], isError: !ok } });
    } catch (error) {
      send({ id, result: { content: [{ type: "text", text: `check crashed: ${error.message}` }], isError: true } });
    }
  } else if (method === "ping") send({ id, result: {} });
  else send({ id, error: { code: -32601, message: `unknown method ${method}` } });
});

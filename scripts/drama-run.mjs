#!/usr/bin/env node
// Daily Drama: one headless run, from today's news to a PR Jem reviews. See drama/AUTOMATION.md.
//
//   node scripts/drama-run.mjs [--date YYYY-MM-DD] [--model claude-opus-5-5] [--no-pr] [--keep-room]
//
// 1. fetch   read drama/sources.json into candidates.md                       (scripts/drama-fetch.mjs)
// 2. room    build a scratch room OUTSIDE the checkout with only BRIEF.md (drama/pick.md), SKILL.md
//            (.agents/skills/flt-modding) and candidates.md
// 3. write   headless Claude in that room, `--restricted`: its file tools cannot leave the room and it has no shell;
//            its one bridge to the game is a `check` tool (scripts/drama-mcp.mjs). So the pack comes from the skill
//            alone. It writes pack/mod.json (+ glossary.json) and pr.json, or SKIP.md on a quiet day.
// 4. check   flt-mod check, the parody linter (drama/lint.mjs) and the pack's shape; transcript → CHECK.txt
// 5. pr      commit mods/drama/<date>/ on a fresh branch from origin/main (a temporary worktree, so the current
//            checkout is untouched) and open "Daily Drama: <summary>". The source link lives in the PR body only.
//
// Steps run alone too: `fetch`, `check <pack dir>`, `pr` (e.g. after a human edits the pack).
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main as fetchMain } from "./drama-fetch.mjs";
import { formatReport, lintPack, lintText, readPack } from "../drama/lint.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(name);
/** Today in San Francisco, where the drama is. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const date = flag("--date") ?? today();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`bad --date ${date}`);
const work = join(root, "drama/.work", date);
const packDir = join(root, "mods/drama", date);
const say = (line) => console.log(`drama-run ${date}: ${line}`);

function run(command, argv, { cwd = root, input, log, env = process.env, quiet = false } = {}) {
  return new Promise((ok) => {
    const child = spawn(command, argv, { cwd, env, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let out = "";
    const take = (chunk) => { out += chunk; if (!quiet) process.stdout.write(chunk); };
    child.stdout.on("data", (c) => { take(c); log?.write?.(c); });
    child.stderr.on("data", (c) => take(c));
    if (input !== undefined) child.stdin.end(input);
    child.on("close", (code) => ok({ code, out }));
  });
}
const git = async (...argv) => {
  const r = await run("git", argv, { quiet: true });
  if (r.code !== 0) throw new Error(`git ${argv.join(" ")} failed:\n${r.out}`);
  return r.out.trim();
};

// ---------------------------------------------------------------------------------------------------------------
// Checks

/** The pack's shape, from drama/pick.md: one card or arc, 5-10 headlines, 5-10 thoughts, prefixed ids. */
export function shapeCheck(mod, day = date) {
  const problems = [];
  const content = mod.content ?? {};
  const count = (section) => content[section]?.add?.length ?? 0;
  if (mod.id !== `drama-${day}`) problems.push(`id must be "drama-${day}" (got "${mod.id}")`);
  if (!/^Daily Drama: \S/.test(mod.name ?? "")) problems.push(`name must start "Daily Drama: " (got "${mod.name}")`);
  if (count("events") + count("arcs") < 1 || count("events") + count("arcs") > 2) problems.push(`needs one event card or arc (a card plus the arc that fires it is fine); has ${count("events")} events, ${count("arcs")} arcs`);
  if (count("headlines") < 5 || count("headlines") > 10) problems.push(`needs 5-10 headlines; has ${count("headlines")}`);
  if (count("thoughts") < 5 || count("thoughts") > 10) problems.push(`needs 5-10 thoughts; has ${count("thoughts")}`);
  const allowed = new Set(["headlines", "thoughts", "events", "arcs", "rivals"]);
  for (const section of Object.keys(content)) if (!allowed.has(section)) problems.push(`section "${section}" is outside a Drama pack (headlines, thoughts, one event/arc, one rival tweak)`);
  if ((content.rivals?.override?.length ?? 0) > 1 || content.rivals?.add || content.rivals?.remove) problems.push("at most one rival tweak (an override), no added or removed rivals");
  for (const section of Object.values(content))
    for (const entry of section?.add ?? []) if (entry.id && !entry.id.startsWith(`drama-${day}-`)) problems.push(`id "${entry.id}" must start "drama-${day}-"`);
  if (mod.skin || mod.assets || mod.audio) problems.push("no skin, assets or audio in a Drama pack");
  return problems;
}

/** flt-mod check + linter + shape for a pack directory. Returns { ok, transcript }. */
export async function checkPack(dir, day = date) {
  const parts = [];
  const files = (await readdir(dir)).filter((f) => !f.startsWith("."));
  const extra = files.filter((f) => !["mod.json", "glossary.json", "CHECK.txt"].includes(f));
  let ok = true;
  if (!files.includes("mod.json")) return { ok: false, transcript: "pack/mod.json is missing" };
  if (extra.length) { ok = false; parts.push(`✗ unexpected files in the pack: ${extra.join(", ")} (only mod.json and glossary.json)`); }

  const flt = await run("node", ["packages/flt-mod-cli/cli.mjs", "check", join(dir, "mod.json")], { quiet: true });
  const fltOut = flt.out.split("\n").filter((l) => !/^\[vite\]/.test(l)).join("\n").trim();
  parts.push(`$ flt-mod check mod.json\n${fltOut}`);
  if (flt.code !== 0 || !/^PASS /m.test(flt.out)) ok = false;

  try {
    const { mod, names } = readPack(dir);
    const report = lintPack(mod, { names });
    parts.push(`$ drama lint\n${formatReport(relative(root, dir), report)}`);
    if (!report.ok) ok = false;
    const shape = shapeCheck(mod, day);
    parts.push(`$ drama shape\n${shape.length ? shape.map((p) => `  ✗ ${p}`).join("\n") : "  ✓ one card/arc, 5-10 headlines, 5-10 thoughts, ids prefixed"}`);
    if (shape.length) ok = false;
  } catch (error) {
    ok = false;
    parts.push(`✗ ${error.message}`);
  }
  parts.push(ok ? "ALL GREEN" : "NOT GREEN: fix the ✗ lines above and check again");
  return { ok, transcript: parts.join("\n\n") };
}

// ---------------------------------------------------------------------------------------------------------------
// Steps

async function fetchStep() {
  await fetchMain(["--out", work]);
}

async function buildRoom() {
  const room = await mkdtemp(join(tmpdir(), `flt-drama-${date}-`));
  await cp(join(root, "drama/pick.md"), join(room, "BRIEF.md"));
  await cp(join(root, ".agents/skills/flt-modding/SKILL.md"), join(room, "SKILL.md"));
  await cp(join(work, "candidates.md"), join(room, "candidates.md"));
  await mkdir(join(room, "pack"));
  return room;
}

const PROMPT = (day) =>
  `Today is ${day}. Read BRIEF.md and do exactly what it says: read SKILL.md and candidates.md, pick one story or skip, ` +
  `write pack/mod.json (and pack/glossary.json if you invent names), call the check tool until it says ALL GREEN, then write pr.json. ` +
  `Everything you need is in this directory.`;

async function writeStep(room) {
  const model = flag("--model") ?? "claude-opus-5-5";
  const transcriptPath = join(work, "transcript.jsonl");
  const log = createWriteStream(transcriptPath);
  const env = { ...process.env };
  delete env.CLAUDECODE; // a nested headless session is intended here
  const mcp = { mcpServers: { drama: { command: process.execPath, args: [join(root, "scripts/drama-mcp.mjs"), join(room, "pack"), "--date", date] } } };
  const base = [
    "--model", model,
    "--restricted",
    "--tools", "Read,Write,Edit,Glob,Grep",
    "--mcp-config", JSON.stringify(mcp),
    "--strict-mcp-config",
    "--allowedTools", "mcp__drama__check",
    "--permission-mode", "acceptEdits",
    "--no-session-persistence",
    "--output-format", "stream-json", "--verbose",
  ];
  say(`writing with ${model} in ${room} (restricted to the room)`);
  const result = await run("claude", ["-p", PROMPT(date), ...base], { cwd: room, env, log, quiet: true });
  log.end();
  const events = (await readFile(transcriptPath, "utf8")).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const tools = events.flatMap((e) => (e.type === "assistant" ? e.message?.content ?? [] : [])).filter((c) => c.type === "tool_use");
  const final = events.find((e) => e.type === "result");
  const summary = {
    model,
    exit: result.code,
    turns: final?.num_turns,
    costUsd: final?.total_cost_usd,
    durationMs: final?.duration_ms,
    reads: [...new Set(tools.filter((t) => t.name === "Read").map((t) => relative(room, t.input.file_path ?? "")))],
    checks: tools.filter((t) => t.name === "mcp__drama__check").length,
    tools: tools.map((t) => `${t.name} ${relative(room, t.input?.file_path ?? t.input?.pattern ?? room)}`.trim()),
    result: final?.result ?? "",
  };
  await writeFile(join(work, "agent.json"), JSON.stringify(summary, null, 2) + "\n");
  say(`agent finished (exit ${result.code}, ${summary.turns} turns, ${summary.checks} checks); read: ${summary.reads.join(", ")}`);
  return summary;
}

async function collect(room) {
  if (existsSync(join(room, "SKIP.md"))) {
    const why = await readFile(join(room, "SKIP.md"), "utf8");
    await writeFile(join(work, "SKIP.md"), why);
    return { skipped: true, why };
  }
  if (!existsSync(join(room, "pack/mod.json"))) throw new Error("the agent wrote neither pack/mod.json nor SKIP.md");
  await rm(packDir, { recursive: true, force: true });
  await mkdir(packDir, { recursive: true });
  for (const f of ["mod.json", "glossary.json"]) if (existsSync(join(room, "pack", f))) await cp(join(room, "pack", f), join(packDir, f));
  if (!existsSync(join(room, "pr.json"))) throw new Error("the agent wrote no pr.json");
  await cp(join(room, "pr.json"), join(work, "pr.json"));
  return { skipped: false };
}

async function checkStep() {
  const { ok, transcript } = await checkPack(packDir);
  const pr = JSON.parse(await readFile(join(work, "pr.json"), "utf8"));
  const titleLint = lintText(pr.summary ?? "", { path: "pr.json summary" });
  const problems = [];
  if (!pr.summary || pr.summary.length > 80) problems.push("pr.json summary is missing or longer than 80 characters");
  if (titleLint.errors.length) problems.push(`the PR title must be parody too: ${titleLint.errors.map((e) => e.word).join(", ")}`);
  if (!/^https?:\/\//.test(pr.source ?? "")) problems.push("pr.json source is not a URL");
  const candidates = await readFile(join(work, "candidates.md"), "utf8").catch(() => "");
  if (pr.source && !candidates.includes(pr.source)) problems.push("pr.json source is not one of today's candidates");
  const text = `Daily Drama ${date}: checker transcript (scripts/drama-run.mjs)\n\n${transcript}\n`;
  await writeFile(join(packDir, "CHECK.txt"), text);
  for (const p of problems) console.log(`  ✗ ${p}`);
  return { ok: ok && problems.length === 0, transcript, pr };
}

function prBody({ pr, transcript, agent }) {
  const lines = [
    `**Daily Drama for ${date}.** Needs Jem's review before it merges or publishes (FLT-34). Don't merge on green CI.`,
    "",
    `**Source (PR only, never in the mod):** [${pr.sourceTitle ?? pr.source}](${pr.source})`,
    "",
    `**Why this is funny:** ${pr.why}`,
    "",
    `**Screenshot moment:** ${pr.screenshot ?? "n/a"}`,
    "",
  ];
  const newNames = transcript.match(/^New parody names \(the pack's glossary\.json\): (.*)$/m)?.[1] ?? "none";
  const warnings = transcript.split("\n").filter((l) => l.startsWith("  ! "));
  lines.push(`**New parody names this pack invents** (declared in \`glossary.json\`; please eyeball): ${newNames}`);
  if (warnings.length) lines.push("", "**Linter warnings (ambiguous words, not failures):**", "```", ...warnings, "```");
  lines.push(
    "",
    "### Checks",
    "```",
    transcript.split("\n").filter((l) => /^(PASS|FAIL|Replay|M1b deferred|drama-lint|  ✓|ALL GREEN|NOT GREEN)/.test(l)).join("\n"),
    "```",
    "Full transcript: `CHECK.txt` in the pack. New copy is schema-checked and linted; it renders in-game once M1b lands (see the deferred line).",
  );
  if (agent)
    lines.push(
      "",
      "### How it was made",
      `Headless \`${agent.model}\` in a scratch room outside the checkout (\`claude -p --restricted\`: file tools confined to the room, no shell; its one bridge to the game is a \`check\` tool). Its whole world: \`BRIEF.md\` (drama/pick.md), \`SKILL.md\` (.agents/skills/flt-modding), \`candidates.md\`. It read: ${agent.reads.map((r) => `\`${r}\``).join(", ")}; called \`check\` ${agent.checks} times; ${agent.turns ?? "?"} turns${agent.costUsd ? `, $${agent.costUsd.toFixed(2)}` : ""}.`,
    );
  lines.push("", "🤖 Generated with [Claude Code](https://claude.com/claude-code)");
  return lines.join("\n");
}

async function prStep({ transcript, pr, agent }) {
  const branch = `drama-${date}`;
  const title = `Daily Drama: ${pr.summary}`;
  await git("fetch", "origin", "main", "--quiet");
  const tree = await mkdtemp(join(tmpdir(), `flt-drama-pr-${date}-`));
  await rm(tree, { recursive: true, force: true });
  await git("worktree", "add", "--quiet", "-b", branch, tree, "origin/main");
  try {
    await cp(packDir, join(tree, "mods/drama", date), { recursive: true });
    const inTree = (...a) => run("git", ["-C", tree, ...a], { quiet: true });
    await inTree("add", `mods/drama/${date}`);
    const message = `${title}\n\nmods/drama/${date}: a Daily Drama pack written by scripts/drama-run.mjs from the flt-modding skill alone.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
    const commit = await inTree("commit", "--quiet", "-m", message);
    if (commit.code !== 0) throw new Error(commit.out);
    const push = await inTree("push", "--quiet", "-u", "origin", branch);
    if (push.code !== 0) throw new Error(push.out);
    const body = prBody({ pr, transcript, agent });
    await writeFile(join(work, "pr-body.md"), body);
    const created = await run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body-file", join(work, "pr-body.md")], { cwd: tree, quiet: true });
    if (created.code !== 0) throw new Error(created.out);
    return created.out.trim().split("\n").pop();
  } finally {
    await git("worktree", "remove", "--force", tree).catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------

async function main() {
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "all";
  if (command === "check") {
    const dir = resolve(args[1] && !args[1].startsWith("--") ? args[1] : packDir);
    const { ok, transcript } = await checkPack(dir);
    console.log(transcript);
    return ok ? 0 : 1;
  }
  if (command === "fetch") return await fetchStep(), 0;
  if (command === "pr") {
    const { ok, transcript, pr } = await checkStep();
    if (!ok) { console.log(transcript); return 1; }
    const agent = existsSync(join(work, "agent.json")) ? JSON.parse(await readFile(join(work, "agent.json"), "utf8")) : null;
    say(`opened ${await prStep({ transcript, pr, agent })}`);
    return 0;
  }
  if (command !== "all") throw new Error(`unknown step ${command}: all | fetch | check [dir] | pr`);

  await mkdir(work, { recursive: true });
  await fetchStep();
  const room = await buildRoom();
  const agent = await writeStep(room);
  const got = await collect(room);
  if (!has("--keep-room")) await rm(room, { recursive: true, force: true });
  else say(`room kept at ${room}`);
  if (got.skipped) {
    say(`quiet day, skipped:\n${got.why.trim()}`);
    return 0;
  }
  const { ok, transcript, pr } = await checkStep();
  console.log(transcript);
  if (!ok) { say(`NOT GREEN, no PR. The pack is in ${relative(root, packDir)}; fix it and run \`node scripts/drama-run.mjs pr --date ${date}\`.`); return 1; }
  if (has("--no-pr")) { say(`green; --no-pr, so stopping here. Pack: ${relative(root, packDir)}; PR body would use ${relative(root, join(work, "pr.json"))}`); return 0; }
  say(`opened ${await prStep({ transcript, pr, agent })}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().then((code) => { process.exitCode = code; }, (error) => { console.error(`drama-run ${date}: ${error.stack ?? error}`); process.exitCode = 1; });

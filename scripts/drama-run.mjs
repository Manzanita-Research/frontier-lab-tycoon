#!/usr/bin/env node
// Daily Drama: one headless run, from today's news to a PR Jem reviews. See drama/AUTOMATION.md.
//
//   node scripts/drama-run.mjs [--date YYYY-MM-DD] [--model claude-opus-5-5] [--no-pr] [--keep-room] [--no-comment] [--ci-timeout 25]
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
// 6. ci      wait (up to 25 min) for the PR's GitHub checks: green, red (the failing job, its first failing test and a
//            log excerpt) or still running. Only GitHub's checks make it green; step 4 passing is not CI passing.
// 7. report  post the outcome on FLT-34 (`bb tasks comment`): opened, skipped, or failed on the second attempt of the
//            day (a first failure only says to run the same command again; the count lives in .drama-state/<date>.json).
//            --no-comment prints the comment instead. A comment that fails to post never fails the run.
//
// Steps run alone too: `fetch`, `check <pack dir>`, `pr` (e.g. after a human edits the pack), `body` (rewrite pr-body.md only),
// `ci [pr]` (wait for an open Drama PR's CI and report it on FLT-34, for a run cut off while it waited).
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
    child.on("error", (error) => ok({ code: -1, out: out + String(error) }));
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
    parts.push(`$ drama lint\n${formatReport(relative(root, dir).startsWith("..") ? "pack" : relative(root, dir), report)}`);
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

/** The pack's copy as markdown, so the review happens in the PR body rather than in JSON. */
export function packText(mod) {
  const c = mod.content ?? {};
  const quote = (text) => String(text).split("\n").map((l) => `> ${l}`).join("\n");
  const lines = [];
  for (const card of c.events?.add ?? []) {
    lines.push(`**Card: ${card.title ?? card.id}**`, "", quote(card.body ?? ""), "");
    for (const choice of card.choices ?? []) lines.push(`- ${choice.label}${choice.hint ? ` _(${choice.hint})_` : ""}`);
    lines.push("");
  }
  for (const [kind, list] of Object.entries(c)) if (!["events", "headlines", "thoughts", "rivals"].includes(kind)) lines.push(`**${kind}:** ${(list.add ?? []).map((x) => `\`${x.id}\``).join(", ")}`, "");
  if (c.headlines?.add?.length) lines.push("**Headlines**", "", ...c.headlines.add.map((h) => `- ${h.text}`), "");
  if (c.thoughts?.add?.length) lines.push("**Thoughts**", "", ...c.thoughts.add.map((t) => `- ${t.text}`), "");
  for (const rival of c.rivals?.override ?? []) {
    const { id, ...fields } = rival;
    lines.push(`**Rival tweak:** \`${id}\` ${Object.entries(fields).map(([k, v]) => `${k} → "${v}"`).join(", ")}`, "");
  }
  return lines.join("\n").trim();
}

function prBody({ pr, transcript, agent, mod }) {
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
  if (mod) lines.push("### The pack", "", packText(mod), "");
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
      `Headless \`${agent.model}\` in a scratch room outside the checkout (\`claude -p --restricted\`: file tools confined to the room, no shell; its one bridge to the game is a \`check\` tool). Its whole world: \`BRIEF.md\` (drama/pick.md), \`SKILL.md\` (.agents/skills/flt-modding), \`candidates.md\`. It read: ${agent.reads.map((r) => `\`${r}\``).join(", ")}; called \`check\` ${agent.checks} time${agent.checks === 1 ? "" : "s"}; ${agent.turns ?? "?"} turns${agent.costUsd ? `, $${agent.costUsd.toFixed(2)}` : ""}.`,
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
    const body = prBody({ pr, transcript, agent, mod: JSON.parse(await readFile(join(packDir, "mod.json"), "utf8")) });
    await writeFile(join(work, "pr-body.md"), body);
    const created = await run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body-file", join(work, "pr-body.md")], { cwd: tree, quiet: true });
    if (created.code !== 0) throw new Error(created.out);
    return created.out.trim().split("\n").pop();
  } finally {
    await git("worktree", "remove", "--force", tree).catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------
// CI (FLT-112): the PR's real GitHub checks. The local checks above passing is not CI passing: on Oct 8 two Drama PRs
// failed Deploy's `check` while their runners said every check passed.

const CI_TIMEOUT_MIN = 25; // the full CI plus Preview with the stranger takes about 10-15 min
/** The jobs a Drama PR's CI is green with, in the order the comment names them. */
export const CI_JOBS = ["check", "engines", "deploy", "stranger"];
const CI_FIELDS = "name,workflow,state,bucket,link";
const sleepMs = (ms) => new Promise((ok) => setTimeout(ok, ms));
const jobName = (c) => (c.workflow ? `${c.workflow} / ${c.name}` : c.name);

/** `gh pr checks --json` output, or [] while GitHub has no checks for the PR yet ("no checks reported"). */
function parseChecks(out) {
  const text = String(out ?? "");
  const start = text.indexOf("[");
  if (start < 0) return [];
  try { return JSON.parse(text.slice(start, text.lastIndexOf("]") + 1)); } catch { return []; }
}

/**
 * Polls `gh pr checks <pr>` until every check is done and every job in `expect` has reported, or `timeoutMs` passes.
 * Returns { kind: "done" | "timeout", checks }. Prints a line whenever the count of finished checks changes.
 */
export async function waitForChecks(pr, { exec = run, timeoutMs = CI_TIMEOUT_MIN * 60_000, everyMs = 30_000, expect = CI_JOBS, now = Date.now, sleep = sleepMs, log = console.log } = {}) {
  const start = now();
  let checks = [];
  let said = "";
  for (;;) {
    checks = parseChecks((await exec("gh", ["pr", "checks", String(pr), "--json", CI_FIELDS], { quiet: true })).out);
    const pending = checks.filter((c) => c.bucket === "pending");
    const failed = checks.some((c) => c.bucket === "fail" || c.bucket === "cancel");
    const missing = expect.filter((name) => !checks.some((c) => c.name === name));
    if (checks.length && !pending.length && (failed || !missing.length)) return { kind: "done", checks };
    const status = checks.length ? `CI: ${checks.length - pending.length} of ${checks.length} checks done` : "CI: no checks reported yet";
    if (status !== said) log((said = status));
    if (now() - start >= timeoutMs) return { kind: "timeout", checks };
    await sleep(everyMs);
  }
}

const ANSI = /(?:\x1b|\^\[)\[[0-9;]*m/g; // gh writes ESC as a literal "^["
/** One `gh run view --log-failed` line ("job<TAB>step<TAB>timestamp text") as the text the job printed. */
const logText = (line) => line.split("\t").slice(line.split("\t").length >= 3 ? 2 : 0).join("\t").replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, "").replace(ANSI, "");

/**
 * The first failing test (vitest's `FAIL  file > name`, node:test's `✖ name`) or else the first `##[error]` in a
 * `gh run view --log-failed` log, with its test file when the log names one and a short excerpt from that point.
 */
export function failureFromLog(raw, { lines: keep = 12 } = {}) {
  const lines = String(raw ?? "").split("\n").map(logText);
  const errorAt = lines.findIndex((l) => l.startsWith("##[error]") && !/Process completed with exit code/.test(l));
  let at = lines.findIndex((l) => /^\s*FAIL\s+\S+ > /.test(l));
  let test, file;
  if (at >= 0) {
    [, file, test] = lines[at].match(/^\s*FAIL\s+(\S+) > (.+)$/);
    test = `${file} > ${test.trim()}`;
  } else if ((at = lines.findIndex((l) => /^\s*(✖ |not ok \d+ - )/.test(l) && !/^\s*✖ failing tests:/.test(l))) >= 0) {
    test = lines[at].replace(/^\s*(✖ |not ok \d+ - )/, "").replace(/ \([\d.]+m?s\)$/, "").trim();
    file = lines.slice(at).join("\n").match(/(?:test at |file:\/\/\S*?\/)((?:src|drama|mods|scripts|packages|e2e)\/\S+?\.\w+):\d+/)?.[1];
  }
  const step = errorAt >= 0 ? lines[errorAt].replace("##[error]", "").trim() : lines.filter((l) => l.trim()).at(-1)?.trim();
  if (at < 0) at = errorAt >= 0 ? Math.max(0, errorAt - keep + 2) : Math.max(0, lines.length - keep);
  const excerpt = lines.slice(at, at + keep).join("\n").trim();
  return { test, file, step, excerpt };
}

/** Whether a failure looks like the pack's doing or the game's (a perf or timing test elsewhere, say). */
export function blame({ file, test, excerpt }, day = date) {
  if (file?.startsWith("drama/") || file?.startsWith("mods/") || excerpt?.includes(`mods/drama/${day}`))
    return `It touches the pack's own files${file ? ` (${file})` : ""}.`;
  if (!file) return "The log doesn't name a test file, so it may or may not be the pack.";
  const timing = /perf|timing|budget|bench|flak/i.test(`${file} ${test}`) ? "a perf or timing test " : "";
  return `Looks unrelated to the pack: ${file} is ${timing}outside drama/ and mods/, and the pack only adds mods/drama/${day}/.`;
}

/**
 * Waits for the PR's GitHub checks and says what they found: { kind: "green", jobs } only when GitHub says every check
 * passed, { kind: "red", job, what, note, excerpt } with the failing job's log, or { kind: "timeout", minutes }.
 * Never throws: anything that goes wrong is { kind: "unknown", error }, because the PR is open either way.
 */
export async function ciStep(pr, { exec = run, timeoutMs = CI_TIMEOUT_MIN * 60_000, day = date, ...wait } = {}) {
  try {
    const minutes = Math.round(timeoutMs / 60_000);
    const { kind, checks } = await waitForChecks(pr, { exec, timeoutMs, ...wait });
    const failed = checks.filter((c) => c.bucket === "fail" || c.bucket === "cancel");
    if (kind === "timeout" && !failed.length)
      return { kind: "timeout", minutes, waiting: checks.filter((c) => c.bucket === "pending").map(jobName) };
    // Green means every check named like a CI job passed: Deploy's `check` skipped is not saved by CI's `check` passing.
    const missing = CI_JOBS.filter((name) => !checks.some((c) => c.name === name)).concat(checks.filter((c) => CI_JOBS.includes(c.name) && c.bucket !== "pass").map(jobName));
    if (!failed.length && !missing.length) {
      const passed = [...new Set(checks.filter((c) => c.bucket === "pass").map((c) => c.name))];
      return { kind: "green", jobs: passed.sort((a, b) => (CI_JOBS.indexOf(a) + 1 || 99) - (CI_JOBS.indexOf(b) + 1 || 99)) };
    }
    if (!failed.length) return { kind: "red", job: missing.join(", "), what: "skipped, so CI isn't green", note: "", excerpt: "" };
    const first = failed[0];
    const jobId = first.link?.match(/\/job\/(\d+)/)?.[1];
    const logged = jobId ? await exec("gh", ["run", "view", "--job", jobId, "--log-failed"], { quiet: true }) : { code: -1, out: "" };
    if (logged.code !== 0) return { kind: "red", job: jobName(first), what: first.state?.toLowerCase() ?? "failed", note: `(couldn't fetch its log: ${first.link ?? "no link"})`, excerpt: "" };
    const failure = failureFromLog(logged.out);
    return { kind: "red", job: jobName(first), what: failure.test ?? failure.step ?? "failed", note: blame(failure, day), excerpt: failure.excerpt, others: failed.slice(1).map(jobName) };
  } catch (error) {
    return { kind: "unknown", error: String(error?.message ?? error) };
  }
}

/** The CI result as one stdout line (the comment carries the excerpt). */
export function ciLine(ci, url) {
  if (ci.kind === "green") return `CI: green (${ci.jobs.join(", ")})`;
  if (ci.kind === "red") return `CI FAILED: ${ci.job} — ${ci.what}${ci.others?.length ? ` (also failed: ${ci.others.join(", ")})` : ""}.${ci.note ? ` ${ci.note}` : ""}`;
  if (ci.kind === "timeout") return `CI still running after ${ci.minutes} min: ${url}${ci.waiting?.length ? ` (waiting on ${ci.waiting.join(", ")})` : ""}`;
  return `CI result unknown (${ci.error}): ${url}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Report: the run tells FLT-34 how it went, so the runner doesn't need a working `bb` of its own.

const FAIL_TAIL = 30;

/** The FLT-34 comment for an outcome, in the runner prompt's words (drama/AUTOMATION.md). */
export function commentText(outcome, day = date) {
  if (outcome.kind === "skipped") {
    const reason = outcome.why.replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim();
    return `Daily Drama ${day}: skipped (quiet day). ${reason}`.trim();
  }
  if (outcome.kind === "opened") {
    const { url, ci } = outcome;
    if (ci?.kind === "green") return `Daily Drama ${day}: ${url}, ready for Jem's review. ${ciLine(ci)}.`;
    if (ci?.kind === "red") return `Daily Drama ${day}: ${url}, ${ciLine(ci)}${ci.excerpt ? `\n\n\`\`\`\n${ci.excerpt}\n\`\`\`` : ""}`;
    if (ci) return `Daily Drama ${day}: ${ciLine(ci, url)}`;
    return `Daily Drama ${day}: ${url}, opened; CI not checked.`;
  }
  if (outcome.kind === "failed") return `Daily Drama ${day}: failed\n\n\`\`\`\n${outcome.output ?? ""}\n\`\`\``;
  throw new Error(`no FLT-34 comment for outcome ${outcome.kind}`);
}

/** Counts today's failures in the git-ignored .drama-state/<day>.json. Returns this failure's attempt number. */
export async function recordFailure(stateDir, day = date) {
  const file = join(stateDir, `${day}.json`);
  const state = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  const failures = (state.failures ?? 0) + 1;
  await mkdir(stateDir, { recursive: true });
  await writeFile(file, JSON.stringify({ ...state, failures }, null, 2) + "\n");
  return failures;
}

/** Posts on FLT-34 with `bb` ($BB_CLI if set). Never throws: a comment that can't be posted is printed for the runner. */
export async function postComment(text, { noComment = false, exec = run, bb = process.env.BB_CLI || "bb", log = console.log } = {}) {
  if (noComment) { log(`FLT-34 comment (--no-comment, not posted): ${text}`); return false; }
  let result;
  try { result = await exec(bb, ["tasks", "comment", "FLT-34", "--body", text], { quiet: true }); }
  catch (error) { result = { code: -1, out: String(error) }; }
  if (result.code === 0) { log("commented on FLT-34"); return true; }
  log(`\`${bb} tasks comment FLT-34\` failed (exit ${result.code}): ${String(result.out ?? "").trim().split("\n").pop()}`);
  log(`FLT-34 comment (not posted): ${text}`);
  return false;
}

/**
 * Turns the run's outcome into its exit code, and comments on FLT-34 when there's news: opened, skipped, or a failure on
 * the second attempt. The comment never changes the exit code.
 */
export async function report(outcome, { day = date, stateDir = join(root, ".drama-state"), tail = () => "", ...post } = {}) {
  const log = post.log ?? console.log;
  if (outcome.kind === "green") return 0; // --no-pr: a local run, no news for FLT-34
  if (outcome.kind === "failed") {
    const attempt = await recordFailure(stateDir, day);
    if (attempt < 2) {
      log(`drama-run ${day}: NOT GREEN (attempt 1 of 2; run the same command again)`);
      return 1;
    }
    log(`drama-run ${day}: NOT GREEN (attempt ${attempt} of 2), so FLT-34 hears about it`);
    await postComment(commentText({ kind: "failed", output: tail(FAIL_TAIL) }, day), post);
    return 1;
  }
  await postComment(commentText(outcome, day), post);
  return 0;
}

/** Tees stdout and stderr, so a failure comment can quote the last lines of the run. */
function captureOutput() {
  let text = "";
  const restore = [process.stdout, process.stderr].map((stream) => {
    const write = stream.write;
    stream.write = (chunk, ...rest) => {
      text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
      return write.call(stream, chunk, ...rest);
    };
    return () => { stream.write = write; };
  });
  return {
    tail: (n) => text.trimEnd().split("\n").slice(-n).join("\n"),
    stop: () => restore.forEach((undo) => undo()),
  };
}

/** The whole run, from fetch to PR. Returns { kind: "skipped" | "opened" | "failed" | "green", ... }. */
async function author(steps) {
  await mkdir(work, { recursive: true });
  await steps.fetchStep();
  const room = await buildRoom();
  const agent = await steps.writeStep(room);
  const got = await collect(room);
  if (!has("--keep-room")) await rm(room, { recursive: true, force: true });
  else say(`room kept at ${room}`);
  if (got.skipped) {
    say(`quiet day, skipped:\n${got.why.trim()}`);
    return { kind: "skipped", why: got.why };
  }
  const { ok, transcript, pr } = await checkStep();
  console.log(transcript);
  if (!ok) { say(`NOT GREEN, no PR. The pack is in ${relative(root, packDir)}; fix it and run \`node scripts/drama-run.mjs pr --date ${date}\`.`); return { kind: "failed" }; }
  if (has("--no-pr")) { say(`green; --no-pr, so stopping here. Pack: ${relative(root, packDir)}; PR body would use ${relative(root, join(work, "pr.json"))}`); return { kind: "green" }; }
  const url = await steps.prStep({ transcript, pr, agent });
  say(`opened ${url}`);
  return { kind: "opened", url, ci: await waitStep(steps, url) };
}

/** Waits for the PR's CI and prints the result. The PR is open whatever CI says, so this never fails the run. */
async function waitStep(steps, url) {
  const minutes = Number(flag("--ci-timeout") ?? CI_TIMEOUT_MIN);
  say(`waiting for CI on ${url} (up to ${minutes} min)`);
  const ci = await steps.ciStep(url, { timeoutMs: minutes * 60_000, log: say });
  say(ciLine(ci, url));
  return ci;
}

/**
 * `deps` swaps steps out for a fake author (fetchStep, writeStep, prStep), the `bb` call (exec) or the state directory,
 * so the run can be exercised without the network, a model or a real comment.
 */
export async function main(deps = {}) {
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "all";
  if (command === "check") {
    const dir = resolve(args[1] && !args[1].startsWith("--") ? args[1] : packDir);
    const { ok, transcript } = await checkPack(dir);
    console.log(transcript);
    return ok ? 0 : 1;
  }
  if (command === "fetch") return await fetchStep(), 0;
  if (command === "pr" || command === "body") {
    const { ok, transcript, pr } = await checkStep();
    if (!ok) { console.log(transcript); return 1; }
    const agent = existsSync(join(work, "agent.json")) ? JSON.parse(await readFile(join(work, "agent.json"), "utf8")) : null;
    if (command === "body") {
      // Rewrites the PR body only (for `gh pr edit <n> --body-file`), without committing or opening anything.
      await writeFile(join(work, "pr-body.md"), prBody({ pr, transcript, agent, mod: JSON.parse(await readFile(join(packDir, "mod.json"), "utf8")) }));
      say(`wrote ${relative(root, join(work, "pr-body.md"))}`);
      return 0;
    }
    say(`opened ${await prStep({ transcript, pr, agent })}`);
    return 0;
  }
  const { stateDir, exec, ...steps } = { fetchStep, writeStep, prStep, ciStep, ...deps };
  if (command === "ci") {
    // Waits for an open Drama PR's CI (today's drama-<date> branch, or a PR number or URL) and reports it on FLT-34,
    // as the full run would have: for a run that was cut off while it waited.
    const ref = args[1] && !args[1].startsWith("--") ? args[1] : `drama-${date}`;
    const viewed = await run("gh", ["pr", "view", ref, "--json", "url", "--jq", ".url"], { quiet: true });
    if (viewed.code !== 0) { say(`no PR for ${ref}: ${viewed.out.trim()}`); return 1; }
    const url = viewed.out.trim();
    return await report({ kind: "opened", url, ci: await waitStep(steps, url) }, { stateDir, exec, noComment: has("--no-comment") });
  }
  if (command !== "all") throw new Error(`unknown step ${command}: all | fetch | check [dir] | pr | body | ci [pr]`);

  const output = captureOutput();
  try {
    let outcome;
    try {
      outcome = await author(steps);
    } catch (error) {
      console.error(`drama-run ${date}: ${error.stack ?? error}`);
      outcome = { kind: "failed" };
    }
    return await report(outcome, { stateDir, exec, tail: output.tail, noComment: has("--no-comment") });
  } finally {
    output.stop();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().then((code) => { process.exitCode = code; }, (error) => { console.error(`drama-run ${date}: ${error.stack ?? error}`); process.exitCode = 1; });

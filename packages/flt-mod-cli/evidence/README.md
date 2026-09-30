# FLT-36 evidence: private M2 modder kit

This is tooling and unactivated example content. No live game view changes;
M1b will supply game loading and full content execution. No sim/UI files or
golden digests were edited by this task. FLT-14 and FLT-35 were merged from main;
the only conflict was package.json and both sets of additive scripts were kept.

## Fresh-agent dry run

Model: `gpt-6.1-sol`, fresh ephemeral Codex process, no inherited conversation,
working in a clean `/tmp` directory outside the repo. Inputs: only the generated
template (including AGENTS.md) and copied modding skill. Exact request:

> Make a mod where every protester is a golden retriever with opinions.

The supplied command was `pnpm test`; the agent was instructed not to inspect the
repository or edit outside its directory. The transcript records three commands:
list local files; read the template/skill; write mod.json and run `pnpm test`.
No repo inspection, install, human correction or external message occurred.
An initial infrastructure attempt could not launch nested bwrap on Modal and
made no edits; the approved retry ran successfully. The final template was also
tested in a new fresh process after making TypeScript opt-in. That final run
passed on the first authored manifest/check attempt.

The resulting manifest is [golden-retrievers.mod.json](golden-retrievers.mod.json).
It overrides the existing protester kind, adds six opinions and two headlines.
It retains independent entity presentation. Its actual checker transcript:

```text
PASS golden-retrievers@1.0.0: 365 days, 7300 ticks, 17 cards answered, 2 releases
Replay identical: 6d56d759d970eca1206d4d11a70c15d6fd437990e2ee766d417d9a66ce373305
cash $16948233; 1338 ms
Arc reachability: 0 arcs checked with xstate/graph (structural, guards/actions omitted)
M1a applied: base simulation only
M1b deferred: headlines; thoughts; walkerKinds — full runtime lookup awaits M1b
```

The agent explicitly reported that the schema/composition check does not supply
a dog mesh or prove new content executes or renders. Public-site loading awaits
M1b, as the spec requires.

## End-to-end contract coverage

`pnpm typecheck` includes the SDK and typed starter. Type-negative fixtures
prove that API versions, required headline fields and unknown manifest keys are
caught during authoring. SDK manifest types derive from the actual Effect Schema.

`pnpm test` includes eight Node kit checks after the game's Vitest suite:
M1a's two examples; SDK and typed/JSON template parity; all ten skill examples;
scaffolding in a clean temp directory and asset bundling; CORS dev serving and
rereading edits; graph alternatives, nested states and ancestor transitions.
Installed workspace CLI/scaffolder bins are tested through pnpm symlink paths.
These also reject malformed manifests, duplicate scaffold destinations, remote
assets, directory traversal, escaping symlinks and unreachable graph states.
Local skin assets are inlined along with root assets. Servers close in finally.

The CLI's arc check uses `xstate/graph` with a structural projection: every
transition alternative gets a separate analysis event, and guards/actions are
omitted. This avoids silently dropping later guarded branches. It is not a proof
of runtime guard satisfiability or action parameter semantics.

## Choices and limits

- Packages are private, source-linked pnpm workspaces; nothing was published.
- JSON is the scaffold default. Copy mod.example.ts to mod.ts and install the
  linked SDK to opt into typed authoring. Explicit file paths select that file;
  directory commands prefer mod.ts if one exists.
- Bundle produces `<id>.fltmod.json` in the mod directory by default, or an
  explicitly supplied output path (use mod.json to generate JSON from TypeScript).
- Local asset paths are confined to the mod directory; remote URLs are rejected.
- Dev serves CORS on 5174, without claiming game loading or hot-reload.
- Faction thoughts target today's existing entity kinds. FLT-17 disaster verbs
  were not merged/registered, so the skill uses existing card effects instead.
- M1a coverage and M1b-deferred sections remain explicit on every check report.

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm exec flt-mod check mods/examples/every-lab-is-steve/mod.json
pnpm exec flt-mod check mods/examples/headline-pack/mod.json
pnpm exec flt-mod check packages/flt-mod-cli/evidence/golden-retrievers.mod.json
pnpm create-mod my-mod
pnpm --dir my-mod test
pnpm exec flt-mod bundle my-mod
pnpm exec flt-mod check my-mod/my-mod.fltmod.json
```

## Final validation (integrated with main at 15475da)

`pnpm install --frozen-lockfile` passed. `CI=1 pnpm check` passed SDK/template
typechecking, 452 game tests in 39 files (including golden/perf tests), all eight
kit tests, and the production build. A previous unadjusted `pnpm check` was green;
a later unadjusted repeat measured the 800-walker tick at 0.538 ms against its
0.5 ms local cap. The shared host was validated using the repository's existing
CI perfBudget setting (1.0 ms); no sim or performance limit was changed.

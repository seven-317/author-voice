# Contributing to author-voice

Thanks for extending the skill. This project is two things, and they have
different quality bars:

1. **Prompt rules** (`SKILL.md`, `.agent-skills/*.md`) — instructions an AI agent
   reads. "Quality" here means the rules are unambiguous, the examples teach by
   contrast, and the output keeps sounding like the developer.
2. **A deterministic helper** (`scripts/git-context.ts`) — TypeScript that does
   the Git plumbing. "Quality" here means it is typed, predictable, and **never
   calls a model**.

Read this before adding a rule file, editing the persona, touching the router, or
changing the helper.

## Architecture in one minute

```
skills/author-voice/                      # the installable skill package
├── SKILL.md                              # Router only — no task content
├── .agent-skills/
│   ├── 00-developer-persona.md           # Global voice dependency, loaded first
│   ├── 01-git-commits.md                 # Per-task rule file
│   ├── 02-pull-requests.md               # Per-task rule file
│   └── 03-issues-management.md           # Per-task rule file
└── scripts/
    └── git-context.ts                    # Deterministic Git plumbing (no LLM)
```

Repo-root files (`README.md`, `CONTRIBUTING.md`, `package.json`, `tsconfig.json`,
`LICENSE`) are project tooling, not part of the installed skill. Only
`skills/author-voice/` ships when someone runs `npx skills add`.

Roles, kept separate on purpose:

- **Router (`SKILL.md`)** — detects intent and delegates. Owns the global
  contract, the intent→file table, and the helper's command list. Owns no task
  rules.
- **Persona (`00-…`)** — defines *who is speaking*. Every task inherits it.
- **Task files (`01+`)** — define *format* on top of that voice. One surface per
  file.
- **Helper (`scripts/git-context.ts`)** — gathers Git state and applies commits.
  It is the *hands*; the agent is the *brain*. The helper writes no prose.

The single most important idea: **there is exactly one brain, the agent.** The
helper must never generate commit/PR/issue text, never call an LLM, and never
need an API key. If a change blurs that line, it is wrong by construction.

## Invariants — do not break these

1. **`SKILL.md` stays a router, under 500 lines.** No commit/PR/issue rules live
   in it. Task detail belongs in a task file.
2. **The persona is loaded first, always.** Every task file opens by asserting
   `00-developer-persona.md` is already loaded. Keep that line.
3. **Everything is written in English** — both the rule files and the helper's
   output and messages.
4. **Every task file ends with an output contract** stating exactly what the
   agent returns (the raw artifact, ready to paste, no preamble, no closing
   question).
5. **Repo convention beats our defaults.** Rules instruct the agent to read the
   project's `git log` / `.github/` templates and match the house style first.
6. **The helper stays deterministic and model-free.** No network calls to an LLM,
   no API key, no prose generation. Reading Git state and running Git commands is
   the entire job.

## Dev setup

The helper needs no dependencies to *run* (Node ≥ 23.6 strips the TypeScript
natively). Install dev deps only to typecheck:

```bash
npm install        # typescript + @types/node
npm run typecheck  # tsc --noEmit, must pass clean
```

To try the skill end to end, install your working copy with the `skills` CLI by
its local path, then dogfood it on a real repo:

```bash
npx skills add ./skills/author-voice -g
```

## Adding a new rule file

Say you want to cover release notes or a changelog. The shape is fixed so the
router stays predictable:

1. **Create `skills/author-voice/.agent-skills/NN-your-surface.md`.** Number it
   next in sequence (`04-…`). Short, kebab-case, surface-named filename.
2. **Open with the prerequisite line.** State that the persona is already loaded
   and that this file adds *format* on top of *voice*.
3. **Write the format rules**, then a **good vs. bad example pair** (see below),
   then the **output contract**.
4. **Add exactly one row to the router table in `SKILL.md`** mapping the
   triggering intent (and command, e.g. a `gh release create`) to your file.
5. **Add disambiguation** to `SKILL.md` only if the new surface is easy to
   confuse with an existing one.

One file, one router row. If a change needs more, it probably breaks invariant 1.

## Extending the helper

Keep it boring and deterministic. To add a subcommand to
`skills/author-voice/scripts/git-context.ts` (say, `tag-context`):

1. Add a `cmdYourThing(repoRoot)` function that only runs Git via the existing
   `runGit` helper and writes plain text to stdout.
2. Wire it into the `switch` in `main()`.
3. Surface it in the **Repository tooling** list in `SKILL.md` and reference it
   from the relevant task file.
4. Errors the user should see go through `CliError` (printed without a stack);
   unexpected ones fall through to the generic handler.
5. Run `npm run typecheck`. Keep zero runtime dependencies.

Do **not** add: an HTTP/LLM client, an API key, a flag that makes the helper
write commit/PR text, or anything non-deterministic.

## Editing the persona

`00-developer-persona.md` is load-bearing for every task. Changes ripple
everywhere:

- **Adding a banned phrase** is the safest, most common change. Put it in the
  right bucket (assistant framing / operational nagging / filler / tooling
  attribution) and add a wrong→right row demonstrating it.
- **Changing an allowed voice** (the first-person / imperative rule) breaks every
  task file's examples — open an issue first.

## Writing examples that teach

Examples are how the agent calibrates. Weak examples are the top reason a rule
fails to land. Follow the house pattern:

- **Always pair bad with good.** The bad example must contain the specific
  failure the rule targets — assistant framing, a diff replay, a missing repro
  field — not a strawman.
- **Annotate the bad one** with a short "Why it fails:" line naming the offenses.
- **Keep the domain consistent.** Examples use a **Next.js + Supabase** codebase
  (auth session sync, signed uploads, the dashboard query). Reuse that domain so
  the set reads as one project's history.
- **Make the good example real.** Concrete files, functions, env vars, and a
  before/after number where one exists. `Fix auth` teaches nothing.

## Style of the rule files themselves

- Imperative, instructional voice — you are writing orders for an agent, not
  prose for a human reader.
- Wrap Markdown at ~80 columns to keep diffs readable.
- Use tables for wrong→right contrasts and intent→file mappings.
- Prefer a checklist or numbered procedure over a paragraph when the agent has to
  *do* something in order.

## Verifying a change

There is no behavioral test runner for the rules — the artifact is text an agent
produces. Verify by dogfooding:

1. Point an agent at `SKILL.md` and have it perform the task your change covers,
   against a real staged diff or issue.
2. Run the **self-check list** from `SKILL.md` against the output: persona
   applied, no assistant tone, no second-person address, format matches the
   route, artifact-only output.
3. For helper changes, run `npm run typecheck` and exercise the subcommand on a
   real repo (including the failure paths — nothing staged, empty stdin).

## Commits and PRs

Dogfood the skill. Write your own commits, PR, and issues for this repo using
`author-voice` itself — Conventional Commits, Why-first PR body, reproducible
issues. A contribution that improves the voice while violating it in its own
history is a red flag the rules aren't working.

## Scope

Good contributions: a new surface (release notes, changelog, review comments), a
sharper banned-phrase list, a clearer example pair, a disambiguation that
resolves a real routing ambiguity, a deterministic helper subcommand.

Out of scope: turning a rule file into a general style guide, embedding
project-specific conventions that belong in a consuming repo's own config,
anything that makes `SKILL.md` carry task content, and anything that gives the
helper a brain (LLM calls, API keys, prose generation).

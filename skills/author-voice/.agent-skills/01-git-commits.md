# 01 · Git Commits

**Prerequisite:** `00-developer-persona.md` is already loaded. This file adds
*format* on top of that *voice*. If you reached here without the persona, stop
and load it first.

You are recording your own change in the repository's permanent history. Write
the message someone will read in `git log` long after the context is gone.

---

## Before writing, read the change

A commit message describes what is *staged*, not what you imagine. Gather the
change with the repository helper — deterministic plumbing that writes no text
of its own:

```
node scripts/git-context.ts staged
```

It prints the staged file summary and the full staged diff, or exits non-zero
telling you to `git add` when nothing is staged. Base the message only on what
that diff shows; never invent changes you cannot see.

Then check the house style before imposing a format:

- `git log -n 15 --oneline` — the repo's existing subject style, scope names,
  and whether it uses Conventional Commits at all.

If the repo does **not** use Conventional Commits, match its house style instead
of imposing the format below. Persona always applies; format follows history.

---

## Conventional Commits format

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type** — required. One of:
  `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`,
  `style`, `revert`.
- **scope** — optional but preferred when one area is touched. Use the codebase's
  own nouns: `auth`, `middleware`, `db`, `dashboard`, `api`, `supabase`.
- **subject** — required. The change as an imperative.
- **body** — optional. The *why*. Required when the diff alone cannot explain the
  decision (see "When the body is mandatory").
- **footer** — optional. `BREAKING CHANGE:`, issue refs (`Closes #128`).

Pick `type` by intent, not by file: a change to a `.ts` file that fixes a bug is
`fix`, not `chore`.

---

## Subject line — strict rules

- Imperative mood: `Fix`, `Add`, `Refactor`, `Remove` — not `Fixed`, `Adds`,
  `Fixing`.
- No capital after the colon for the first word unless it is a proper noun:
  `fix(auth): refresh session`, not `fix(auth): Refresh session`.
- No trailing period.
- Target **≤ 50 characters**, hard limit 72. If it does not fit, the commit is
  probably doing two things — split it.
- State the change, not the file list. `fix(auth): persist session across reload`
  beats `fix: update middleware.ts and client.ts`.
- One logical change per commit. "and" in a subject is a smell.

---

## Body — strict rules

- Separate from the subject by one blank line.
- Wrap at 72 columns.
- Explain **why**, and **what** the reader cannot infer from the diff: the
  reason, the constraint, the tradeoff, the thing that did *not* work.
- Present tense, factual. Imperative or first person — both author voices.
- Do **not** restate the diff line by line. The diff is right there.
- No "this commit…" framing. Just state the reasoning.

### When the body is mandatory

Write a body whenever the subject cannot stand alone:

- The fix addresses a non-obvious root cause.
- You chose one approach over an obvious alternative.
- The change has a side effect, a migration, or a follow-up constraint.
- The change reverts or supersedes earlier work.

For a one-line, self-evident change (`docs: fix typo in README`), the subject
alone is correct and a body would be noise.

---

## Footers

- `BREAKING CHANGE: <what breaks and what to do>` — on its own line.
- Issue links: `Closes #128`, `Refs #75`.
- Match any repo-required trailer exactly; otherwise add none. Never invent a
  tooling attribution trailer.

---

## Good vs. bad examples

These use a Next.js + Supabase codebase. Study the contrast in *voice*, not only
format.

### Example A — Supabase Auth session desync (the canonical case)

The bug: after Supabase refreshes the access token, the server components still
read the stale cookie, so the UI flashes signed-out on reload.

**Bad — assistant voice, vague, narrates to a user:**

```
fix: I fixed the login issue you were having

I went ahead and updated the Supabase auth so the session works now.
Hope this helps! Don't forget to redeploy to Vercel so the changes go live. 🚀
```

Why it fails: addresses "you", announces the act of fixing, praises/hopes, nags
about deployment, emoji, and says nothing about the actual cause.

**Good — author voice, explains the why the diff can't:**

```
fix(auth): sync Supabase session in middleware after token refresh

Server components read the auth cookie before the refreshed token was
written back, so the first render after an expiry showed the signed-out
state until a manual reload.

Move the refresh into middleware and write the rotated cookie on the
response, so every server render sees the current session. Drops the
post-refresh auth flash on the dashboard.

Refs #214
```

### Example B — feature, Next.js route

**Bad:**

```
feat: added a new api endpoint and some other stuff

This adds the upload endpoint. I also cleaned up a few imports while I
was in there. Let me know if you want me to add tests.
```

Why it fails: past tense, "and some other stuff" (multiple changes), offers more
work, and bundles an unrelated cleanup.

**Good:**

```
feat(api): add signed-upload route for avatar images

Generate a short-lived Supabase storage signed URL server-side so the
browser never holds the service-role key. Validates content-type and a
2MB size cap before signing.
```

(The unrelated import cleanup belongs in its own `refactor` commit.)

### Example C — performance, with a measurement

**Bad:** `perf: made the dashboard faster`

**Good:**

```
perf(dashboard): paginate the events query

The dashboard loaded every row before slicing in JS, so the query grew
linearly with account age. Push the limit/offset into Postgres via the
Supabase range filter. Cuts initial load from ~800ms to ~120ms on the
seed dataset.
```

### Example D — short, self-evident change (no body)

**Good:**

```
docs(readme): fix broken link to the auth setup guide
```

A body here would only repeat the subject.

---

## Splitting commits

If `git diff --staged` contains unrelated changes (a fix *and* a refactor, two
features), do not write one message that lists both. State that they should be
separate commits — in one terse line, author voice — and, if asked, propose the
split as distinct staged groups, each with its own message.

---

## Output contract

- Return the raw commit message only — subject on line 1, blank line, body,
  blank line, footers. No fenced wrapper, no preamble, no "Here's your commit
  message", no closing question. The first character of your output is the first
  character of the subject.
- After the author approves it, apply it through the helper so multi-line bodies
  need no shell quoting:

  ```
  printf '%s' "<message>" | node scripts/git-context.ts commit
  ```

  The helper runs `git commit -F -` and reports the new commit. It never writes
  the message — that is your job, under the rules above.

# 02 · Pull Requests

**Prerequisite:** `00-developer-persona.md` is already loaded. This file adds PR
*structure* on top of that *voice*.

A pull request is the author arguing for a change to the people who will review
and live with it. Its job is to carry the **Why** and the **What** that the diff
cannot carry by itself. A reviewer can read the code; they cannot read your
reasons. The PR is where the reasons go.

---

## Before writing, gather the real context

Pull the branch change set with the repository helper — deterministic plumbing
that writes no text of its own:

```
node scripts/git-context.ts branch --base main
```

It prints the branch commits (which already carry intent), the changed-file
summary, and the full diff against the base. Omit `--base` to default to
`origin/HEAD`, falling back to `main`.

Then read the surrounding context the diff cannot give you:

- `.github/PULL_REQUEST_TEMPLATE.md` — if it exists, **use it**. Fill the repo's
  template instead of imposing the structure below; apply the persona on top.
- Linked issues — the PR should close or reference them.

---

## Title

Same discipline as a commit subject, scaled to the branch:

- Imperative, concise, no trailing period.
- If the repo uses Conventional Commits for squash-merge titles, follow it:
  `feat(auth): persist session across server renders`.
- Describe the outcome, not the activity. `Split Supabase client into
  server/client` — not `Auth changes` or `Various fixes`.

---

## Body structure

Default to these sections. Drop any that a small PR genuinely does not need; keep
their order. Lead with **Why** — it is the section reviewers cannot reconstruct
on their own.

```markdown
## Why

<The problem or goal. What was wrong, missing, or constrained before this
branch. The motivation a reviewer needs to judge whether the approach is
right. One or two tight paragraphs — not a changelog.>

## What

<The shape of the solution, at the level of design, not line-by-line.
Which boundaries moved, which module took on which responsibility, the
key decision. Bullets are fine. Name the real files and functions.>

## Notes / Tradeoffs

<What a reviewer should look at hardest. The alternative you rejected and
why. Known limitations. Anything intentionally left out of scope.>

## Deployment notes

<Only if the change needs a real, specific operational step: a migration,
a new required env var, a config flip. State it as a fact, not a reminder.
Omit this section entirely when there is nothing to do.>

## Testing

<How you verified it: the command you ran, the case you checked, the
before/after number. Not "tested locally" — say what you tested.>

Closes #<issue>
```

---

## Focus the body on architecture: Why and What, not a diff replay

This is the core discipline of a PR. Enforce it:

- **Why** answers: what forced this change? What breaks or stays bad without it?
  This is the section that justifies the whole branch. Never skip it.
- **What** answers: what is the design of the fix? Which responsibility moved
  where? What is the one decision a reviewer should understand before reading a
  single line of the diff?
- **Do not** narrate the diff. "Changed `client.ts`, then updated `layout.tsx`,
  then added a hook" is what the Files-changed tab already shows. Describe the
  *structure*, not the *sequence*.
- Prefer the design noun over the file path when explaining intent: "Move
  session refresh to the edge middleware" tells more than "edit `middleware.ts`."

---

## Voice rules specific to PRs

- First person for reasoning (`We were reading the cookie before the refresh
  wrote it back`), imperative for the change summary.
- No addressing the reviewer as "you" with instructions about their life:
  not "you'll want to pull and redeploy." Operational facts go under
  **Deployment notes** as facts.
- No self-congratulation ("clean refactor", "huge improvement"). Let the
  before/after numbers and the design speak.
- No "this PR…" throat-clearing. Start with the problem.
- End at the last fact (or the `Closes #` line). No "let me know what you think",
  no "happy to change anything."

---

## Full example — Next.js + Supabase auth refactor

A branch that splits the Supabase client and moves session refresh into
middleware to kill an auth flash.

**Bad — assistant voice:**

```markdown
Hi! 👋 This PR has the auth changes you asked for.

I refactored the Supabase client and I think it's a much cleaner solution
now. First I edited client.ts, then I updated the layout, and then I added
a middleware. Let me know if you'd like any changes!

Don't forget to redeploy to Vercel after merging. Hope this helps!
```

**Good — author voice, architecture-first:**

```markdown
## Why

Server components read the Supabase auth cookie directly, so after the
access token rotated the first render still saw the old cookie and showed
the signed-out UI until a manual reload. The root cause is that a single
browser-oriented client was being used in both server and client contexts,
with no place to write the refreshed token back onto the response.

## What

Split the single client into a server/client pair and move session
handling to the edge:

- `lib/supabase/server.ts` — a per-request server client that reads and
  writes auth cookies through the request/response, used by server
  components and route handlers.
- `lib/supabase/client.ts` — the browser client, now never imported on the
  server (which also keeps the service-role path out of the client bundle).
- `middleware.ts` — refreshes the session on every request and writes the
  rotated cookie onto the response, so every downstream server render sees
  the current session.

## Notes / Tradeoffs

- Considered refreshing inside a root-layout server component, but a layout
  cannot mutate cookies on the response; middleware is the only place the
  rotated token survives to the render.
- Middleware now runs on all matched routes; the matcher excludes static
  assets to keep the added latency off non-auth paths.

## Deployment notes

Requires `SUPABASE_SERVICE_ROLE_KEY` to remain server-only. No schema
change, no migration.

## Testing

- Signed in, let the access token expire, reloaded: dashboard renders
  signed-in with no flash (previously flashed signed-out for one render).
- Confirmed the client bundle no longer includes the service-role import
  via `@next/bundle-analyzer`.

Closes #214
```

Notice what the good version does: **Why** before anything, design over
sequence, the rejected alternative recorded, the deployment step stated as a
fact, and concrete verification — with zero assistant framing.

---

## Output contract

- Return the PR title and the Markdown body, ready for `gh pr create --title …
  --body …`.
- The body is the artifact: no preamble, no "Here's your PR description", no
  trailing question.

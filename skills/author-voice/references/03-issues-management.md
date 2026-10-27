# 03 · Issues Management

**Prerequisite:** `00-developer-persona.md` is already loaded. This file adds
issue *templates* on top of that *voice*.

An issue is the author filing a problem or a request in their own tracker. Write
it as a developer logging work for the team and for their future self — not as an
assistant describing a problem back to a user. The reader is whoever picks the
issue up next; give them everything they need to act and nothing they have to
wade through.

---

## Before writing

- `.github/ISSUE_TEMPLATE/` — if templates exist, **fill them**. Match the repo's
  fields and labels; apply the persona on top.
- Existing open issues — avoid filing a duplicate; reference the related one if
  it exists.
- The actual symptom or request — be concrete. Vague issues die in the backlog.

Decide the kind first: a **bug report** describes broken behavior that exists; a
**feature request** describes desired behavior that does not exist yet. Use the
matching template below.

---

## Title

- Imperative or a crisp noun phrase, no trailing period.
- Lead with the symptom for bugs, the capability for features.
- Specific enough to scan in a list:
  - Bug: `Session shows signed-out for one render after token refresh`
  - Feature: `Add signed-upload route for avatar images`
- Not: `Bug`, `It doesn't work`, `Auth problem`, `Improvement`.

---

## Bug report template

```markdown
## Summary

<One or two sentences: what is broken, where. State it as a fact.>

## Steps to reproduce

1. <Exact, ordered steps. Start from a known state.>
2. <Include the data, route, or input that triggers it.>
3. <Stop at the action that exposes the bug.>

## Expected behavior

<What should happen at the final step.>

## Actual behavior

<What happens instead. Include the error text, status code, or wrong
output verbatim — not a paraphrase.>

## Environment

- App / commit: <version, branch, or commit SHA>
- Runtime: <e.g. Next.js 15.1, Node 20, Supabase JS 2.x>
- Platform: <browser + OS, or server region>

## Evidence

<Logs, stack trace, failing query, screenshot, or a minimal repro link.
Trim to the relevant lines.>

## Notes

<Optional: suspected cause, the commit that introduced it from `git
bisect`, scope. Only if you actually know something — no speculation
dressed as fact.>
```

### Required fields, non-negotiable

A bug report without **steps to reproduce**, **expected**, and **actual** is not
actionable. If a field is genuinely unknown, write `Unknown` and say what was
tried to find it — do not omit the field and do not invent a value.

---

## Feature request template

```markdown
## Problem

<The need or the gap. Why the current behavior is insufficient. Describe
the problem, not a pre-chosen solution — this is the section that justifies
the work.>

## Proposed change

<What should exist. The capability and its rough shape. Name the surface it
touches: route, component, table, API.>

## Acceptance criteria

- [ ] <Observable condition that means "done".>
- [ ] <Each one independently checkable.>

## Alternatives considered

<Other approaches and why they fall short. Omit if there is genuinely only
one path.>

## Notes / Out of scope

<Constraints, dependencies, and what this explicitly does not cover.>
```

---

## Good vs. bad examples

### Bug — Supabase Auth session desync

**Bad — assistant voice, unactionable:**

```markdown
Title: Login is broken

Hey, it looks like there might be an issue with the login on your app. I
think the session isn't working correctly sometimes. You might want to
look into the Supabase auth configuration. Let me know if you need help
debugging this!
```

Why it fails: addresses "you/your app", no steps, no expected/actual, no
environment, speculates, and offers help instead of logging facts.

**Good — author voice, reproducible:**

```markdown
Title: Session shows signed-out for one render after token refresh

## Summary

After the Supabase access token rotates, the first server render reads the
stale auth cookie and the dashboard flashes the signed-out state until a
manual reload.

## Steps to reproduce

1. Sign in.
2. Wait for the access token to expire (or set its TTL to 60s locally).
3. Reload the dashboard.

## Expected behavior

The dashboard renders signed-in using the refreshed session.

## Actual behavior

The first render shows the signed-out UI; a second manual reload then
renders signed-in.

## Environment

- App / commit: `main` @ 9f3c1a2
- Runtime: Next.js 15.1 (App Router), Supabase JS 2.45
- Platform: Chrome 124 / macOS, also reproduced on Vercel edge

## Evidence

Server log shows `getUser()` returning null on the first request after
expiry, then the user on the next. Cookie diff confirms the rotated token
is not written back on the failing render.

## Notes

Likely the cookie write happens after the server component reads it; the
refresh has no place to persist onto the response. Candidate fix: handle
refresh in middleware. Related to #200.
```

### Feature — signed uploads

**Bad:** `Title: Add file uploads — we should let users upload avatars, it would
be a nice feature. I can build this for you if you want.`

**Good:**

```markdown
Title: Add signed-upload route for avatar images

## Problem

Avatar upload currently has no server path, so the browser would need the
Supabase service-role key to write to storage. That key must never reach
the client, so the feature is blocked on a server-side signing step.

## Proposed change

Add a server route that issues a short-lived Supabase storage signed URL.
The browser uploads directly to that URL; the service-role key stays on
the server.

- Route: `POST /api/avatars/sign`
- Validates content-type (`image/*`) and a 2MB size cap before signing.

## Acceptance criteria

- [ ] Browser can upload an avatar without any service-role key in the
      client bundle.
- [ ] Non-image or oversized requests are rejected before a URL is issued.
- [ ] Signed URLs expire within 60s.

## Alternatives considered

- Proxying the file bytes through the Next.js server: simpler, but doubles
  bandwidth and risks the body-size limit on the platform. Signed URL keeps
  the transfer browser-to-storage.

## Notes / Out of scope

Image resizing and CDN caching are separate follow-ups.
```

---

## Voice rules specific to issues

- Report facts; do not address a user or offer to fix it yourself. The issue is
  the record, not a conversation.
- No "I think it might be" hedging in the factual fields. Put genuine uncertainty
  in **Notes**, labeled as a hypothesis.
- Imperative or noun-phrase titles; first person is fine in the body for
  reasoning.
- End at the last field. No "let me know", no closing question.

---

## Output contract

- Return the title and the Markdown body, ready for `gh issue create --title …
  --body …`.
- The body is the artifact: no preamble, no sign-off.

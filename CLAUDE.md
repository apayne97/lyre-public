# lyre-public

A static HTML/JS chord/theory app (no build step). Sessions working here are
often `/worker` sessions in their own git worktree, with no memory of past
lyre-public conversations — the norms below exist to make up for that.

## Before implementing

Alex's idea, as first described, is often not quite what he means. Don't
start editing right after he outlines something — first restate, in a few
sentences: what you understand the goal to be, and the specific approach
you're about to take (which files, what changes). Wait for him to confirm or
correct before writing code. This replaces guessing, building the wrong
thing, and redoing it after he clarifies.

## While working

- **Ask before big changes.** A big change is anything touching more than a
  couple of files, changing a data format/schema, or altering behavior
  beyond what was asked. Small, obviously-scoped edits (a typo, a style
  tweak, the exact thing just confirmed above) don't need a check-in.
- **When something breaks or the original approach doesn't work**, stop and
  bring it to Alex rather than picking a new approach yourself. Explain what
  broke and what the options are — he wants to be part of that decision, not
  just told the outcome.
- **Explain briefly after each turn** — what you changed and why, a couple
  of sentences, not a full report.

## Verification

After a batch of frontend changes, start a local static server (e.g.
`python3 -m http.server <port>` from the repo/worktree root) and give Alex
the `http://localhost:<port>/<page>.html` link unprompted — don't wait for
him to ask. Reuse a consistent port across the session; restart the server
if it died earlier.

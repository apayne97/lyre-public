# What is an ADR

An **Architecture Decision Record** (ADR) is a short file that records one decision, why it was made,
and what evidence supports it, so a later session does not re-derive or silently reverse it.

## When to write one
- A choice between real alternatives that affects how the app or its data behaves.
- Something a future session could plausibly "fix" by undoing it.

Not for workarounds, quick tests, or guesses nobody decided. Zero is a fine number.

## Rules
- One decision per file: `decisions/NNNN-short-slug.md`, numbered in order. Start from `0000-template.md`.
- Lead with the decision. Link evidence (commits, PRs, files).
- Status: `proposed` (drafted), `accepted` (Alex accepted), `superseded`. Only Alex accepts.
- Never rewrite an accepted ADR. To change a decision, write a new ADR that `supersedes` it.
- No goal, stage or issue references inside an ADR; link from the issue to the ADR instead.

# 0002: Colliding section abbreviations are warned about, not auto-resolved; charts use "Verse 1"/"Verse 2"

- **Status:** accepted
- **Date:** 2026-11-18
- **Supersedes:** (none)

## Decision
Section auto-abbreviation stays "initials of each word". The chart convention is to number sections with digits
("Verse 1", "Verse 2" -> V1, V2), not Roman numerals. When two *different* section names still abbreviate the same
(e.g. "Verse I"/"Verse II" -> VI, "Intro"/"Interlude" -> I), the song shows a non-fatal warning above the structure
chips telling the user to rename or add a `(XYZ)` marker under one section.

## Why
"Verse I" and "Verse II" both became "VI", so structure chips and per-occurrence lyric tags collided on Alex's
"Stranger" chart (PR #12 worked around the effect). Rewriting Roman numerals to digits in code would add rules
that only paper over a naming habit and would change the chips of charts that work today.

## Alternatives considered
- Convert trailing Roman numerals to digits in `abbreviateSectionName` (Verse II -> V2), plus a legacy-initials
  fallback for old `Structure: VI, VII` entries: more code and a second set of rules for a naming habit; rejected.
- Longer fallback abbreviations (e.g. "VeI"/"VeII"): unpredictable, still can collide, and breaks existing entries.
- Make collisions a hard parse error: would block charts that render fine; a warning is enough.

## Evidence
- PR #12 (occurrence-number tag matching) and PR #11 (Expanded view).
- `sectionAbbreviationWarnings` in `songs.js`; tests in `test/songs.test.js`.

## Consequences
Existing charts do not change: explicit `(XYZ)` markers (Stranger's `(VI)`/`(VII)`) and `Structure:` entries keep
resolving as before, and `(V1)`-style lyric tags are untouched. Charts with unmarked colliding names keep rendering
but show the warning. If chips ever look wrong, check for that warning first.

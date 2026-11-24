# 0005: The Progressions toolbar has five view pills; everything else lives inside a panel or the structure nav

- **Status:** proposed
- **Date:** 2026-11-24
- **Supersedes:** (none)
- **Review by:** (optional)

## Decision
The Progressions toolbar shows exactly five show/hide pills: Chords, Lyrics, Notes, Notation, Piano. Instrument and Scales are one Piano panel with Chord/Scales tabs. The editor is an ✎ Edit button by the song picker. The structure nav is always shown, and Expanded is an `Exp` chip at its top (only when the song has a `Structure:` line).

## Why
The page had nine pills plus pickers and sliders, which wrapped to three rows on a phone. Content pills (what appears on the chart) are the ones used constantly; Instrument and Scales are two views of the same piano; the editor is an action, not a view; Structure and Expanded are about the structure nav and belong with it.

## Alternatives considered
- A, five pills plus a ⚙ View menu: hides Structure/Expanded/Notation behind a tap and adds a new menu pattern.
- C, one View popover for all toggles: cleanest page, but every toggle costs two taps.
- Keep nine pills: the problem in issue #17.

## Evidence
- PR #28 (https://github.com/apayne97/lyre-public/pull/28), `progressions.html`, `test/pages.test.js`
- Issue #17

## Consequences
- The Structure nav can no longer be hidden; if that is missed, add a hide control to the nav, not a pill.
- `test/pages.test.js` pins the exact five pills, so adding a sixth fails the test and should prompt a new ADR.
- Expanded is stored in localStorage `lyre-expand-structure`, unchanged.

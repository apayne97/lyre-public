# 0004: A song's scales are saved in a `Scales:` header line; the first one is the main scale for Roman numerals

- **Status:** proposed
- **Date:** 2026-11-24
- **Supersedes:** (none)

## Decision
A song may carry one header line `Scales: <root> <scale name>, <root> <scale name>, ...`, e.g.
`Scales: C dorian, G altered`.

- **Syntax.** Comma-separated entries; each is a root (`A`-`G` plus optional `#` or `b`, nothing else) then a
  scale name. The name is looked up by `findScaleKey` against the `SCALES` table in `theory.js`, ignoring case,
  spaces and punctuation, and matching either the key (`harmonicMinor`) or the label (`Harmonic Minor`). `ionian`
  and `aeolian` are accepted as aliases for `major` and `minor`.
- **Where it is read.** Like every other header field, only above the first blank line; the key `Scales:` is
  case-insensitive. A second `Scales:` line replaces the first (last one wins).
- **Meaning.** The list is the scales the song is "in", in the order written. The **first** entry is the song's
  *main scale*: every chord on the chart shows a Roman numeral computed from the semitone distance between that
  scale's root and the chord's root. Case shows the chord's own quality (upper = major or sus, lower = minor,
  lower + `°` = diminished, upper + `+` = augmented), not whether the chord is in the scale. Songs with no
  `Scales:` line (or no readable entry) show no numerals and an empty Scales pill.
- **Key interaction.** Scale roots are written in the same key as the chart's chords, i.e. the song's
  `Original Key`. `Original Key` is not derived from `Scales:` and `Scales:` is not checked against it. Transposing
  (the key picker, or the `Transposed Key:` header which only sets the picker's starting target) moves every scale
  root by the same number of semitones as the chords, so the scale tabs follow the chart. Roman numerals are
  relative, so they do not change under transposition.
- **Display.** A "Scales" pill on the progressions page shows one piano per saved scale, as tabs.
- **Bad entries.** An entry that does not parse (unknown scale, bad root) is skipped and adds a non-fatal warning
  to the song's warnings; the rest of the song still loads.
- **Deliberately not supported:** modulations or per-section scales (one global list only); a way to mark a
  non-first scale as main (order is the only signal); deriving the scales from the chords; double accidentals or
  lowercase roots; custom scale definitions in the song file; Roman numerals that show scale membership,
  inversions, or extensions.

## Why
The aim is for a song file to say what scales fit it (e.g. dorian over a minor chord, altered over a dominant), see
them on a piano, and read the chart in relative terms. Storing it as one header line keeps the file plain text
and hand-editable ([0001](0001-songs-files-are-plain-text.md)), reuses the existing header parser, and means
`Scales:` travels with the song through local files and Drive with no new storage. Making the first entry the
reference needs no extra syntax. Computing numerals purely from semitone distance works for any of the app's
scales, diatonic or not, so no per-scale chord-function table is needed.

## Alternatives considered
- Derive the scale from the chords automatically: ambiguous (the same chords fit several modes) and would remove
  Alex's choice; rejected.
- A separate `MainScale:` header, or marking the main scale with a prefix: more syntax for one flag; order is simpler.
- Roman numerals computed from `Original Key`: the key is a tonic only, with no mode; a modal song (C dorian)
  would get major-key numerals. Also would not let a song be "in" a scale different from its key spelling.
- Store scales outside the song file (browser storage, Drive sidecar): not portable with the file.
- Per-section scales: not needed yet; the single list can grow into it later.

## Evidence
- PR #24, commit `2b15607` ("Progressions: saved scales, Roman numerals, Scales piano pill"), including the
  follow-up that added the `ionian`/`aeolian` aliases.
- `songs.js`: `parseSongText` (the `Scales:` match, `scaleWarnings`) and `transposeSong` (`scales` mapped through
  `transposeRootName`). `theory.js`: `findScaleKey`, `romanNumeral`. `progressions.html`: `renderScalesPanel`,
  `mainScaleRoot`, the `showScales` pill.
- Tests: `test/songs.test.js` ("Scales: header parses ...", "Scales: unknown entries warn ...", "transposeSong
  moves the saved scale roots"); `test/theory.test.js` (`findScaleKey`, `romanNumeral`).

## Consequences
Anything that rewrites a song's header must preserve the `Scales:` line (MusicXML import, which emits only
Title/Artist/Beats, does not write one). A scale name added to `SCALES` is automatically accepted in the header;
renaming a key or label there silently breaks saved songs, so check the song files first. The UI pill, tabs and
numerals have no automated tests (only the parser, transposition and the two theory helpers do).

## Open questions
- Transposing re-spells scale roots via `transposeRootName` to the app's canonical spelling (or sharps when the
  target key has a `#`); I did not check whether a transpose by 0 leaves a typed spelling such as `Db` unchanged
  or turns it into `C#`.
- Whether `Scales:` should be validated against, or default from, `Original Key` was not decided; nothing checks
  that the first scale's root is related to the key.
- Whether the first-entry-is-main convention is what Alex wants long term, or an explicit marker is preferred.

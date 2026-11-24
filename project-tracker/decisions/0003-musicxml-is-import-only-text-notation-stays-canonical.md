# 0003: Notation stays in the text grammar; MusicXML is an import path only

- **Status:** proposed
- **Date:** 2026-11-23
- **Supersedes:** (none)
- **Review by:** (optional)

## Decision
Notation blocks keep their `-`-line text grammar as the only stored form, inside the songs `.txt` file. MusicXML
(`.musicxml` / compressed `.mxl`) is supported only as a one-way import: the app reads a score and emits a
notation block as text, which the user pastes into a song and can hand-edit. No MusicXML is stored in songs files,
and no rendering or notation library is added.

## Why
The goal is to stop hand-typing long melodies by importing from MuseScore. Storing MusicXML would need a
multi-MB renderer (OpenSheetMusicDisplay or Verovio), replace the custom parser, renderer and transposer, make
notation un-editable by hand, and break the plain-text songs file (SDR 0001): `.mxl` is binary and plain XML is
roughly 50-100x larger than the text grammar for the same content. Import alone solves the goal with no new
runtime dependency: the browser has `DOMParser`, and `.mxl` is a DEFLATE zip whose entry point is
`META-INF/container.xml`.

## Alternatives considered
- Keep the text grammar and add nothing: leaves long melodies hand-typed.
- Store MusicXML and render with a library: most capable (tuplets, ties across bars, multiple staves), but a large
  dependency, an asset/binary story in Drive, a one-way lossy migration of existing blocks, and transpose,
  spelling and playback tied to the library.
- Also export to MusicXML: cheap to add later; deferred, not rejected.

## Evidence
- Notation grammar and parser: `songs.js` ("Melody / notation blocks"); transpose: `transposeNotationBlock`.
- Rendering and playback: `views.js` notation block functions.
- MusicXML compressed files: https://musicxml.formats.music/tutorial/compressed-mxl-files/
- MusicXML chord symbols (`<harmony>`): https://musicxml.formats.music/tutorial/chord-symbols-and-diagrams/

## Consequences
Anything the grammar cannot express (tuplets, ties across barlines, multiple staves, ornaments, lyrics under
notes) is lost on import, so the importer must warn clearly instead of dropping it silently. Richer notation
would need the grammar extended, or this decision revisited. The zero-dependency unzip (`DecompressionStream`
plus a small zip reader) is unverified and should be confirmed when the importer is built.

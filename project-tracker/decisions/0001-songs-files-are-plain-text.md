# 0001: Songs files are plain `.txt`; the app never offers `.md`

- **Status:** accepted
- **Date:** 2026-11-18
- **Supersedes:** (none)

## Decision
Songs data files (local and on Google Drive) are plain text. New Drive files are created as
`text/plain` (default name `lyre-songs.txt`), and the local file pickers and upload input accept `.txt` only.

## Why
The chart format reuses markdown-looking syntax (`>`, `---`, `-`, one field per line). When a Drive
songs file named `.md` was opened in Drive's markdown editor it was re-serialized (escaped `\|` `\-` `\[2x\]`,
header lines collapsed, `---` turned into rules), and the parser then failed. Cause is inferred, not proven.
Using a non-markdown type keeps Drive from treating the file as markdown.

## Alternatives considered
- Keep `.md` and only warn: leaves the footgun in place.
- Store in Drive `appDataFolder` so it cannot be hand-edited: hides the file from the user in Drive; not worth it.
- Keep `.md` accepted for old files: dropped; the only user is Alex.

## Evidence
- PR #6 (`fe214d2`): `drive.js` creates `text/plain` files; `looksMarkdownMangled()` in `songs.js` warns on escaped content.
- PR #7 (`0c8df5a`): pickers and upload accept `.txt` only.

## Consequences
Edit songs through Lyre, not Drive's viewer. If songs suddenly fail to parse and contain backslashes, check Drive
version history first. Unverified against real Drive: writes send `Content-Type: text/plain`, which may change an
existing file's type on first save; to convert an old `.md`, rename locally and upload into a new Drive file.

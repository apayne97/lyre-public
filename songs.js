// Chord progressions for the Progressions page, defined in a compact plain-
// text chart format (parsed below) rather than hand-built JS objects — so
// new songs can be typed/pasted, either into this file or into the "Add
// your own" textarea on the page itself, without touching any JS.
//
// Format:
//   Title: <name>
//   Artist: <name>
//   Beats: <beats per measure, default 4>
//   BPM: <default tempo for this song, optional>
//   BeatWidth: <default pixels-per-beat for this song, optional>
//   LyricSize: <default lyric caption font size in px, optional>
//   (blank line)
//   Verse:
//   Em7 | A7 | Em7 | A7
//   Em7 | A7 | Em7 | A7
//
//   Chorus:
//   Cmaj7 | D7 | Em7 | Em7
//
// A section can set its own structure-nav abbreviation with a standalone
// "(XYZ)" line right under its heading (before any chords) — e.g.
// "Interlude:\n(Int)" — overriding the default auto-abbreviation
// (initials of each word), needed wherever two names would otherwise
// collide (Intro/Interlude both auto-abbreviate to "I").
//
// Bars are separated by "|". Chords within a bar are separated by spaces
// and spaced evenly across the bar by count — 1 chord fills the whole bar,
// 2 chords land on beats 1 & 3 (in 4/4), 4 chords land on beats 1,2,3,4 —
// the standard lead-sheet convention, so you don't write beat numbers by
// hand. For anything uneven (e.g. beats 1, 3, 4), pin a chord to a beat
// explicitly with "@<beat>" — e.g. "Em7 A7@3 Bm7@4" puts Em7 at its default
// (beat 1), A7 at beat 3, Bm7 at beat 4; only the chords that need pinning
// need the "@", the rest still fall back to even spacing by count. For a
// chord landing between beats (funk/syncopated hits), add a 16th-note
// subdivision — "@<beat>.<16th>", the same 1-indexed "1 e & a" count the
// lyric pins use (1 = on the beat/same as omitting it, 2 = "e", 3 = "&",
// 4 = "a") — e.g. "C-7@3.4" lands on the "a" right before beat 4. A bar
// that's just "%" repeats the previous bar's chord(s) in that same line —
// e.g. "Em7 | A7 | % | %" is the same as "Em7 | A7 | Em7 | A7" — the
// classic lead-sheet repeat sign (iRealPro uses the same convention). A
// bar can also hold just the previous bar's LAST N chords instead of all
// of them, with "%<N>" — e.g. after "Bb-7 C-7@3 Dbmaj7@4", a "%1" bar
// holds just that Dbmaj7 for the whole next bar (refit onto beat 1,
// rather than kept at wherever it was pinned before); "%" alone (no
// number) still means "repeat everything, exact positions and all". A
// bare "-" also holds the previous bar's last chord (same as "%1"
// harmonically), but renders as an empty bar — no chord symbol shown,
// just the ordinary beat-number markers — for when nothing new is
// happening and repeating the symbol would just be visual noise. A
// whole ROW can repeat too, with "[<N>x]" trailing the line — e.g.
// "Em7 | A7 [6x]" plays that 2-bar row 6 times through before moving on,
// without retyping it or splitting it into 6 separate rows; shown as a
// "×6" label next to the row.
// Chord symbols: root (A-G, optional #/b) + quality + optional 7/9/11/13 +
// optional alterations. Supported quality tokens (checked
// longest-match first): maj7/M7/Δ (major7), ø/h (half-diminished7),
// dim/o/° (diminished, also works with a 7 for a full diminished 7th),
// mmaj/-Δ (minor-major7), m+/-+ (minor augmented — minor triad, sharp 5),
// m/- (minor), aug/+ (augmented), sus4, sus2 (suspended — no 3rd; triad
// only, no 7th/9th/etc size), nothing (major/dominant). Alterations:
// b5/#5, b9/#9, #11, b13 — e.g. "G7#9b13", "Dm7b5" (equivalent to "Dø7" —
// a b5 on a plain m7 IS a half-diminished chord, same math either way).
// "add" chords skip the 7th entirely — a plain triad plus one extra tone:
// add2, add4, add6/6 (the "6" chord, e.g. "C6" or "Cm6"), add9, add11,
// add13 — e.g. "Cadd2" is C-E-G-D, not a 9th chord missing its 7th.
//
// Sections & line breaks: a line by itself ending in ":" (e.g. "Verse:",
// "Chorus:") starts a new named section, shown with its own label to the
// left of the lead sheet. Within a section, every source line is its own
// row (a hard line break) — and a double bar "||" also forces a row break
// mid-line, if you'd rather type a whole section as one paragraph. Songs
// with no section headers at all just render as one unlabeled section.
//
// Lyrics: one or more lines starting with ">" attach to the chord row above
// them — one shared row of boxed measures, then every lyric line that goes
// with it (verse 1, verse 2, ... all sung over the same changes) stacked
// underneath as plain text:
//   Em7 | A7
//   > My friends feel it's their appointed duty
//   > They keep trying to tell me
// We don't try to align every syllable to its exact chord — a lyric line
// just flows left to right under the row. When a particular word DOES need
// to land under a specific beat, pin it with "@<measure>.<beat>" right
// after the word — measure = 1-based bar number within THIS row, beat =
// 1-based beat within that bar (both readable straight off the boxes,
// since each bar's empty beats are numbered) — e.g. in a 2-bar row,
// "yeah@2.1 but when" pins "yeah" to beat 1 of the 2nd bar; only the words
// worth pinning need it, the rest of the line flows normally before/after.
// For funk/syncopated phrasing that lands between beats, add a 3rd part
// for a 16th-note subdivision — "@<measure>.<beat>.<16th>", 1-indexed like
// the standard "1 e & a" count: 16th = 1 for right on the beat (same as
// omitting it), 2 = "e", 3 = "&", 4 = "a" — e.g. "hit@2.3.4" pins "hit" to
// the "a" right before beat 4 of the 2nd bar.
// "N.C." (No Chord, any casing/dots) on its own line is a one-bar rest —
// silent, no chord shown but still takes up time — for lyric lines that
// fall between changes.
// A lyric line can also be tagged to one specific occurrence of a
// repeated section — "> (V1) ..." only shows when that occurrence
// (Structure's 1st "Verse", say) is the one selected in the structure
// nav, instead of always shown alongside every other line the way an
// untagged one still is:
//   Em7 | A7
//   > (V1) first verse, these words
//   > (V2) second verse, different words
// The tag should match whatever label the structure nav actually shows
// for that occurrence (see SECTION_ABBR_RE above for overriding it).

function parseChordSymbol(text) {
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(text.trim());
  if (!m) return null;
  const root = m[1].toUpperCase() + (m[2] || "");
  let rest = m[3];

  let alt5 = "default";
  const altLevel = {};
  rest = rest.replace(/(b|#)5\b/, (_, s) => { alt5 = s === "b" ? "b" : "s"; return ""; });
  rest = rest.replace(/(b|#)13\b/, (_, s) => { altLevel[13] = s === "b" ? "b" : "s"; return ""; });
  rest = rest.replace(/(b|#)11\b/, (_, s) => { altLevel[11] = s === "b" ? "b" : "s"; return ""; });
  rest = rest.replace(/(b|#)9\b/, (_, s) => { altLevel[9] = s === "b" ? "b" : "s"; return ""; });

  const QUALITY_PREFIXES = [
    { re: /^(maj|M|Δ)/, quality: "major", seventhKey: "major7" },
    { re: /^(ø|h)/, quality: "diminished", seventhKey: "halfdim7" },
    { re: /^(dim|o|°)/, quality: "diminished", seventhKey: "dim7" },
    { re: /^(mmaj|-Δ)/i, quality: "minor", seventhKey: "minMaj7" },
    // "m+"/"-+" (minor triad, sharp 5) is conventionally called "minor
    // augmented" — checked before the plain "m|-" entry below, since that
    // would otherwise eat just the "m" and leave a dangling "+".
    { re: /^(m|-)\+/, quality: "minor", seventhKey: "minor7", forceAlt5: "s" },
    { re: /^(m|-)/, quality: "minor", seventhKey: "minor7" },
    { re: /^(aug|\+)/, quality: "augmented", seventhKey: "aug7" },
    { re: /^sus4/i, quality: "sus4", seventhKey: null },
    { re: /^sus2/i, quality: "sus2", seventhKey: null },
  ];
  let quality = "major", seventhKey = "dominant7";
  for (const p of QUALITY_PREFIXES) {
    const mm = p.re.exec(rest);
    if (mm) {
      quality = p.quality; seventhKey = p.seventhKey; rest = rest.slice(mm[0].length);
      if (p.forceAlt5) alt5 = p.forceAlt5;
      break;
    }
  }
  rest = rest.trim();

  // "add2"/"add9"/etc, or bare "6" (the standard way to write what's really
  // an "add6") — a plain triad plus one extra tone, no 7th at all.
  const addMatch = /^add(2|4|6|9|11|13)$/i.exec(rest);
  if (addMatch || rest === "6") {
    const addTone = addMatch ? Number(addMatch[1]) : 6;
    const chord = { quality, size: "triad", seventhKey, alt5, alt9: "omit", alt11: "omit", alt13: "omit", addTone };
    return { root, chord };
  }

  const bareNum = rest === "" ? 0 : Number(rest);
  if (rest !== "" && ![7, 9, 11, 13].includes(bareNum)) return null;

  const highestAlt = Math.max(0, ...Object.keys(altLevel).map(Number));
  const numSize = Math.max(bareNum, highestAlt);
  const size = numSize === 0 ? "triad" : numSize === 7 ? "7th" : numSize === 9 ? "9th" : numSize === 11 ? "11th" : "13th";

  const altFor = (level) => altLevel[level] || (level <= bareNum ? "nat" : "omit");
  const chord = { quality, size, seventhKey, alt5, alt9: altFor(9), alt11: altFor(11), alt13: altFor(13) };
  return { root, chord };
}

// One bar's worth of chord tokens (already split off the "|" delimiters) ->
// {events} with each event's beat resolved, or {error}.
// "@<beat>" pins a chord to a beat; an optional "@<beat>.<16th>" pins it to
// a 16th-note subdivision of that beat too — the same 1-indexed "1 e & a"
// count the lyric "@<measure>.<beat>.<16th>" pins use (1 = on the beat,
// same as omitting it; 2 = "e"; 3 = "&"; 4 = "a"). No "<measure>" part
// here since a chord token is already scoped to one specific bar.
function parseBarTokens(bar, beatsPerMeasure) {
  const tokens = bar.split(/\s+/).filter(Boolean);
  const events = [];
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let explicitBeat = null;
    let sixteenth = 1;
    const beatMatch = /^(.*)@(\d+)(?:\.(\d+))?$/.exec(token);
    if (beatMatch) {
      token = beatMatch[1];
      explicitBeat = Number(beatMatch[2]);
      if (beatMatch[3] !== undefined) sixteenth = Number(beatMatch[3]);
      if (explicitBeat < 1 || explicitBeat > beatsPerMeasure) {
        return { error: `Beat ${explicitBeat} is out of range in "${tokens[i]}" (this song has ${beatsPerMeasure} beats per bar).` };
      }
    }
    const parsed = parseChordSymbol(token);
    if (!parsed) return { error: `Couldn't parse chord "${token}" in bar "${bar}".` };
    const beat = explicitBeat !== null ? explicitBeat : 1 + Math.round((i * beatsPerMeasure) / tokens.length);
    events.push({ root: parsed.root, chord: parsed.chord, beat, sixteenth });
  }
  return { events };
}

const NC_RE = /^N\.?C\.?$/i;

// A single chord/rest bar -> its events array (a rest bar is one event
// flagged `rest: true`, still occupying a full bar of time).
function parseBar(bar, beatsPerMeasure) {
  if (NC_RE.test(bar)) return { events: [{ rest: true, beat: 1, sixteenth: 1 }] };
  return parseBarTokens(bar, beatsPerMeasure);
}

// A trailing "[<N>x]" on a chord/N.C. line — e.g. "Em7 | A7 [6x]" — means
// that row repeats N times before the song moves on, without needing to
// retype it N times or split it into N separate lyric-less rows. Shown as
// a "×N" label next to the row, and multiplies that row's bars N times
// over in the actual playback timeline (see playProgression).
const REPEAT_SUFFIX_RE = /\s*\[(\d+)x\]\s*$/i;

// An inline "(V1)"/"(V2)" right after a ">" — e.g. "> (V1) first verse" —
// ties that one lyric line to one specific occurrence of a repeated
// section (see updateSectionSelection/applyLyricVariant in
// progressions.html): it's only shown when that occurrence's chip is the
// one selected, instead of always shown the way an untagged line still
// is. The tag should match whatever label the structure nav actually
// ends up showing for that occurrence (its own "(XYZ)" abbreviation if
// it set one, or the auto-generated one otherwise).
const LYRIC_VARIANT_RE = /^\(([A-Za-z0-9]+)\)\s*/;

// A section's chart lines -> rows, each `{ measures, lyrics, repeatCount }`
// — lyrics is `{ text, variant }[]`, variant null unless tagged (see
// LYRIC_VARIANT_RE above). Bar lines (containing "|", or a bare "N.C.")
// start a new row; a "||" mid-line also forces a row break. A
// ">"-prefixed line attaches as one more lyric line on the most recently
// started row (several such lines can share one row).
function parseSectionLines(lines, beatsPerMeasure) {
  const rows = [];
  for (const line of lines) {
    if (line.startsWith(">")) {
      if (rows.length === 0) continue; // a lyric line with no chord row above it — ignore
      let text = line.slice(1).trim();
      const variantMatch = LYRIC_VARIANT_RE.exec(text);
      const variant = variantMatch ? variantMatch[1] : null;
      if (variantMatch) text = text.slice(variantMatch[0].length);
      rows[rows.length - 1].lyrics.push({ text, variant });
      continue;
    }

    let workingLine = line;
    let repeatCount = 1;
    const repeatMatch = REPEAT_SUFFIX_RE.exec(workingLine);
    if (repeatMatch) {
      repeatCount = Number(repeatMatch[1]);
      workingLine = workingLine.slice(0, repeatMatch.index).trim();
    }

    if (NC_RE.test(workingLine)) {
      const measure = [{ rest: true, beat: 1, sixteenth: 1 }];
      measure.beatsPerMeasure = beatsPerMeasure;
      rows.push({ measures: [measure], lyrics: [], repeatCount });
      continue;
    }
    for (const segment of workingLine.split("||").map(s => s.trim()).filter(Boolean)) {
      const measures = [];
      let lastEvents = null;
      for (const rawBar of segment.split("|").map(b => b.trim()).filter(Boolean)) {
        // A leading "(<N>)" on a bar — e.g. "(3) Ab" — overrides the song's
        // normal beat count for just this one bar (a stray 3/4 measure
        // dropped into an otherwise 4/4 tune, etc). Falls back to the
        // song-wide count when not given.
        const beatCountMatch = /^\((\d+)\)\s*/.exec(rawBar);
        const barBeats = beatCountMatch ? Number(beatCountMatch[1]) : beatsPerMeasure;
        const bar = beatCountMatch ? rawBar.slice(beatCountMatch[0].length).trim() : rawBar;

        let events;
        const repeatTailMatch = /^%(\d+)?$/.exec(bar);
        if (bar === "-") {
          // A bare "-" holds the previous bar's LAST chord through this
          // whole bar too, same as "%1" — but shown as nothing but the
          // ordinary beat-number markers, no chord symbol repeated, since
          // nothing new is actually happening here.
          if (!lastEvents || lastEvents.length === 0) return { error: `"-" has no previous bar to hold in "${segment}".` };
          const last = lastEvents[lastEvents.length - 1];
          events = [{ ...last, beat: 1, sixteenth: 1, hold: true }];
        } else if (repeatTailMatch) {
          if (!lastEvents) return { error: `"${bar}" has no previous bar to repeat in "${segment}".` };
          if (repeatTailMatch[1] === undefined) {
            // Plain "%" — exact copy of the whole previous bar, same
            // beats/16ths it already had.
            events = lastEvents.map(ev => ({ ...ev }));
          } else {
            // "%<N>" — just the LAST N chords of the previous bar (e.g.
            // "%1" holds only its final chord), refit evenly across this
            // new bar the same way a fresh unpinned bar would be.
            const n = Number(repeatTailMatch[1]);
            if (n < 1 || n > lastEvents.length) {
              return { error: `"${bar}" asks for the last ${n} chord(s), but the previous bar only has ${lastEvents.length}.` };
            }
            const tail = lastEvents.slice(-n);
            events = tail.map((ev, i) => ({ ...ev, beat: 1 + Math.round((i * barBeats) / n), sixteenth: 1 }));
          }
        } else {
          const result = parseBar(bar, barBeats);
          if (result.error) return { error: result.error };
          events = result.events;
        }
        events.beatsPerMeasure = barBeats;
        measures.push(events);
        lastEvents = events;
      }
      if (measures.length > 0) rows.push({ measures, lyrics: [], repeatCount });
    }
  }
  if (rows.length === 0) return { error: "No chords found." };
  return { rows };
}

// A standalone "(XYZ)" line right after a section heading — its own line,
// nothing else on it — sets that section's structure-nav abbreviation
// explicitly (see renderStructureNav in progressions.html), instead of
// the auto-abbreviation (initials of each word). Needed wherever two
// section names would otherwise collide, e.g. "Intro" and "Interlude"
// both auto-abbreviate to "I" — write "(Int)" under Interlude to tell
// them apart. Must start with a letter (not a digit) so it can't be
// confused with a bar's own leading "(<N>)" beat-count override (that
// always has chord content after it on the same line; this never does).
const SECTION_ABBR_RE = /^\(([A-Za-z][A-Za-z0-9]*)\)$/;

// Full chart body (everything after the Title/Artist/Beats header) -> named
// sections, each with its own rows. A line ending in ":" (and containing no
// "|") starts a new section; every other non-blank line is a chart line.
function parseSongSections(text, beatsPerMeasure) {
  const lines = text.split("\n");
  const rawSections = [];
  let current = { name: "", abbr: null, lines: [] };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const headingMatch = !trimmed.includes("|") && !trimmed.startsWith(">") && /^(.+):$/.exec(trimmed);
    if (headingMatch) {
      if (current.lines.length > 0 || current.name) rawSections.push(current);
      current = { name: headingMatch[1].trim(), abbr: null, lines: [] };
    } else if (current.lines.length === 0 && current.abbr === null && SECTION_ABBR_RE.test(trimmed)) {
      current.abbr = SECTION_ABBR_RE.exec(trimmed)[1];
    } else {
      current.lines.push(trimmed);
    }
  }
  if (current.lines.length > 0 || current.name) rawSections.push(current);
  if (rawSections.length === 0) return { error: "No chords found." };

  const sections = [];
  for (const s of rawSections) {
    if (s.lines.length === 0) continue; // a heading with no chart lines under it
    const result = parseSectionLines(s.lines, beatsPerMeasure);
    if (result.error) return { error: result.error };
    sections.push({ name: s.name, abbr: s.abbr, rows: result.rows });
  }
  if (sections.length === 0) return { error: "No chords found." };
  return { sections };
}

// Full song text, with an optional Title/Artist/Beats header (blank line,
// then the chart). No header at all is fine too — the whole input is then
// just treated as the chart, titled "Untitled".
function parseSongText(text) {
  const trimmed = text.trim();
  const blankIdx = trimmed.search(/\n\s*\n/);
  const headerText = blankIdx === -1 ? "" : trimmed.slice(0, blankIdx);
  const chartText = blankIdx === -1 ? trimmed : trimmed.slice(blankIdx).trim();

  let title = "Untitled", artist = "", beatsPerMeasure = 4, bpm = null, beatWidth = null, structure = null;
  let originalKey = null, transposedKey = null, lyricSize = null;
  for (const line of headerText.split("\n")) {
    const mTitle = /^Title:\s*(.+)$/i.exec(line.trim());
    const mArtist = /^Artist:\s*(.+)$/i.exec(line.trim());
    const mBeats = /^Beats:\s*(\d+)$/i.exec(line.trim());
    const mBpm = /^BPM:\s*(\d+)$/i.exec(line.trim());
    const mBeatWidth = /^BeatWidth:\s*(\d+)$/i.exec(line.trim());
    const mStructure = /^Structure:\s*(.+)$/i.exec(line.trim());
    // "Original Key" defaults to the root of the song's first chord when
    // omitted (computed below, once `measures` exists) — "Transposed Key"
    // has no such default; when omitted the song just opens untransposed.
    const mOriginalKey = /^Original Key:\s*(.+)$/i.exec(line.trim());
    const mTransposedKey = /^Transposed Key:\s*(.+)$/i.exec(line.trim());
    // Same style as BeatWidth (a compact numeric setting) rather than
    // Original/Transposed Key's two-word music-label style — see
    // progressions.html's lyric-size slider for how this overrides the
    // visitor's own persisted preference while this song is open.
    const mLyricSize = /^LyricSize:\s*(\d+)$/i.exec(line.trim());
    if (mTitle) title = mTitle[1].trim();
    else if (mArtist) artist = mArtist[1].trim();
    else if (mBeats) beatsPerMeasure = Number(mBeats[1]);
    else if (mBpm) bpm = Number(mBpm[1]);
    else if (mBeatWidth) beatWidth = Number(mBeatWidth[1]);
    else if (mStructure) structure = mStructure[1].split(",").map(s => s.trim()).filter(Boolean);
    else if (mOriginalKey) originalKey = mOriginalKey[1].trim();
    else if (mTransposedKey) transposedKey = mTransposedKey[1].trim();
    else if (mLyricSize) lyricSize = Number(mLyricSize[1]);
  }

  const result = parseSongSections(chartText, beatsPerMeasure);
  if (result.error) return result;

  // "Structure:" is a roadmap for PLAYBACK order only — e.g. a chart with
  // one "Verse" section and one "Chorus" section can still be played
  // Verse/Chorus/Verse/Verse/Chorus via "Structure: Verse, Chorus, Verse,
  // Verse, Chorus" without retyping any of them. The leadsheet itself
  // still renders each section once, as written (see renderLeadsheet /
  // playProgression). Comma-separated because section names can contain
  // spaces ("Verse 1", "Guitar Solo").
  if (structure) {
    const knownNames = new Set(result.sections.map(s => (s.name || "").trim().toLowerCase()));
    for (const name of structure) {
      if (!knownNames.has(name.toLowerCase())) {
        return { error: `Structure references unknown section "${name}".` };
      }
    }
  }

  // Flatten in render order (section -> row -> bar) so DOM order from
  // renderLeadsheet lines up 1:1 with playback's beat-timed event order.
  const measures = [];
  result.sections.forEach(sec => sec.rows.forEach(row => row.measures.forEach(bar => measures.push(bar))));

  if (!originalKey) {
    const first = measures.flat().find(ev => !ev.rest);
    if (first) originalKey = first.root;
  }

  return { title, artist, beatsPerMeasure, bpm, beatWidth, structure, originalKey, transposedKey, lyricSize, sections: result.sections, measures };
}

// A canonical single spelling per pitch class — flat-leaning by default
// (the predominant real-book/jazz convention: Bb7, Eb-7, etc. far
// outnumber their sharp equivalents in practice), or sharp-leaning when
// `preferSharp` is set. Transposing "to a key" (see transposeSong) passes
// this based on how the user actually spelled the target key they picked
// (F# vs Gb) — there's no attempt to "preserve" the original's own
// sharp/flat character beyond that, since a whole song should read in one
// consistent spelling once you've named the key you're going to.
const TRANSPOSE_SPELLING = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const TRANSPOSE_SPELLING_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function transposeRootName(rootName, semitones, preferSharp) {
  const info = noteInfoFromName(rootName);
  const origPC = pitchClassOf(info.letter, info.acc);
  const newPC = ((origPC + semitones) % 12 + 12) % 12;
  return (preferSharp ? TRANSPOSE_SPELLING_SHARP : TRANSPOSE_SPELLING)[newPC];
}

// A shifted COPY of a parsed song — every chord event's root moved
// `semitones` up/down and re-spelled; quality/size/alterations are left
// completely alone, since they're already computed dynamically from
// whatever root gets passed to buildChord() at render/playback time, not
// stored as their own absolute pitches. A pure view-time transform — the
// original song object (and anything saved to songs-data.md) is never
// touched by this.
function transposeSong(song, semitones, preferSharp) {
  if (!semitones) return song;
  const transposeEvent = ev => ev.rest ? ev : { ...ev, root: transposeRootName(ev.root, semitones, preferSharp) };
  const transposeMeasure = measure => {
    const newMeasure = measure.map(transposeEvent);
    newMeasure.beatsPerMeasure = measure.beatsPerMeasure;
    return newMeasure;
  };
  return {
    ...song,
    sections: song.sections.map(sec => ({
      ...sec,
      rows: sec.rows.map(row => ({ ...row, measures: row.measures.map(transposeMeasure) })),
    })),
    measures: song.measures.map(transposeMeasure),
  };
}

// The semitone distance from one named key to another, always in [0, 11]
// (transposing chord SYMBOLS is octave-agnostic — "up 3" and "down 9"
// produce identical output — so there's no separate "direction").
function semitonesBetween(fromKey, toKey) {
  const from = noteInfoFromName(fromKey), to = noteInfoFromName(toKey);
  const fromPC = pitchClassOf(from.letter, from.acc), toPC = pitchClassOf(to.letter, to.acc);
  return ((toPC - fromPC) % 12 + 12) % 12;
}

// Generic named chord progressions — practice patterns/forms, not songs.
// Deliberately NOT actual compositions (no melody, no lyrics, no specific
// arrangement) — a "12-bar blues" or "ii-V-I" is a musical FORM, the same
// way a sonnet's rhyme scheme isn't itself a copyrightable work, so these
// are safe to ship in a public repo unlike anything with real lyrics (see
// [[project_lyre_app]]/the copyright constraint on SONG_TEXTS below this).
// One idiomatic key each, matching how each is usually taught.
const SEED_PROGRESSIONS = {
  funkVamp: `Title: Funk Vamp
Artist: i7 - IV7 (Dorian)
Beats: 4
BPM: 100

Groove:
E-7 | E-7 | A7 | A7 [4x]`,

  minorBlues: `Title: 12-Bar Minor Blues
Artist: Minor Blues Form
Beats: 4
BPM: 90

Chorus:
C-7 | C-7 | C-7 | C-7 | F-7 | F-7 | C-7 | C-7 | Ab7 | G7 | C-7 | G7 [2x]`,

  majorBlues: `Title: 12-Bar Major Blues
Artist: Major Blues Form
Beats: 4
BPM: 100

Chorus:
Bb7 | Eb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7 [2x]`,

  iiVI: `Title: Jazz ii-V-I
Artist: Turnaround
Beats: 4
BPM: 120

Progression:
D-7 | G7 | Cmaj7 | Cmaj7 [4x]`,

  iviIIV: `Title: Jazz I-vi-ii-V
Artist: Turnaround
Beats: 4
BPM: 120

Progression:
Cmaj7 | A-7 | D-7 | G7 [4x]`,

  gospel: `Title: Gospel Progression
Artist: bVII - IV - I
Beats: 4
BPM: 80

Progression:
Bb | Bb | F | F | C | C [4x]`,

  rhythmChanges: `Title: Rhythm Changes (A Section)
Artist: I-VI-ii-V Variant
Beats: 4
BPM: 140

A Section:
Bb6 | G7 | C-7 | F7 | Bb6 | G7 | C-7 | F7 [2x]`,

  popRock: `Title: Pop/Rock Progression
Artist: I - V - vi - IV
Beats: 4
BPM: 100

Progression:
C | G | A- | F [4x]`,
};

const SONG_TEXTS = {
  // First in the dropdown (and so the default song on load) since it's
  // the one built-in that explains the app rather than just being a
  // progression to play — see the structure nav feature in
  // progressions.html for what the Structure Demo section below shows.
  //
  // Entirely original text (title, artist, and every lyric line) walking
  // through nearly every chart-format feature — the built-in reference
  // for "what can this format actually do," and a safe example to ship
  // publicly since none of it is a real song.
  tutorial: `Title: Feature Tutorial
Artist: Lyre Demo
Beats: 4
BPM: 90
BeatWidth: 70
Original Key: C
Structure: Basics, Rhythm Tricks, New Chords, Odd Meter, Lyrics Demo, Head, Solo, Head, Solo, Outro

Basics:
Cmaj7 | Dm7 G7 | Em7 A7@3 | Dm7@1 G7@3.3

Rhythm Tricks:
Fmaj7 | % | Dm7 G7 | %1 [2x]
Cmaj7 | - | N.C. | Cmaj7 || Dm7 G7 | N.C.

New Chords:
Csus4 | Csus2 | Cadd9 | C6
Cm6 | Cm+ | G7#9 | G7b13
Ddim7 | Gø7 | C-Δ7 | Caug

Odd Meter:
Cmaj7 | (3) Am7 | Dm7 G7

Lyrics Demo:
Cmaj7 | Am7 | Dm7 | G7
> a lyric line@1.1 with a pin@2.1 on beat one@3.1 of each bar@4.1
> a second verse@1.1 sharing the@2.1 same four bars@3.1 of chords@4.1

Cmaj7 | Am7
> and then@1.1 words can land off@2.3.3 the beat too

Head:
Cmaj7 | Fmaj7

Solo:
Dm7 | G7

Outro:
Cmaj7 [2x]`,
  ...SEED_PROGRESSIONS,
};

const SONGS = {};
for (const key in SONG_TEXTS) {
  const parsed = parseSongText(SONG_TEXTS[key]);
  if (parsed.error) console.error(`songs.js: failed to parse "${key}": ${parsed.error}`);
  else SONGS[key] = parsed;
}

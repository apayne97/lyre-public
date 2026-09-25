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

// ---------- Melody / notation blocks ----------
// A section is a NOTATION BLOCK, not a chord section, when EVERY one of its
// lines starts with "-" — one "-" line per independent voice (no name
// needed), each with its own note-token stream. Any number of notation
// blocks can appear in a chart; they render together as a row of small
// self-contained staff figures above the whole leadsheet, NOT aligned to
// specific chord-chart measures — the @<pos> numbers inside a block are
// local coordinates for laying out that one figure only, e.g.:
//   Melody:
//   - [E4,G4]@1.1 [E,G] [F,A] [G,B] | [G,B] [F,A] [E,G] [D,F]
//   - C3@1.1 B2 A G | F
//   Montuno:
//   - [G4,G5]@1.1 [C5,Eb5]@1.3 [Ab4,Ab5]@1.4
// ("Melody"/"Montuno" are just section names like Verse/Chorus — nothing
// about the name itself matters, only the "-"-prefixed lines do.) A
// standalone "Key: <name>" line right after the heading (before any "-"
// voice line — same slot as a chord section's "(XYZ)" abbreviation, see
// SECTION_ABBR_RE) draws a traditional key signature after the clef
// instead of spelling every accidental out on each note — see
// parseKeySignature below for the accepted forms ("Eb", "F#", "Cm", "C
// minor", "C aeolian" all work).
//
// "|" splits a voice line into bars, exactly like a chord row — every bar
// is independent (nothing sustains across a "|", see parseMelodyVoiceLine)
// and its own position pins don't carry a measure number, just
// "@<beat>[.<16th>]", so a bar's text is copy-pasteable as-is to repeat it
// later in the same voice without renumbering anything.
//
// Voice-line grammar: space-separated tokens, each one of:
//   R                    a rest
//   C4, F#3, Bb2         a single pitch (letter + optional #/b + octave)
//   [E4,G4]              2+ comma-separated pitches sounding together
//   [C], [G7], [Dm7]     exactly ONE item, no comma -> a CHORD SYMBOL (same
//                        grammar parseChordSymbol uses for the chord chart
//                        above), auto-voiced via buildChord() rather than
//                        spelled out note by note
// Any token can carry an explicit position: "@<beat>" (1 part) = a quarter
// note, "@<beat>.<16th>" (2 parts) = a 16th note — more precision, a
// shorter note, same "1 e & a" 16th-count the chord/lyric pins use.
// Omitting "@..." entirely infers the NEXT position at whatever resolution
// the previous token used, so a run of same-length notes doesn't need a
// pin on every one — and a bare note with no octave digit inherits the
// previous note's octave the same way. A bracket does both per-slot,
// matched by position within the bracket, and only when the bracket is the
// same size as the one before it — a size change needs explicit octaves on
// every note.
// Two (or more) tokens joined with NO space via "-" form an explicit-
// duration chain: "A@p1-B@p2" means A's duration is bounded by B's own
// position instead of falling back to the default resolution-based
// duration. Same pitch(es) on both ends merges into one held note spanning
// that whole range; different pitch means A ends and B begins right there.
// This is also how you write an 8th note or a dotted duration, neither of
// which the default two-tier (quarter/16th) rule can express on its own —
// only gaps landing on one standard notated duration (16th/8th/dotted-8th/
// quarter/dotted-quarter/half/dotted-half/whole-measure) are supported;
// anything else is a chart error. A dash-chain, like a legato group, can't
// cross a "|" either.
//
// A voice can also be split across TWO "-" lines instead of one — a bare
// rhythm line (position pins only, no pitches) immediately followed by a
// bare pitch line (a flat pitch/chord/rest list, no positions) — see
// isRhythmOnlyLine below for why and exactly how they zip together.
const STD_DURATIONS_16THS = [1, 2, 3, 4, 6, 8, 12]; // 16th,8th,dotted-8th,quarter,dotted-quarter,half,dotted-half — whole-measure is beatsPerMeasure*4, checked separately since it depends on the time signature

// [beat] / [beat,sixteenth] -> position in 16th-note units from the start
// of the CURRENT BAR (the caller adds the bar's own absolute offset), plus
// the resolution (in the same units) that position-part-count implies —
// same two-tier convention chord-bar pins use ("@<beat>" = quarter note,
// "@<beat>.<16th>" = 16th note), deliberately, so this is the same pin
// grammar everywhere a bar exists rather than its own bespoke one.
function posToUnits(parts, beatsPerMeasure) {
  const [beat, sixteenth] = parts;
  if (parts.length === 1) return { pos: (beat - 1) * 4, resUnits: 4 };
  return { pos: (beat - 1) * 4 + (sixteenth - 1), resUnits: 1 };
}

// A single melody pitch, OR a bare letter with no octave (inheritance —
// see parseMelodyVoiceLine) -> {letter, acc, octave}, octave null when
// omitted. undefined (not null) means "didn't parse as a pitch at all".
function parseMelodyPitchOrBare(item) {
  const full = parseMelodyPitch(item); // theory.js — requires the octave digit
  if (full) return full;
  const m = /^([A-Ga-g])([#b]?)$/.exec(item);
  if (!m) return undefined;
  return { letter: m[1].toUpperCase(), acc: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0, octave: null };
}

// One "-" (dash-)chain LINK — everything between dashes in one
// whitespace-separated chunk — -> its own kind + optional position, before
// any inference/duration-chaining has been resolved (see
// parseMelodyVoiceLine, which does that across the whole line).
function parseMelodyChainLink(str) {
  const posMatch = /@(\d+)(?:\.(\d+))?$/.exec(str);
  const body = posMatch ? str.slice(0, posMatch.index) : str;
  const posParts = !posMatch ? null : [Number(posMatch[1]), posMatch[2]]
    .filter(x => x !== undefined).map(Number);

  if (/^r$/i.test(body)) return { kind: "rest", posParts };

  const bracketMatch = /^\[(.+)\]$/.exec(body);
  if (bracketMatch) {
    const items = bracketMatch[1].split(",").map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return { error: `Empty note group "${str}".` };
    if (items.length === 1) {
      const parsedChord = parseChordSymbol(items[0]);
      if (!parsedChord) return { error: `Couldn't parse "${items[0]}" as a chord symbol in "${str}".` };
      return { kind: "chordSymbol", root: parsedChord.root, chord: parsedChord.chord, posParts };
    }
    const pitches = items.map(parseMelodyPitchOrBare);
    if (pitches.some(p => p === undefined)) return { error: `Couldn't parse a pitch in "${str}".` };
    return { kind: "note", pitches, posParts };
  }

  const p = parseMelodyPitchOrBare(body);
  if (p === undefined) return { error: `Couldn't parse melody token "${str}".` };
  return { kind: "note", pitches: [p], posParts };
}

function sameEntryPitches(a, b) {
  if (a.rest || b.rest || a.chordSymbol || b.chordSymbol) return false;
  if (!a.pitches || !b.pitches || a.pitches.length !== b.pitches.length) return false;
  return a.pitches.every((p, i) => p.letter === b.pitches[i].letter && p.acc === b.pitches[i].acc && p.octave === b.pitches[i].octave);
}

// One "-"-prefixed voice line's raw text (leading "-" already stripped) ->
// its flat sequence of sounding events — `{pos, dur, pitches}` (literal
// pitches), `{pos, dur, chordSymbol: {root, chord}}` (auto-voiced chord),
// or `{pos, dur}` (a rest) — or {error}. `pos`/`dur` are both in 16th-note
// units, local to this one voice's own timeline.
//
// "|" splits the line into bars, same as a chord row — each bar's own
// position pins are bar-relative ("@<beat>"/"@<beat>.<16th>", no leading
// measure number, identical grammar to a chord bar's own pins) rather than
// counting up from the start of the whole voice. This is deliberate: a
// bar's text becomes copy-pasteable as-is to repeat it later in the same
// voice (or splice into another voice/song) without renumbering anything,
// which an absolute "@<measure>.<beat>.<16th>" scheme couldn't offer. The
// tradeoff is that nothing (dash-chain OR legato group) can sustain a note
// across a "|" — each bar is independent by construction; every "(...)"
// legato group must open and close within one bar.
function parseMelodyVoiceLine(line, beatsPerMeasure) {
  const bars = line.trim().split("|").map(s => s.trim()).filter(Boolean);
  if (bars.length === 0) return { error: "Notation voice has no notes." };

  let lastOctave = null, lastBracketOctaves = null; // persist across bars — no reason a bar boundary should force respelling an octave
  const flat = [];

  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const barText = bars[barIdx];
    const barBase = barIdx * beatsPerMeasure * 4;
    const chunks = barText.split(/\s+/).filter(Boolean);
    let pos = 0, resUnits = 4; // assumed quarter-note resolution until the first explicit pin overrides it — resets every bar
    let inLegato = false; // see the "(...)" note below — never carries across a "|"

    // A "(" / ")" wrapping several space-separated notes — e.g.
    // "(E4@1.1 F4@1.2 G4@1.3)" — marks that whole run legato: instead of a
    // rest filling any gap between one note's default duration and the
    // next note's start (the ordinary behavior — see the gap-filling pass
    // below), each note's duration stretches to meet the next one, same
    // outcome as dash-chaining every single pair but without needing a
    // dash at each step. Only the note AT the closing ")" falls back to
    // normal (capped/gap-filled) behavior for what comes after it — the
    // group's own end doesn't reach past it.
    for (const rawChunk of chunks) {
      let chunk = rawChunk;
      let legatoStart = false, legatoEnd = false;
      if (chunk.startsWith("(")) { chunk = chunk.slice(1); legatoStart = true; }
      if (chunk.endsWith(")")) { chunk = chunk.slice(0, -1); legatoEnd = true; }
      if (chunk === "") return { error: `"${rawChunk}" has nothing in it.` };
      // `legato` on an entry means "reaches forward to meet the NEXT entry" —
      // true for every chunk in an active group except the one that closes it
      // (including a lone "(A)" group, start and end on the same chunk), so
      // the group's own end still falls back to normal capped/gap-filled
      // behavior for whatever follows, in vs out of the group alike.
      const chunkLegato = (inLegato || legatoStart) && !legatoEnd;
      if (legatoStart) inLegato = true;

      const parts = chunk.split("-").filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const parsed = parseMelodyChainLink(parts[i]);
        if (parsed.error) return { error: parsed.error };

        let linkPos, linkRes;
        if (parsed.posParts) {
          if (parsed.posParts[0] < 1 || parsed.posParts[0] > beatsPerMeasure) {
            return { error: `Beat ${parsed.posParts[0]} is out of range in "${chunk}" (this song has ${beatsPerMeasure} beats per bar).` };
          }
          const r = posToUnits(parsed.posParts, beatsPerMeasure);
          linkPos = r.pos; linkRes = r.resUnits;
        } else {
          linkPos = pos; linkRes = resUnits;
        }
        if (linkPos >= beatsPerMeasure * 4) {
          return { error: `"${chunk}" lands beyond the end of bar ${barIdx + 1} (this song has ${beatsPerMeasure} beats per bar).` };
        }
        pos = linkPos + linkRes;
        resUnits = linkRes;

        const entry = { pos: barBase + linkPos, resUnits: linkRes, chainEnd: i === parts.length - 1, legato: chunkLegato };
        if (parsed.kind === "rest") {
          entry.rest = true;
        } else if (parsed.kind === "chordSymbol") {
          entry.chordSymbol = parsed;
          lastOctave = null; lastBracketOctaves = null; // a chord symbol has no octave lineage to hand down
        } else {
          const sameShape = lastBracketOctaves && lastBracketOctaves.length === parsed.pitches.length;
          const resolved = parsed.pitches.map((p, idx) => {
            if (p.octave !== null) return p;
            const inherited = parsed.pitches.length === 1 ? lastOctave : (sameShape ? lastBracketOctaves[idx] : null);
            return inherited === null ? null : { ...p, octave: inherited };
          });
          if (resolved.some(p => p === null)) {
            return { error: `"${chunk}" omits an octave with no matching previous note/group to inherit it from.` };
          }
          entry.pitches = resolved;
          if (resolved.length === 1) lastOctave = resolved[0].octave;
          else lastBracketOctaves = resolved.map(p => p.octave);
        }
        flat.push(entry);
      }
      if (legatoEnd) inLegato = false;
    }
    if (inLegato) return { error: `Bar ${barIdx + 1} has an unclosed "(" — every legato group must open and close within the same bar.` };
  }

  // Turn the flat link list into actual sounding events. Consecutive links
  // within the same dash-chain that are the literal same pitch(es) merge
  // into ONE held note (not re-attacked) — its duration reaches all the way
  // to wherever a genuinely different pitch (or the chain's own end)
  // follows, not just to the next same-pitch marker's own position, since
  // that marker contributes no audible attack of its own. A link that isn't
  // part of any merge, and is still explicitly chained onward, is bounded
  // by the very next link's position; otherwise it falls back to its own
  // resolution-derived default duration.
  const events = [];
  for (let i = 0; i < flat.length; ) {
    const e = flat[i];
    let j = i;
    while (!flat[j].chainEnd && j + 1 < flat.length && sameEntryPitches(flat[j], flat[j + 1])) j++;
    const chained = !flat[j].chainEnd && j + 1 < flat.length;
    const dur = chained ? (flat[j + 1].pos - e.pos) : (j > i ? (flat[j].pos - e.pos) : e.resUnits);
    if ((chained || j > i) && dur !== beatsPerMeasure * 4 && !STD_DURATIONS_16THS.includes(dur)) {
      return { error: `A held note at beat ${1 + Math.floor((e.pos % (beatsPerMeasure * 4)) / 4)} doesn't land on a standard note value.` };
    }
    // The merged event's OWN forward-reach comes from its last link
    // (flat[j], adjacent to whatever follows), not its first (e) — matters
    // when a dash-chain happens to end on the chunk that closes a "(...)"
    // legato group.
    const legato = flat[j].legato;
    if (e.rest) events.push({ pos: e.pos, dur, legato });
    else if (e.chordSymbol) events.push({ pos: e.pos, dur, chordSymbol: { root: e.chordSymbol.root, chord: e.chordSymbol.chord }, legato });
    else events.push({ pos: e.pos, dur, pitches: e.pitches, legato });
    i = j + 1;
  }
  if (events.length === 0) return { error: "Notation voice has no notes." };

  return fillGapsAndCompleteMeasure(events, beatsPerMeasure);
}

// Shared by both melody and percussion voice lines. A dash-chained event's
// duration already reaches exactly to wherever the next thing starts, by
// construction. Two other cases: a legato event (see the "(...)" note in
// parseMelodyVoiceLine above — its OWN flag already means "reaches forward
// to meet the next event"; never true for percussion, which has no legato
// syntax, and false on whichever chunk closes a "(...)" group, so the
// group's end doesn't drag whatever follows it into the stretch too)
// behaves the same way, stretching to meet the next event, no rest needed.
// Anything else (the ordinary case: bare or explicitly-
// pinned, just space-separated, not inside "(...)") only has its own
// resolution-derived default duration, with no awareness of what comes
// next — it can run PAST where the next event starts (silently
// overlapping — trimmed here instead), or end BEFORE the next one
// starts, leaving a real gap that was rendering as nothing at all — no
// rest, no error, just missing time. Filled in here with rests, greedily
// decomposed into standard durations (a whole-measure rest included, for
// a gap that spans one) — and finally, once the real events are done,
// the same decomposition completes whatever's left of the FINAL measure,
// since real notation always shows a full bar, rests included, even when
// the actual musical content stops partway through it.
function fillGapsAndCompleteMeasure(events, beatsPerMeasure) {
  const decompDurations = [...STD_DURATIONS_16THS, beatsPerMeasure * 4].sort((a, b) => b - a);
  const withGapsFilled = [];
  for (let k = 0; k < events.length; k++) {
    const { legato, ...ev } = events[k];
    const next = events[k + 1];
    const legatoPair = next && legato;
    const dur = next ? (legatoPair ? (next.pos - ev.pos) : Math.min(ev.dur, next.pos - ev.pos)) : ev.dur;
    if (legatoPair && dur !== beatsPerMeasure * 4 && !STD_DURATIONS_16THS.includes(dur)) {
      return { error: `A legato note at beat ${1 + Math.floor((ev.pos % (beatsPerMeasure * 4)) / 4)} doesn't land on a standard note value.` };
    }
    withGapsFilled.push({ ...ev, dur });
    if (!next || legatoPair) continue;
    let gapPos = ev.pos + dur;
    while (gapPos < next.pos) {
      // Never let one decomposed rest cross a measure boundary — real
      // notation always confines a rest to the measure it's in, so a gap
      // spanning a barline (e.g. beat 3 of one measure to beat 1 of the
      // next) needs at least two rests either side of it, not one rest
      // that happens to land on the barline in the middle.
      const distToBarline = beatsPerMeasure * 4 - (gapPos % (beatsPerMeasure * 4));
      const remaining = Math.min(next.pos - gapPos, distToBarline);
      const chunk = decompDurations.find(d => d <= remaining);
      withGapsFilled.push({ pos: gapPos, dur: chunk });
      gapPos += chunk;
    }
  }

  const lastEv = withGapsFilled[withGapsFilled.length - 1];
  const lastEnd = lastEv.pos + lastEv.dur;
  const measureEnd = Math.ceil(lastEnd / (beatsPerMeasure * 4)) * (beatsPerMeasure * 4);
  let tailPos = lastEnd;
  while (tailPos < measureEnd) {
    const chunk = decompDurations.find(d => d <= measureEnd - tailPos);
    withGapsFilled.push({ pos: tailPos, dur: chunk });
    tailPos += chunk;
  }
  return { events: withGapsFilled };
}

// A notation block's optional "Key: <name>" line (its own line, right
// after the block's heading, same position as a chord section's "(XYZ)"
// abbreviation — see SECTION_ABBR_RE) — draws a traditional key signature
// (sharps/flats after the clef) instead of spelling every accidental out
// on each note. Accepts a bare major key ("Eb", "F#") or a minor one
// ("Cm"/"C min"/"C minor"/"C aeolian", all the same thing) — a minor key
// shares its relative major's signature (e.g. "Cm" = 3 flats, same as Eb
// major). Returns the signature as a signed count (+N sharps, -N flats),
// or {error} for an unrecognized key name.
const MAJOR_KEY_SIGNATURES = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};
const MINOR_KEY_SIGNATURES = {
  A: 0, E: 1, B: 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7,
  D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7,
};
function parseKeySignature(name) {
  const m = /^([A-Ga-g])([#b]?)\s*(m|min|minor|aeolian)?$/i.exec(name.trim());
  if (!m) return { error: `Couldn't parse "${name}" as a key.` };
  const key = m[1].toUpperCase() + (m[2] ? m[2].toLowerCase() : "");
  const table = m[3] ? MINOR_KEY_SIGNATURES : MAJOR_KEY_SIGNATURES;
  if (!(key in table)) return { error: `"${name}" isn't a standard key.` };
  return { count: table[key] };
}

// A PERCUSSION voice line — "|" splits it into bars same as a melody
// voice, and every token within a bar is a bare bar-relative position
// ("1", "2.3" — beat[.16th], no leading measure number, no letter prefix
// at all since there's no pitch to separate it from with "@"). Deliberately
// simpler than a melody voice line: every hit must be explicitly
// positioned — no bare-position inference, no dash-chained held notes, no
// legato groups — since a percussion pattern is normally written out in
// full anyway. Duration still comes from the position's own part-count,
// same rule as a melody note's default (1 part = quarter, 2 parts = 16th)
// — so it renders with the exact same notehead/stem/flag visuals as a
// pitched voice, just without a pitch to place vertically.
function isPercussionToken(tok) {
  return tok === "|" || /^\d+(\.\d+)?$/.test(tok);
}
function parsePercussionVoiceLine(line, beatsPerMeasure) {
  const bars = line.trim().split("|").map(s => s.trim()).filter(Boolean);
  if (bars.length === 0) return { error: "Notation voice has no hits." };
  const events = [];
  for (let barIdx = 0; barIdx < bars.length; barIdx++) {
    const tokens = bars[barIdx].split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { error: `Bar ${barIdx + 1} has no hits.` };
    for (const token of tokens) {
      const m = /^(\d+)(?:\.(\d+))?$/.exec(token);
      if (!m) return { error: `Couldn't parse percussion hit "${token}".` };
      const parts = [m[1], m[2]].filter(x => x !== undefined).map(Number);
      if (parts[0] < 1 || parts[0] > beatsPerMeasure) {
        return { error: `Beat ${parts[0]} is out of range in "${token}" (this song has ${beatsPerMeasure} beats per bar).` };
      }
      const { pos, resUnits } = posToUnits(parts, beatsPerMeasure);
      if (pos >= beatsPerMeasure * 4) {
        return { error: `"${token}" lands beyond the end of bar ${barIdx + 1} (this song has ${beatsPerMeasure} beats per bar).` };
      }
      events.push({ pos: barIdx * beatsPerMeasure * 4 + pos, dur: resUnits, hit: true });
    }
  }
  // Same gap/overlap/final-measure handling melody voices get — a hit's
  // own default duration has no awareness of the next hit either, so
  // without this a pattern that doesn't perfectly tile its measure was
  // just missing rests (and possibly silently overlapping) with nothing
  // shown for it.
  return fillGapsAndCompleteMeasure(events, beatsPerMeasure);
}

// A melody notation block can split ONE voice across TWO adjacent "-"
// lines instead of fusing pitch and position into every token: a
// RHYTHM line (bare position pins, optionally "(...)"-grouped, "|"
// bar-separated — no pitch content at all) immediately followed by a
// PITCH line (a flat, bar-agnostic list of pitches/chords/rests, no "@"
// or "|" or "(...)" at all). This is the whole point of the "|"-relative
// pin redesign: once a bar's rhythm no longer embeds which bar it is, the
// SAME rhythm text can be reused (copy-pasted, "|"-joined) across as many
// bars as the pattern actually repeats for — e.g. a 2-bar montuno vamped
// under a 4-bar chord loop — while the pitch line just lists what plays
// at each of those slots, in order, once. Detected by shape (no explicit
// marker needed): a rhythm-only line followed by a pitch-only line pair up
// automatically; anything else (including today's default, a single line
// fusing pitch+position per token) is untouched.
//   Montuno:
//   - (@1.1 @2.1 @2.3 @3.3 @4.3) | (@1.3 @2.3 @3.1 @4)
//   - [G3,G4] [C4,Eb4] [Ab3,Ab4] [C4,Eb4] [G3,G4] [C4,Eb4] [Ab3,Ab4] [Ab3,Ab4] [C4,Eb4]
function isRhythmOnlyLine(tokens) {
  return tokens.length > 0 && tokens.every(t => t === "|" || /^\(*@\d+(\.\d+)?\)*$/.test(t));
}
function isPitchOnlyLine(tokens) {
  return tokens.length > 0 && tokens.every(t => !/[@|()]/.test(t));
}

// Splices a rhythm line's position pins onto a pitch line's bare tokens,
// in order, producing the same fused text parseMelodyVoiceLine already
// understands — so the two-line form is sugar over the one-line form, not
// a second parser to maintain. "|" passes through untouched (doesn't
// consume a pitch); every other rhythm token gets the next pitch token
// spliced in between its own leading "("s and trailing ")"/pin.
function mergeRhythmAndPitchLines(rhythmTokens, pitchTokens) {
  const out = [];
  let pi = 0;
  for (const rt of rhythmTokens) {
    if (rt === "|") { out.push("|"); continue; }
    if (pi >= pitchTokens.length) {
      return { error: `The rhythm line has more position pins than the pitch line has pitches (${pitchTokens.length}).` };
    }
    const m = /^(\(*)(@[\d.]+)(\)*)$/.exec(rt);
    out.push(m[1] + pitchTokens[pi] + m[2] + m[3]);
    pi++;
  }
  if (pi < pitchTokens.length) {
    return { error: `The pitch line has more pitches (${pitchTokens.length}) than the rhythm line has position pins (${pi}).` };
  }
  return { text: out.join(" ") };
}

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

// Abbreviates a section name to its word-initials, e.g. "Guitar Solo" ->
// "GS", "Verse" -> "V" — short enough to sit in a small structure-nav
// chip while still hinting at the section under a glance/hover. Used both
// for rendering chips (progressions.html) and for resolving a Structure:
// entry like "B2" back to a section (resolveStructureEntry below).
function abbreviateSectionName(name) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase();
  return initials || "?";
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
const NOTATION_KEY_RE = /^Key:\s*(.+)$/i;

function parseSongSections(text, beatsPerMeasure) {
  const lines = text.split("\n");
  const rawSections = [];
  let current = { name: "", abbr: null, key: null, lines: [] };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const headingMatch = !trimmed.includes("|") && !trimmed.startsWith(">") && /^(.+):$/.exec(trimmed);
    const keyMatch = current.lines.length === 0 && current.key === null && NOTATION_KEY_RE.exec(trimmed);
    if (headingMatch) {
      if (current.lines.length > 0 || current.name) rawSections.push(current);
      current = { name: headingMatch[1].trim(), abbr: null, key: null, lines: [] };
    } else if (current.lines.length === 0 && current.abbr === null && SECTION_ABBR_RE.test(trimmed)) {
      current.abbr = SECTION_ABBR_RE.exec(trimmed)[1];
    } else if (keyMatch) {
      current.key = keyMatch[1].trim();
    } else {
      current.lines.push(trimmed);
    }
  }
  if (current.lines.length > 0 || current.name) rawSections.push(current);
  if (rawSections.length === 0) return { error: "No chords found." };

  const sections = [], notationBlocks = [];
  for (const s of rawSections) {
    if (s.lines.length === 0) continue; // a heading with no chart lines under it
    if (s.lines.every(l => l.startsWith("-"))) {
      const rawContents = s.lines.map(l => l.slice(1).trim());
      // Fold any rhythm-line + pitch-line pair into one fused line before
      // anything else looks at these — see isRhythmOnlyLine above.
      const contents = [];
      for (let i = 0; i < rawContents.length; i++) {
        const curTokens = rawContents[i].split(/\s+/).filter(Boolean);
        const nextTokens = i + 1 < rawContents.length ? rawContents[i + 1].split(/\s+/).filter(Boolean) : null;
        if (nextTokens && isRhythmOnlyLine(curTokens) && isPitchOnlyLine(nextTokens)) {
          const merged = mergeRhythmAndPitchLines(curTokens, nextTokens);
          if (merged.error) return { error: `Notation block "${s.name}": ${merged.error}` };
          contents.push(merged.text);
          i++; // consumed the pitch line too
        } else {
          contents.push(rawContents[i]);
        }
      }
      const isPerc = contents.map(l => l.split(/\s+/).every(isPercussionToken));
      if (isPerc.some(Boolean) && !isPerc.every(Boolean)) {
        return { error: `Notation block "${s.name}" mixes percussion hits and melody notes — keep each block one or the other.` };
      }
      const percussion = isPerc[0];
      if (percussion && contents.length > 2) {
        return { error: `Percussion notation block "${s.name}" has ${contents.length} voices — at most 2 (one above, one below the line) are supported.` };
      }
      let keySignature = 0;
      if (s.key) {
        const parsedKey = parseKeySignature(s.key);
        if (parsedKey.error) return { error: parsedKey.error };
        keySignature = parsedKey.count;
      }
      const voices = [];
      for (const l of contents) {
        const result = percussion ? parsePercussionVoiceLine(l, beatsPerMeasure) : parseMelodyVoiceLine(l, beatsPerMeasure);
        if (result.error) return { error: result.error };
        voices.push(result.events);
      }
      notationBlocks.push({ name: s.name, percussion, keySignature, voices });
      continue;
    }
    const result = parseSectionLines(s.lines, beatsPerMeasure);
    if (result.error) return { error: result.error };
    sections.push({ name: s.name, abbr: s.abbr, rows: result.rows });
  }
  if (sections.length === 0) return { error: "No chords found." };
  return { sections, notationBlocks };
}

// Resolves one Structure: entry to { name, label }. Three forms, tried in
// order:
//  1. An exact section name (today's only form, still the common case)
//     -> { name, label: null } — auto-numbered the normal way.
//  2. A section's own resolved abbreviation (custom "(XYZ)" marker, or
//     the auto-computed initials) used whole, e.g. "V1" for a section
//     actually named "Verse 1" -> { name, label: entry } — the entry
//     IS already a complete, valid label, nothing more to resolve.
//  3. That abbreviation plus a trailing number — e.g. "B2" for a
//     "Bridge" section that repeats — strips the digits, matches the
//     remainder against an abbreviation, and again uses the whole entry
//     as an explicit label. This is what actually lets a chart order or
//     pick specific repeats: "Structure: B2, B1" plays the B2-lyrics
//     pass first even though B1 is written first.
// Returns { error } if none of the three match anything.
function resolveStructureEntry(entry, sections) {
  const named = sections.find(s => (s.name || "").trim().toLowerCase() === entry.toLowerCase());
  if (named) return { name: named.name, label: null };

  const abbrOf = (s) => (s.abbr || abbreviateSectionName(s.name || "")).toLowerCase();
  const byAbbr = sections.find(s => s.name && abbrOf(s) === entry.toLowerCase());
  if (byAbbr) return { name: byAbbr.name, label: entry };

  const digitMatch = /^(.*?)(\d+)$/.exec(entry);
  if (digitMatch) {
    const byBaseAbbr = sections.find(s => s.name && abbrOf(s) === digitMatch[1].toLowerCase());
    if (byBaseAbbr) return { name: byBaseAbbr.name, label: entry };
  }

  return { error: `Structure references unknown section or label "${entry}".` };
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
  // spaces ("Verse 1", "Guitar Solo"). Each entry resolves (see
  // resolveStructureEntry above) to { name, label } — label is null for
  // a plain section name (today's only form; auto-numbered the normal
  // way — see renderStructureNav), or the literal text for an entry that
  // named a specific occurrence directly (e.g. "B2"), letting you both
  // reorder repeats and pick which one plays where independent of
  // writing order — "Structure: B2, B1" plays the B2-lyrics pass before
  // B1's, even though B1 is written first in the chart.
  if (structure) {
    const resolved = [];
    for (const entry of structure) {
      const r = resolveStructureEntry(entry, result.sections);
      if (r.error) return { error: r.error };
      resolved.push(r);
    }
    structure = resolved;
  }

  // Flatten in render order (section -> row -> bar) so DOM order from
  // renderLeadsheet lines up 1:1 with playback's beat-timed event order.
  const measures = [];
  result.sections.forEach(sec => sec.rows.forEach(row => row.measures.forEach(bar => measures.push(bar))));

  if (!originalKey) {
    const first = measures.flat().find(ev => !ev.rest);
    if (first) originalKey = first.root;
  }

  return { title, artist, beatsPerMeasure, bpm, beatWidth, structure, originalKey, transposedKey, lyricSize, sections: result.sections, notationBlocks: result.notationBlocks, measures };
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
// [[project_lyre_app]]/the copyright constraint). Also the default seed
// content for a freshly-connected EMPTY Drive file — see
// ensureDriveFileSeeded in drive.js — which is the only thing this object
// still feeds directly; the same text additionally lives (verbatim) as the
// first entries in songs-data.md, which is what actually populates the
// song dropdown on load (see loadSavedSongs in progressions.html) — kept
// here too since a brand-new Drive file has no access to that file.
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

// No more hardcoded built-in songs here — the "Feature Tutorial" demo and
// the 8 seed progressions above now live in songs-data.md (a tracked file
// in this repo, not gitignored — see .gitignore), loaded the exact same
// way any saved song is: via devserver.py's /api/songs locally, or a
// plain static fetch of songs-data.md itself when there's no server (the
// live GitHub Pages deploy) — see loadSavedSongs in progressions.html.
// That's what lets "Save & overwrite" on the tutorial actually reach this
// repo instead of writing somewhere disconnected from it. SONG_TEXTS stays
// as an (empty) hook — SONG_RAW_TEXT still seeds from it — for any future
// content someone deliberately wants hardcoded rather than file-backed.
const SONG_TEXTS = {};
const SONGS = {};

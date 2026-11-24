const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLyre, plain } = require("./helpers/load-lyre.js");

const {
  parseSongText, parseMelodyVoiceLine, parsePercussionVoiceLine,
  parseKeySignature, abbreviateSectionName, resolveStructureEntry, occurrenceIndexForTag, structureOccurrences, sectionAbbreviationWarnings,
  SONG_TEXTS, setNotesInRawText, parseSongHeaderTitleArtist, looksMarkdownMangled,
} = loadLyre();

test("basic chart: sections, bars, and beat count parse", () => {
  const song = parseSongText(`Title: Test\nArtist: Me\nBeats: 4\n\nVerse:\nCmaj7 | Dm7 G7 | Em7 | Em7`);
  assert.equal(song.title, "Test");
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.sections.length, 1);
  assert.equal(song.sections[0].rows[0].measures.length, 4);
});

test("% repeats the previous bar, %N repeats its last N chords", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nV:\nCmaj7 Dm7 Em7@3 | %`);
  const measures = song.sections[0].rows[0].measures;
  assert.equal(measures.length, 2);
  assert.deepEqual(measures[1].map(e => e.root), measures[0].map(e => e.root));
});

test("[Nx] marks a row's playback repeat count without duplicating it", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nV:\nCmaj7 | Dm7 [4x]`);
  assert.equal(song.sections[0].rows[0].repeatCount, 4);
  assert.equal(song.sections[0].rows[0].measures.length, 2); // still just the 2 written bars
});

test("N.C. is a silent one-bar rest", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nV:\nN.C.`);
  assert.equal(song.sections[0].rows[0].measures[0][0].rest, true);
});

test("a chord can pin to an exact beat and 16th subdivision", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nV:\nCmaj7 A7@3.4`);
  const bar = song.sections[0].rows[0].measures[0];
  const pinned = bar.find(e => e.root === "A");
  assert.ok(pinned, "expected an A-rooted event in the bar");
  assert.equal(pinned.beat, 3);
  assert.equal(pinned.sixteenth, 4);
});

test("resolveStructureEntry disambiguates repeated sections by abbreviation+number", () => {
  const sections = [
    { name: "Bridge", abbr: undefined }, { name: "Bridge", abbr: undefined },
  ];
  assert.deepEqual(plain(resolveStructureEntry("B1", sections)), { name: "Bridge", label: "B1" });
  assert.deepEqual(plain(resolveStructureEntry("B2", sections)), { name: "Bridge", label: "B2" });
  assert.deepEqual(plain(resolveStructureEntry("Bridge", sections)), { name: "Bridge", label: null });
  assert.ok(resolveStructureEntry("Nonexistent", sections).error);
});

test("abbreviateSectionName takes initials of each word", () => {
  assert.equal(abbreviateSectionName("Rhythm Tricks"), "RT");
  assert.equal(abbreviateSectionName("Intro"), "I");
});

test("parseKeySignature accepts major and minor spellings, rejects nonsense", () => {
  assert.equal(parseKeySignature("Eb").count, -3);
  assert.equal(parseKeySignature("F#").count, 6);
  assert.equal(parseKeySignature("Cm").count, -3); // relative minor of Eb major
  assert.equal(parseKeySignature("C minor").count, -3);
  assert.ok(parseKeySignature("H").error);
});

test("\"|\" bars don't swallow the rest between two DIFFERENT legato groups (regression, 2026-09-24)", () => {
  // The exact Cuban Son montuno bars that surfaced the original bug: the
  // last note of one bar's (...) group was tying straight into the first
  // note of the next bar's (...) group, eating the rest that belonged
  // between them. (Originally reproduced with absolute @measure.beat.16th
  // pins before the "|"-relative grammar existed; same two bars, same bug.)
  const line = "([G3,G4]@1.1 [C4,Eb4]@2.1 [Ab3,Ab4]@2.3 [C4,Eb4]@3.3 [G3,G4]@4.3) | ([C4,Eb4]@1.3 [Ab3,Ab4]@2.3 [Ab3,Ab4]@3.1 [C4,Eb4]@4)";
  const result = parseMelodyVoiceLine(line, 4);
  assert.ok(!result.error, result.error);
  const rests = result.events.filter(e => !e.pitches && !e.chordSymbol);
  assert.equal(rests.length, 2, "expected a 16th rest + an 8th rest filling the barline gap");
  assert.deepEqual(plain(rests.map(r => r.dur)).sort((a, b) => a - b), [1, 2]);
  // Every event's duration must still tile the two bars exactly (no
  // overlap, no unaccounted gap).
  const totalDur = result.events.reduce((sum, e) => sum + e.dur, 0);
  assert.equal(totalDur, 4 * 4 * 2); // beatsPerMeasure(4) * 4 sixteenths/beat * 2 bars
});

test("legato groups: an interior note still fully stretches to meet the next", () => {
  const result = parseMelodyVoiceLine("(C4@1 E4@2 G4@3)", 4);
  assert.ok(!result.error, result.error);
  // C4 (pos 0) reaches exactly to E4's start (pos 4), and E4 to G4's start
  // (pos 8) — no rest at either interior transition. G4 itself (the note
  // that closes the group) correctly does NOT stretch past it: it keeps its
  // own quarter-note default and a trailing rest fills the rest of the
  // measure, same as any ordinary non-legato note would.
  assert.equal(result.events[0].dur, 4); // C4 -> E4
  assert.equal(result.events[1].dur, 4); // E4 -> G4
  assert.equal(result.events[2].dur, 4); // G4's own default, not stretched
  assert.equal(result.events.length, 4);
  // A rest event carries neither `pitches` nor `chordSymbol` — that absence
  // IS how the renderer (views.js) recognizes a rest, there's no separate flag.
  assert.ok(!result.events[3].pitches && !result.events[3].chordSymbol);
});

test("a lone single-note \"(A)\" group doesn't stretch past itself", () => {
  const result = parseMelodyVoiceLine("(C4@1) G4@3", 4);
  assert.ok(!result.error, result.error);
  // C4 has its own default (quarter-note) duration, capped at reaching G4 —
  // since G4 starts 8 sixteenths later, there's a gap that must be rest-filled.
  const rests = result.events.filter(e => !e.pitches);
  assert.ok(rests.length > 0, "expected a rest between the lone legato note and the next note");
});

test("held notes (dash-chained same pitch) merge into one longer note", () => {
  const result = parseMelodyVoiceLine("C4@1-C4@3", 4);
  assert.ok(!result.error, result.error);
  const sounding = result.events.filter(e => e.pitches);
  assert.equal(sounding.length, 1, "a dash-chained repeat of the same pitch should be one held note, not two attacks");
});

test("\"|\" bars in a melody voice are independent: nothing can carry across one", () => {
  // An unclosed "(" at the end of a bar is an error, not silently carried
  // into the next bar's own (fresh) legato state.
  const unclosed = parseMelodyVoiceLine("(C4@1 E4@2 | G4@1)", 4);
  assert.ok(unclosed.error, "an unclosed legato group should error, not silently close in the next bar");

  // A position beyond the bar's own length is an error too (only possible
  // to detect now that a bar's own extent is explicit via "|").
  const overflow = parseMelodyVoiceLine("C4@1 D4@2 E4@3 F4@4 G4", 4);
  assert.ok(overflow.error, "content spilling past the bar's own end should be rejected");
});

test("melody voice: out-of-range beat is rejected", () => {
  const result = parseMelodyVoiceLine("C4@9", 4);
  assert.ok(result.error, "beat 9 in a 4-beat measure should be rejected");
});

test("a rhythm-only line + a pitch-only line zip together into one voice", () => {
  // Same shape real content uses (Cuban Son pairs its notation blocks
  // with a "Chords:" section) — a notation block alone would parse fine
  // too (see "notation-only songs parse without a chord section" below).
  const song = parseSongText(`Title: T\nArtist: A\nBeats: 4\n\nMontuno:\n- (@1.1 @2.1) | (@3 @4)\n- [C4,E4] [D4,F4] G4 A4\n\nChords:\nC | G`);
  assert.ok(!song.error, song.error);
  const voice = song.notationBlocks[0].voices[0];
  const sounding = voice.filter(e => e.pitches);
  assert.equal(sounding.length, 4);
  assert.deepEqual(plain(sounding.map(e => e.pitches.map(p => p.letter))), [["C", "E"], ["D", "F"], ["G"], ["A"]]);
});

test("rhythm/pitch line pairing errors on a slot-count mismatch, either direction", () => {
  const tooFewPitches = parseSongText(`Title: T\nArtist: A\nBeats: 4\n\nM:\n- @1 @2 @3\n- C4 D4\n\nChords:\nC`);
  assert.ok(tooFewPitches.error);
  const tooManyPitches = parseSongText(`Title: T\nArtist: A\nBeats: 4\n\nM:\n- @1 @2\n- C4 D4 E4\n\nChords:\nC`);
  assert.ok(tooManyPitches.error);
});

test("percussion voice: \"|\" bars, bar-relative pins, gaps become rests, out-of-range beats error", () => {
  const result = parsePercussionVoiceLine("1 3 | 2.3", 4);
  assert.ok(!result.error, result.error);
  assert.ok(result.events.some(e => !e.hit), "expected at least one rest filling the gap");
  // "2.3" in bar 2 (barIdx 1) = beat2, 16th3 -> local pos (2-1)*4+(3-1)=6, absolute 16+6=22.
  assert.ok(result.events.some(e => e.hit && e.pos === 22), "expected bar 2's hit at its bar-relative position");

  const bad = parsePercussionVoiceLine("9", 4);
  assert.ok(bad.error, "beat 9 in a 4-beat measure should be rejected");
});

test("every built-in song (tutorial + seed progressions) parses cleanly, chart and notation alike", () => {
  for (const [key, text] of Object.entries(SONG_TEXTS)) {
    const song = parseSongText(text);
    assert.ok(!song.error, `${key}: ${song.error}`);
    for (const block of song.notationBlocks || []) {
      for (const voice of block.voices) {
        assert.ok(Array.isArray(voice.events) || Array.isArray(voice), `${key}/${block.name}: a voice failed to parse`);
      }
    }
  }
});

test("songs-data.md (real saved content, incl. Cuban Son's rhythm/pitch-split montuno) parses cleanly", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "songs-data.md"), "utf8");
  const blocks = text.split(/\n---\n/).filter(b => b.trim());
  assert.ok(blocks.length >= 2, "expected multiple \\n---\\n-separated songs in songs-data.md");
  for (const block of blocks) {
    const title = (/^Title:\s*(.+)$/m.exec(block) || [, "(untitled)"])[1];
    const song = parseSongText(block);
    assert.ok(!song.error, `${title}: ${song.error}`);
  }
});

test("notation-only songs parse without a chord section (no chart, just melody)", () => {
  const song = parseSongText(`Title: T\nArtist: A\nBeats: 4\n\nMelody:\n- [C4,E4] [D4,F4] G4 A4`);
  assert.ok(!song.error, song.error);
  assert.equal(song.sections.length, 0);
  assert.equal(song.notationBlocks.length, 1);
  assert.equal(song.originalKey, "C", "falls back to C with no chord to read a key off of");
});

test("a section whose every line starts with \">\" becomes a standalone lyrics block, no chords needed", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nBridge:\n> words with no chords under them yet\n> more words, same deal`);
  assert.ok(!song.error, song.error);
  assert.equal(song.sections.length, 0);
  assert.equal(song.lyricsBlocks.length, 1);
  assert.equal(song.lyricsBlocks[0].name, "Bridge");
  assert.deepEqual(plain(song.lyricsBlocks[0].lines), [
    ["words with no chords under them yet"],
    ["more words, same deal"],
  ]);
});

test("a standalone lyrics line can use \"|\" to split itself into bars, same as a chord row", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nBridge:\n> words for bar one | and bar two | and bar three`);
  assert.ok(!song.error, song.error);
  assert.deepEqual(plain(song.lyricsBlocks[0].lines), [
    ["words for bar one", "and bar two", "and bar three"],
  ]);
});

test("a song with no chords, no notation, and no lyrics still errors", () => {
  const song = parseSongText(`Title: T\nArtist: A\n\nVerse:\n`);
  assert.ok(song.error, "expected an empty section to still error");
});

test("Notes: header parses multi-line free text, with blank lines and colons", () => {
  const song = parseSongText(`Title: T\nArtist: A\nNotes: slow down | bridge:\n  watch the G7\n  .\n  Title: not a field\n\nV:\nCmaj7`);
  assert.equal(song.notes, "slow down | bridge:\nwatch the G7\n\nTitle: not a field");
  assert.equal(song.title, "T");
  assert.deepEqual({ ...parseSongHeaderTitleArtist(`Title: T\nArtist: A\nNotes:\n  Title: nope\n\nV:\nC`) }, { title: "T", artist: "A" });
});

test("setNotesInRawText round-trips through parseSongText, replacing old notes", () => {
  const raw = `Title: T\nArtist: A\nBPM: 90\nNotes: old\n  older\n\nV:\nCmaj7 | Dm7`;
  for (const notes of ["new note", "a\n\nb", "  indented\nx", ".\n..", ""]) {
    const out = setNotesInRawText(raw, notes);
    const song = parseSongText(out);
    assert.equal(song.notes, notes);
    assert.equal(song.bpm, 90);
    assert.equal(song.sections[0].rows[0].measures.length, 2);
  }
  assert.equal(parseSongText(raw).notes, "old\nolder");
});

test("looksMarkdownMangled flags markdown-escaped songs files, not clean ones", () => {
  // What Drive's markdown editor turned a songs file into (2026-10-28).
  assert.equal(looksMarkdownMangled("Em7 \\| Am7 \\| F\\#m7 \\[2x\\]"), true);
  assert.equal(looksMarkdownMangled("Title: A\nArtist: B\n\nV:\nEm7 | Am7 | F#m7 [2x]\n> la la@1.1"), false);
  for (const text of Object.values(SONG_TEXTS)) assert.equal(looksMarkdownMangled(text), false);
});

test("occurrenceIndexForTag: (V3) is the 3rd verse-type pass, across Verse I / Verse II", () => {
  const seq = ["Verse I", "Verse II", "Chorus", "Verse I", "Verse II", "Chorus", "Verse I", "Chorus"]
    .map(name => ({ name, abbr: name === "Chorus" ? "C" : name === "Verse I" ? "VI" : "VII" }));
  assert.equal(occurrenceIndexForTag("V1", seq), 0);
  assert.equal(occurrenceIndexForTag("V2", seq), 1);
  assert.equal(occurrenceIndexForTag("V3", seq), 3);
  assert.equal(occurrenceIndexForTag("V5", seq), 6);
  assert.equal(occurrenceIndexForTag("V6", seq), -1);
  assert.equal(occurrenceIndexForTag("C2", seq), 5);
  assert.equal(occurrenceIndexForTag("X1", seq), -1);
});

test("structureOccurrences: played order with repeats numbered", () => {
  const song = parseSongText(`Title: T\nStructure: Intro, Verse, Chorus, Verse, Chorus\n\nIntro:\nC | G\n\nVerse:\nC | G\n\nChorus:\nF | G`);
  assert.deepEqual(plain(structureOccurrences(song)), [
    { name: "Intro", label: "I" }, { name: "Verse", label: "V1" }, { name: "Chorus", label: "C1" },
    { name: "Verse", label: "V2" }, { name: "Chorus", label: "C2" },
  ]);
});

test("structureOccurrences: explicit labels keep their pick; no Structure: falls back to written order", () => {
  const withLabels = parseSongText(`Title: T\nStructure: B2, B1\n\nBridge:\nC | G`);
  assert.equal(withLabels.structure.length, 2);
  const plainSong = parseSongText(`Title: T\n\nVerse:\nC | G\n\nChorus:\nF | G`);
  assert.deepEqual(plain(structureOccurrences(plainSong)), [
    { name: "Verse", label: "V" }, { name: "Chorus", label: "C" },
  ]);
});

test("sectionAbbreviationWarnings: Roman-numeral names collide, digit names don't", () => {
  const roman = parseSongText(`Title: T\nArtist: A\n\nVerse I:\nC | G\n\nVerse II:\nF | G`);
  assert.equal(roman.warnings.length, 1);
  assert.match(roman.warnings[0], /"Verse I" and "Verse II" both abbreviate to "VI"/);
  const digits = parseSongText(`Title: T\nArtist: A\n\nVerse 1:\nC | G\n\nVerse 2:\nF | G`);
  assert.deepEqual(plain(digits.warnings), []);
});

test("sectionAbbreviationWarnings: Intro/Interlude collide until a (XYZ) marker separates them", () => {
  const clash = parseSongText(`Title: T\nArtist: A\n\nIntro:\nC | G\n\nInterlude:\nF | G`);
  assert.equal(clash.warnings.length, 1);
  const fixed = parseSongText(`Title: T\nArtist: A\n\nIntro:\nC | G\n\nInterlude:\n(Int)\nF | G`);
  assert.deepEqual(plain(fixed.warnings), []);
});

test("sectionAbbreviationWarnings: explicit (VI)/(VII) markers, as in an existing chart, don't warn; repeats of one name don't either", () => {
  const marked = parseSongText(`Title: T\nArtist: A\nStructure: VI, VII, C, VI\n\nVerse I:\n(VI)\nC | G\n\nVerse II:\n(VII)\nF | G\n\nChorus:\nC | F`);
  assert.deepEqual(plain(marked.warnings), []);
  assert.deepEqual(plain(marked.structure.map(e => e.name)), ["Verse I", "Verse II", "Chorus", "Verse I"]);
  assert.deepEqual(plain(sectionAbbreviationWarnings([{ name: "Verse" }, { name: "Verse" }])), []);
});

// Transposing a song also transposes its notation blocks (issue #8).
const { transposeSong } = loadLyre();
const notationSong = () => parseSongText(`Title: T\nBeats: 4\n\nVerse:\nCmaj7 | Dm7\n\nMontuno:\nKey: C\n- [Cmaj7]@1 E4@2 r@3 C4@4\n`);
const notePitches = block => block.voices[0].filter(e => e.pitches).map(e => { const p = e.pitches[0]; return `${p.letter}${p.acc === 1 ? "#" : p.acc === -1 ? "b" : ""}${p.octave}`; });

test("transposeSong shifts notation-block pitches, chord labels and key signature", () => {
  const song = notationSong();
  assert.equal(song.notationBlocks[0].keySignature, 0);
  const out = transposeSong(song, 2, true).notationBlocks[0]; // C -> D, sharp spelling
  assert.equal(out.keySignature, 2);
  assert.equal(out.voices[0].find(e => e.chordSymbol).chordSymbol.root, "D");
  assert.deepEqual(plain(notePitches(out)), ["F#4", "D4"]);
  assert.ok(out.voices[0].some(e => !e.pitches && !e.chordSymbol)); // the rest survives
  // the original song is untouched
  assert.deepEqual(plain(notePitches(song.notationBlocks[0])), ["E4", "C4"]);
});

test("transposeSong moves notation pitches the shortest way, across octaves", () => {
  const out = transposeSong(notationSong(), 11, false).notationBlocks[0]; // "up 11" = down 1
  assert.deepEqual(plain(notePitches(out)), ["Eb4", "B3"]);
  assert.equal(out.voices[0].find(e => e.chordSymbol).chordSymbol.root, "B");
  assert.equal(out.keySignature, 5); // B major: 5 sharps
});

test("transposeSong with 0 semitones leaves notation blocks as-is", () => {
  const song = notationSong();
  assert.equal(transposeSong(song, 0, false), song);
});

test("transposeNotationBlock key signature picks flats or sharps by preference", () => {
  const { transposeNotationBlock } = loadLyre();
  const blk = { keySignature: 0, voices: [[]] };
  assert.equal(transposeNotationBlock(blk, 1, false).keySignature, -5); // Db
  assert.equal(transposeNotationBlock(blk, 1, true).keySignature, 7);  // C#
  assert.equal(transposeNotationBlock(blk, 6, false).keySignature, -6); // Gb
  assert.equal(transposeNotationBlock(blk, 6, true).keySignature, 6);  // F#
});

test("fitMeasureWidth / fitLeadsheetGutter cap leadsheet sizes to the container (#9)", () => {
  const { fitMeasureWidth, fitLeadsheetGutter } = loadLyre();
  assert.equal(fitMeasureWidth(640, 215), 215);   // high BeatWidth on a phone shrinks
  assert.equal(fitMeasureWidth(224, 800), 224);   // roomy: unchanged
  assert.equal(fitMeasureWidth(300, 300), 300);   // exact fit
  assert.equal(fitMeasureWidth(300, 0), 300);     // unmeasured (hidden): leave alone
  assert.equal(fitLeadsheetGutter(160, 343), 85); // at most a quarter
  assert.equal(fitLeadsheetGutter(56, 800), 56);
  assert.equal(fitLeadsheetGutter(56, 0), 56);
});

// A trailing "-" holds a note to the end of its bar (needed for MusicXML import).
test("a trailing '-' holds a note to the barline (half note on 3, whole note)", () => {
  const durs = line => plain(parseMelodyVoiceLine(line, 4).events.filter(e => e.pitches).map(e => [e.pos, e.dur]));
  assert.deepEqual(durs("C4@1 D4@2 E4@3-"), [[0, 4], [4, 4], [8, 8]]);
  assert.deepEqual(durs("C4@1-"), [[0, 16]]);
  assert.deepEqual(durs("C4@1-D4@3- | E4@4.3-"), [[0, 8], [8, 8], [30, 2]]);
});

test("a trailing '-' that isn't a standard note value is still an error", () => {
  assert.ok(parseMelodyVoiceLine("C4@1.2-", 4).error); // 15 sixteenths
});

test("Scales: header parses root + scale, first is the main scale", () => {
  const song = parseSongText(`Title: T\nArtist: A\nScales: C dorian, G altered\n\nV:\nC-7 | F7`);
  assert.deepEqual(plain(song.scales), [{ root: "C", scale: "dorian" }, { root: "G", scale: "altered" }]);
  assert.deepEqual(plain(song.warnings), []);
});

test("Scales: unknown entries warn but don't break the song; absent means none", () => {
  const song = parseSongText(`Title: T\nArtist: A\nScales: C dorian, G bogus\n\nV:\nC-7`);
  assert.deepEqual(plain(song.scales), [{ root: "C", scale: "dorian" }]);
  assert.equal(song.warnings.length, 1);
  assert.deepEqual(plain(parseSongText(`Title: T\nArtist: A\n\nV:\nC-7`).scales), []);
});

test("transposeSong moves the saved scale roots with the chords", () => {
  const song = parseSongText(`Title: T\nArtist: A\nScales: C dorian, G altered\n\nV:\nC-7`);
  const out = transposeSong(song, 2, false);
  assert.deepEqual(plain(out.scales), [{ root: "D", scale: "dorian" }, { root: "A", scale: "altered" }]);
});

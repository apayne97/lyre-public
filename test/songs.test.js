const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLyre, plain } = require("./helpers/load-lyre.js");

const {
  parseSongText, parseMelodyVoiceLine, parsePercussionVoiceLine,
  parseKeySignature, abbreviateSectionName, resolveStructureEntry,
  SONG_TEXTS,
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
  // A song needs at least one real chord section (a notation block alone
  // isn't enough — see the "No chords found" check in parseSongSections),
  // same shape real content uses (Cuban Son pairs its notation blocks with
  // a "Chords:" section).
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

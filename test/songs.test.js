const { test } = require("node:test");
const assert = require("node:assert/strict");
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

test("legato groups don't swallow the rest between two DIFFERENT groups (regression, 2026-09-24)", () => {
  // The exact Cuban Son montuno line that surfaced the bug: the last note of
  // one measure's (...) group was tying straight into the first note of the
  // next measure's (...) group, eating the rest that belonged between them.
  const line = "([G3,G4]@1.1.1 [C4,Eb4]@1.2.1 [Ab3,Ab4]@1.2.3 [C4,Eb4]@1.3.3 [G3,G4]@1.4.3) ([C4,Eb4]@2.1.3 [Ab3,Ab4]@2.2.3 [Ab3,Ab4]@2.3.1 [C4,Eb4]@2.4)";
  const result = parseMelodyVoiceLine(line, 4);
  assert.ok(!result.error, result.error);
  const rests = result.events.filter(e => !e.pitches && !e.chordSymbol);
  assert.equal(rests.length, 2, "expected a 16th rest + an 8th rest filling the barline gap");
  assert.deepEqual(plain(rests.map(r => r.dur)).sort((a, b) => a - b), [1, 2]);
  // Every event's duration must still tile the two measures exactly (no
  // overlap, no unaccounted gap).
  const totalDur = result.events.reduce((sum, e) => sum + e.dur, 0);
  assert.equal(totalDur, 4 * 4 * 2); // beatsPerMeasure(4) * 4 sixteenths/beat * 2 measures
});

test("legato groups: an interior note still fully stretches to meet the next", () => {
  const result = parseMelodyVoiceLine("(C4@1.1 E4@1.2 G4@1.3)", 4);
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
  const result = parseMelodyVoiceLine("(C4@1.1) G4@1.3", 4);
  assert.ok(!result.error, result.error);
  // C4 has its own default (quarter-note) duration, capped at reaching G4 —
  // since G4 starts 8 sixteenths later, there's a gap that must be rest-filled.
  const rests = result.events.filter(e => !e.pitches);
  assert.ok(rests.length > 0, "expected a rest between the lone legato note and the next note");
});

test("held notes (dash-chained same pitch) merge into one longer note", () => {
  const result = parseMelodyVoiceLine("C4@1.1-C4@1.3", 4);
  assert.ok(!result.error, result.error);
  const sounding = result.events.filter(e => e.pitches);
  assert.equal(sounding.length, 1, "a dash-chained repeat of the same pitch should be one held note, not two attacks");
});

test("percussion voice: gaps between hits become rests, out-of-range beats error", () => {
  const result = parsePercussionVoiceLine("1.1 1.3", 4);
  assert.ok(!result.error, result.error);
  assert.ok(result.events.some(e => !e.hit), "expected at least one rest filling the gap");

  const bad = parsePercussionVoiceLine("1.9", 4);
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

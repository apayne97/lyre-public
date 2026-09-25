const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadLyre, plain } = require("./helpers/load-lyre.js");

const { buildChord, buildScale, SCALES } = loadLyre();

test("chord extension naming: altered top extension falls back to the last natural rung", () => {
  // The exact bug fixed 2026-09-23 — a flatted/sharped extension must never
  // lend its own number to the chord symbol.
  assert.equal(buildChord({ quality: "major", size: "9th", seventhKey: "dominant7", alt9: "b" }).symbol, "7♭9");
  assert.equal(buildChord({ quality: "major", size: "9th", seventhKey: "dominant7", alt9: "s" }).symbol, "7♯9");
  // A natural 9 with only the 11 altered names the chord "9", not "11".
  assert.equal(buildChord({ quality: "major", size: "11th", seventhKey: "dominant7", alt9: "nat", alt11: "s" }).symbol, "9♯11");
  // Reaching all the way to a natural 13 still names it "13" even though a
  // LOWER extension (the 9) is altered.
  assert.equal(
    buildChord({ quality: "major", size: "13th", seventhKey: "dominant7", alt9: "b", alt11: "omit", alt13: "nat" }).symbol,
    "13♭9"
  );
  // A natural 13 with an altered 11 in between — both real, both shown.
  assert.equal(
    buildChord({ quality: "major", size: "13th", seventhKey: "dominant7", alt9: "nat", alt11: "s", alt13: "nat" }).symbol,
    "13♯11"
  );
});

test("chord extension naming: fully natural extensions use the plain number", () => {
  assert.equal(buildChord({ quality: "major", size: "9th", seventhKey: "dominant7", alt9: "nat" }).symbol, "9");
  assert.equal(
    buildChord({ quality: "major", size: "13th", seventhKey: "dominant7", alt9: "nat", alt11: "omit", alt13: "nat" }).symbol,
    "13"
  );
});

test("triad qualities: correct interval stacks", () => {
  assert.deepEqual(plain(buildChord({ quality: "major", size: "triad" }).tones.map(t => t.interval)), [0, 4, 7]);
  assert.deepEqual(plain(buildChord({ quality: "minor", size: "triad" }).tones.map(t => t.interval)), [0, 3, 7]);
  assert.deepEqual(plain(buildChord({ quality: "diminished", size: "triad" }).tones.map(t => t.interval)), [0, 3, 6]);
  assert.deepEqual(plain(buildChord({ quality: "augmented", size: "triad" }).tones.map(t => t.interval)), [0, 4, 8]);
});

test("seventh chord symbols use the real-book glyphs", () => {
  assert.equal(buildChord({ quality: "major", size: "7th", seventhKey: "major7" }).symbol, "Δ7");
  assert.equal(buildChord({ quality: "minor", size: "7th", seventhKey: "minor7" }).symbol, "-7");
  assert.equal(buildChord({ quality: "diminished", size: "7th", seventhKey: "halfdim7" }).symbol, "ø7");
  assert.equal(buildChord({ quality: "diminished", size: "7th", seventhKey: "dim7" }).symbol, "°7");
  // Dominant 7 has no quality glyph at all — "" + "7".
  assert.equal(buildChord({ quality: "major", size: "7th", seventhKey: "dominant7" }).symbol, "7");
});

test("minor + sharp5 reads as minor-augmented (-+), not a plain -#5 suffix", () => {
  const built = buildChord({ quality: "minor", size: "triad", alt5: "s" });
  assert.equal(built.symbol, "-+"); // QUALITY_SYMBOL.minor ("-") + the augmented marker ("+")
  assert.ok(built.label.includes("#5") || built.label.includes("♯5"));
});

test("add chords skip the 7th entirely — add9 is not a 9th chord missing its 7th", () => {
  const built = buildChord({ quality: "major", addTone: 9 });
  const intervals = plain(built.tones.map(t => t.interval)).sort((a, b) => a - b);
  assert.deepEqual(intervals, [0, 4, 7, 14]); // root, 3rd, 5th, 9th — no b7 (10) anywhere
  assert.equal(built.symbol, "add9");
});

test("sus chords have no 3rd and no size/7th", () => {
  const sus4 = buildChord({ quality: "sus4", size: "triad" });
  assert.deepEqual(plain(sus4.tones.map(t => t.interval)), [0, 5, 7]);
  assert.equal(sus4.symbol, "sus4");
});

test("every scale's intervals and letterSteps arrays are the same length", () => {
  for (const [key, scale] of Object.entries(SCALES)) {
    assert.equal(
      scale.intervals.length, scale.letterSteps.length,
      `${key}: intervals/letterSteps length mismatch`
    );
  }
});

test("every scale starts on the root (interval 0)", () => {
  for (const [key, scale] of Object.entries(SCALES)) {
    assert.equal(scale.intervals[0], 0, `${key} doesn't start at interval 0`);
  }
});

test("buildScale closes the octave (repeats the root a 12th above)", () => {
  const built = buildScale("major");
  const last = built.tones[built.tones.length - 1];
  assert.equal(last.interval, 12);
});

test("Mixolydian b6 (added 2026-09-23) is the 5th mode of melodic minor", () => {
  // C Mixolydian b6 = C D E F G Ab Bb — mixolydian (0,2,4,5,7,9,10) with a
  // flatted 6th (8 instead of 9).
  assert.deepEqual(plain(SCALES.mixolydianB6.intervals), [0, 2, 4, 5, 7, 8, 10]);
});

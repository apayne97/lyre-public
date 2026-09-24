// Shared music-theory core for the circle / fretboard / notation views.

// All 12 pitch classes, with both spellings offered for the 5 that are
// ambiguous, so picking "Ab" spells the whole chord in flats rather than
// forcing everything through G#. Order is display order, not pitch class —
// use pitchClassOf(noteInfoFromName(name)) to get the pitch class.
const ROOT_OPTIONS = ["C","C#","Db","D","D#","Eb","E","F","F#","Gb","G","G#","Ab","A","A#","Bb","B"];
const LETTERS = ["C","D","E","F","G","A","B"];
const LETTER_SEMITONE = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

// ---- Compositional chord builder ----
// A tone (chord or scale) is {interval, letterStep}: `interval` is semitones
// above the root, `letterStep` is how many letters above the root it's
// spelled (see spellDegree()) — this is the shared shape every view
// (circle/fretboard/piano/notation) renders from, whether the tones came
// from buildChord() or buildScale(). For a chord, stacked in thirds, that's
// 2 letters per stack position (root=0, 3rd=2, 5th=4, 7th=6, 9th=8, 11th=10,
// 13th=12) regardless of whether earlier tones were omitted.

const TRIAD_INTERVALS = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6], augmented: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
};
const TRIAD_LABELS = {
  major: "Major", minor: "Minor", diminished: "Diminished", augmented: "Augmented",
  sus2: "Suspended 2nd", sus4: "Suspended 4th",
};
// The middle tone's letter-step above root — normally a 3rd (2 letters up),
// but a suspended chord replaces the 3rd with a 2nd or 4th instead, which
// sit at a different letter-step (used for spelling on the circle/
// fretboard/notation views, same idea as EXTENSION_DEFS below).
const MID_LETTERSTEP = { sus2: 1, sus4: 3 };

// Which 7th qualities make sense over each triad, and what the combined
// chord is conventionally called.
const SEVENTH_OPTIONS = {
  major:      [{ key: "dominant7", interval: 10, qualityWord: "Dominant" }, { key: "major7", interval: 11, qualityWord: "Major" }],
  minor:      [{ key: "minor7", interval: 10, qualityWord: "Minor" }, { key: "minMaj7", interval: 11, qualityWord: "Minor-Major" }],
  diminished: [{ key: "halfdim7", interval: 10, qualityWord: "Half-Diminished" }, { key: "dim7", interval: 9, qualityWord: "Diminished" }],
  augmented:  [{ key: "aug7", interval: 10, qualityWord: "Augmented" }, { key: "augMaj7", interval: 11, qualityWord: "Augmented Major" }],
};

// Compact jazz lead-sheet symbols (the iReal Pro / Real Book convention) —
// used for the chord-name display, as opposed to the spelled-out `label`
// (still used for the 7th-type picker's own option text, where a readable
// word is more useful than a glyph). E.g. "C-7", "AΔ9", "Gø7", "F°7".
const QUALITY_SYMBOL = { major: "", minor: "-", diminished: "°", augmented: "+", sus2: "sus2", sus4: "sus4" };
const SEVENTH_SYMBOL = {
  dominant7: "", major7: "Δ", minor7: "-", minMaj7: "-Δ",
  halfdim7: "ø", dim7: "°", aug7: "+", augMaj7: "+Δ",
};

const SIZE_ORDER = ["triad", "7th", "9th", "11th", "13th"];

// Upper extensions: letter-step above root, and semitone value for flat/natural/sharp.
const EXTENSION_DEFS = {
  9:  { letterStep: 8, b: 13, nat: 14, s: 15 },
  11: { letterStep: 10, b: 16, nat: 17, s: 18 },
  13: { letterStep: 12, b: 20, nat: 21, s: 22 },
};
const ALT_SYMBOL = { b: "♭", nat: "", s: "♯" };

// The 5th, independent of quality: jazz voicings routinely flat or sharp
// the 5th of an otherwise-ordinary chord (C7b5, Cmaj7#5, ...). "default"
// leaves the quality's own 5th (perfect/diminished/augmented) alone;
// b/s override it outright rather than shifting it relatively, since
// that's how the alteration reads in a chord symbol regardless of the
// base quality.
const ALT5_INTERVAL = { b: 6, s: 8 };

// A tone added directly onto a plain triad, bypassing the 7th entirely —
// "add" chords (Cadd2, Cadd9) and the classic "6" chord (which is really
// just "add6", but conventionally written and symbolized without the
// "add"). Letter-step matches how each is actually spelled/voiced: add2
// sits right above the root (not an octave up like a 9th would), add6
// sits as a plain 6th (not a displaced 13th), etc.
const ADD_TONE_DEFS = {
  2: { interval: 2, letterStep: 1 }, 4: { interval: 5, letterStep: 3 }, 6: { interval: 9, letterStep: 5 },
  9: { interval: 14, letterStep: 8 }, 11: { interval: 17, letterStep: 10 }, 13: { interval: 21, letterStep: 12 },
};

// Build a chord from independent choices: triad quality, an optional 5th
// override, how far up the stack it goes (size), which 7th flavor (only
// matters once size !== triad), and a flat/natural/sharp/omit choice for
// each extension actually reached. e.g. quality=major, size=13th,
// seventhKey=dominant7, alt9=s, alt11=omit, alt13=s produces a
// "Dominant 13 (#9, #13)" chord — i.e. a 7#9#13 voicing. `addTone` (2, 4,
// 6, 9, 11 or 13) instead builds a plain triad plus that one extra tone,
// with no 7th at all — mutually exclusive with size/seventhKey/alt9-13.
function buildChord({ quality, size, seventhKey, alt5, alt9, alt11, alt13, addTone }) {
  const tri = TRIAD_INTERVALS[quality];
  const fifthInterval = ALT5_INTERVAL[alt5] ?? tri[2];
  const midLetterStep = MID_LETTERSTEP[quality] ?? 2;
  const altParts = [];
  // Minor triad + sharp 5 is conventionally written/read as "minor
  // augmented" (Cm+), not "C-#5" — same tones, different jazz-symbol
  // convention. The spelled-out label still says "(#5)".
  const isMinorAug = quality === "minor" && alt5 === "s";
  if (alt5 === "b" || alt5 === "s") altParts.push(`${ALT_SYMBOL[alt5]}5`);
  const symbolAltParts = isMinorAug ? ["+"] : [...altParts];

  const tones = [
    { interval: 0, letterStep: 0 },
    { interval: tri[1], letterStep: midLetterStep },
    { interval: fifthInterval, letterStep: 4 },
  ];

  if (addTone) {
    tones.push(ADD_TONE_DEFS[addTone]);
    const addLabel = addTone === 6 ? "6" : `add${addTone}`;
    const label = TRIAD_LABELS[quality] + ` (${addLabel})` + (altParts.length ? ` (${altParts.join(", ")})` : "");
    const symbol = QUALITY_SYMBOL[quality] + symbolAltParts.join("") + addLabel;
    return { label, symbol, tones };
  }

  const seventhOptions = SEVENTH_OPTIONS[quality];
  if (size === "triad" || !seventhOptions) {
    const label = TRIAD_LABELS[quality] + (altParts.length ? ` (${altParts.join(", ")})` : "");
    const symbol = QUALITY_SYMBOL[quality] + symbolAltParts.join("");
    return { label, symbol, tones };
  }

  const seventh = seventhOptions.find(s => s.key === seventhKey) || seventhOptions[0];
  tones.push({ interval: seventh.interval, letterStep: 6 });

  // The number in the chord symbol (7/9/11/13) names the highest EXTENSION
  // THAT'S NATURAL OR OMITTED, not just the highest one reached — an altered
  // extension never lends its number to the chord name (e.g. a flatted 9 on
  // an otherwise plain dominant 7th reads "C7♭9", not "C9♭9"; a chord that
  // reaches 13 with only the 9 altered still reads "C13♭9", since 13 itself
  // is natural). Alterations are always appended as suffixes regardless of
  // whether they belong to the topmost rung or one underneath it.
  const sizeIdx = SIZE_ORDER.indexOf(size);
  let topNumber = "7";
  for (const [num, alt] of [[9, alt9], [11, alt11], [13, alt13]]) {
    if (sizeIdx < SIZE_ORDER.indexOf(`${num}th`)) break;
    if (alt === "omit") { topNumber = String(num); continue; }
    const def = EXTENSION_DEFS[num];
    tones.push({ interval: def[alt], letterStep: def.letterStep });
    if (alt === "nat") {
      topNumber = String(num);
    } else {
      altParts.push(`${ALT_SYMBOL[alt]}${num}`);
      symbolAltParts.push(`${ALT_SYMBOL[alt]}${num}`);
    }
  }

  const label = `${seventh.qualityWord} ${topNumber}` + (altParts.length ? ` (${altParts.join(", ")})` : "");
  const symbol = SEVENTH_SYMBOL[seventh.key] + topNumber + symbolAltParts.join("");
  return { label, symbol, tones };
}

// ---- Scale builder ----
// The 7 modes of the major scale (Major/Ionian through Locrian) plus the two
// pentatonics. All are diatonic (one letter per degree) except the
// pentatonics, which skip degrees — hence the explicit letterSteps per scale
// rather than assuming 0,1,2,3....
// `group` is purely for organizing the picker (see SCALE_GROUPS below) — it
// has no effect on the math. Scales in the same group are modes of each
// other (the same underlying note collection, rooted on a different
// degree) — e.g. D Dorian is the same 7 notes as C Major.
const SCALES = {
  major:           { label: "Major (Ionian)",      group: "Major Scale Modes",     intervals: [0, 2, 4, 5, 7, 9, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  dorian:          { label: "Dorian",              group: "Major Scale Modes",     intervals: [0, 2, 3, 5, 7, 9, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  phrygian:        { label: "Phrygian",            group: "Major Scale Modes",     intervals: [0, 1, 3, 5, 7, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  lydian:          { label: "Lydian",              group: "Major Scale Modes",     intervals: [0, 2, 4, 6, 7, 9, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  mixolydian:      { label: "Mixolydian",          group: "Major Scale Modes",     intervals: [0, 2, 4, 5, 7, 9, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  minor:           { label: "Minor (Aeolian)",     group: "Major Scale Modes",     intervals: [0, 2, 3, 5, 7, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  locrian:         { label: "Locrian",             group: "Major Scale Modes",     intervals: [0, 1, 3, 5, 6, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },

  melodicMinor:    { label: "Melodic Minor",       group: "Melodic Minor Modes",   intervals: [0, 2, 3, 5, 7, 9, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  // 7th mode of melodic minor — every degree of a dominant chord altered.
  altered:         { label: "Altered (Super Locrian)", group: "Melodic Minor Modes", intervals: [0, 1, 3, 4, 6, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  // 5th mode of melodic minor — mixolydian with the 6th flatted (aka the
  // "Hindu scale"). Common over dominant chords voiced with a b13.
  mixolydianB6:    { label: "Mixolydian ♭6",       group: "Melodic Minor Modes",   intervals: [0, 2, 4, 5, 7, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },

  harmonicMinor:   { label: "Harmonic Minor",      group: "Harmonic Minor Modes",  intervals: [0, 2, 3, 5, 7, 8, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  // 5th mode of harmonic minor.
  phrygianDominant:{ label: "Phrygian Dominant",   group: "Harmonic Minor Modes",  intervals: [0, 1, 4, 5, 7, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },

  // These three are NOT modes of each other or of anything above — each has
  // its own separate set of 7 modes (verified: rotating harmonic minor
  // never lands on any of them). Same "no cluster, one augmented 2nd"
  // family as harmonic minor, just a different arrangement of the 3 gaps
  // between the 3 semitones.
  harmonicMajor:   { label: "Harmonic Major",      group: "Other 7-Note Scales",   intervals: [0, 2, 4, 5, 7, 8, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  // R #2 3 #4 5 6 b7 — the conventional spelling/rotation (not the raw
  // derivation order, which is a rotation of the same 7 notes).
  hungarianMajor:  { label: "Hungarian Major",     group: "Other 7-Note Scales",   intervals: [0, 3, 4, 6, 7, 9, 10], letterSteps: [0, 1, 2, 3, 4, 5, 6] },
  // No standard name — the 8-note (whole-half) diminished scale with one
  // note dropped.
  dimGapped:       { label: "Diminished (Gapped)", group: "Other 7-Note Scales",   intervals: [0, 2, 3, 5, 6, 9, 11], letterSteps: [0, 1, 2, 3, 4, 5, 6] },

  majorPentatonic: { label: "Major Pentatonic",    group: "Pentatonic & Blues",    intervals: [0, 2, 4, 7, 9],  letterSteps: [0, 1, 2, 4, 5] },
  // 5th mode of major pentatonic, listed separately since it's used so
  // differently in practice (blues/rock soloing vs. major-key color).
  minorPentatonic: { label: "Minor Pentatonic",    group: "Pentatonic & Blues",    intervals: [0, 3, 5, 7, 10], letterSteps: [0, 2, 3, 4, 6] },
  // The blue note (b5) reuses the 5th's letter, flatted — F, Gb, G is the
  // standard spelling, not F, F#, G.
  blues:           { label: "Blues",               group: "Pentatonic & Blues",   intervals: [0, 3, 5, 6, 7, 10], letterSteps: [0, 2, 3, 4, 4, 6] },

  // Not diatonic — spelled with straight ascending sharps, the usual convention.
  wholeTone:       { label: "Whole Tone",          group: "Symmetric Scales",     intervals: [0, 2, 4, 6, 8, 10], letterSteps: [0, 1, 2, 3, 4, 5] },
  chromatic:       { label: "Chromatic",           group: "Symmetric Scales",
                     intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], letterSteps: [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] },
  // Octatonic — 8 notes, repeating W-H (or H-W) forever. These two ARE modes
  // of each other (rotate whole-half by one semitone and you get
  // half-whole exactly) — kept separate since they're used over completely
  // different chords (diminished-7th vs. dominant-7th). Two consecutive
  // degrees share a letter (flatted then natural), same trick as the blues
  // scale's blue note.
  dimWholeHalf:    { label: "Diminished (Whole-Half)", group: "Symmetric Scales",
                     intervals: [0, 2, 3, 5, 6, 8, 9, 11], letterSteps: [0, 1, 2, 3, 4, 5, 5, 6] },
  dimHalfWhole:    { label: "Diminished (Half-Whole)", group: "Symmetric Scales",
                     intervals: [0, 1, 3, 4, 6, 7, 9, 10], letterSteps: [0, 1, 2, 2, 3, 4, 5, 6] },

  // All 12 pitch classes, ordered by ascending 5th (equivalently, descending
  // 4th) instead of by semitone — the classic wheel, walked out as a
  // sequence: C G D A E B F# C# G# D# A# E#. Each step is +7 semitones
  // (wrapped to stay in one octave, so this renders sanely on piano/staff)
  // and +4 letters (a 5th is always 4 letters, wrapped mod 7 too — which
  // still spells correctly, since spelling only depends on letterStep's
  // position mod 7, not its raw magnitude). Verified this lands on the
  // conventional accumulating-sharps spelling all the way to E# before
  // closing back on the root.
  circleOfFifths:  { label: "Circle of Fourths/Fifths", group: "Circle of Fifths",
                     intervals: [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5],
                     letterSteps: [0, 4, 1, 5, 2, 6, 3, 0, 4, 1, 5, 2] },
};

// Display order for optgroups in the scale picker.
const SCALE_GROUPS = [
  "Major Scale Modes", "Melodic Minor Modes", "Harmonic Minor Modes",
  "Other 7-Note Scales", "Pentatonic & Blues", "Symmetric Scales", "Circle of Fifths",
];

// For each scale, which OTHER scales (at some root offset from it) contain
// the exact same set of notes — e.g. C Minor and Eb Major share every note,
// just rooted on a different degree. This is computed, not hand-curated: for
// every pair of (different) scales, try every possible root offset and keep
// the ones whose pitch-class sets are identical. That makes it automatically
// correct for relationships that are easy to miss by hand — e.g. the two
// octatonic diminished scales turn out to be exact matches of each other,
// offset by a whole step.
//
// ENHARMONIC_MATCHES[key] = [{key: otherKey, offset}, ...], where "otherKey
// rooted at (thisRoot + offset) mod 12" has identical notes to "key rooted
// at thisRoot", for any thisRoot.
const ENHARMONIC_MATCHES = (() => {
  const bitmaskOf = (key) => {
    let mask = 0;
    for (const iv of SCALES[key].intervals) mask |= 1 << (iv % 12);
    return mask;
  };
  const rotate = (mask, offset) => {
    let out = 0;
    for (let pc = 0; pc < 12; pc++) if (mask & (1 << pc)) out |= 1 << ((pc + offset) % 12);
    return out;
  };
  const masks = {};
  for (const key in SCALES) masks[key] = bitmaskOf(key);

  const result = {};
  for (const keyA in SCALES) {
    result[keyA] = [];
    for (const keyB in SCALES) {
      if (keyB === keyA) continue; // same scale type at a different root isn't what we're after here
      for (let offset = 0; offset < 12; offset++) {
        if (rotate(masks[keyB], offset) === masks[keyA]) result[keyA].push({ key: keyB, offset });
      }
    }
  }
  return result;
})();

// One octave (like buildChord's tones, {interval, letterStep} pairs), plus
// the root repeated an octave up so the run actually closes (e.g. C D E F G
// A B C, not stopping dangling on B) — that closing tone also matters for
// the circle view, where it's what draws the last leading-tone-to-tonic arc.
function buildScale(key) {
  const s = SCALES[key];
  const tones = s.intervals.map((interval, i) => ({ interval, letterStep: s.letterSteps[i] }));
  tones.push({ interval: 12, letterStep: 7 });
  return { label: s.label, tones };
}

// Style for the interval between two pitch classes (any semitone distance,
// reduced to the shorter direction, so a 4th/5th share a category, etc).
// `category` keys the circle-view toggles. Used to color arcs/lines (circle
// view) and noteheads (notation view).
function intervalStyle(semitones) {
  const d = Math.min(semitones, 12 - semitones);
  switch (d) {
    case 1: return { color: "var(--half)", curved: false, name: "Half Step", category: "half" };
    case 2: return { color: "var(--whole)", curved: false, name: "Whole Step", category: "whole" };
    case 3: return { color: "var(--minor)", curved: true, name: "Minor 3rd", category: "thirds" };
    case 4: return { color: "var(--major)", curved: true, name: "Major 3rd", category: "thirds" };
    case 5: return { color: "var(--fifth)", curved: false, name: "4th / 5th", category: "fifths" };
    case 6: return { color: "var(--tritone)", curved: false, name: "Tritone", category: "tritone" };
    default: return { color: "var(--ink-muted)", curved: false, name: "", category: null };
  }
}

function noteInfoFromName(name) {
  const letter = name[0];
  const acc = name.length > 1 ? (name[1] === "#" ? 1 : -1) : 0;
  return { letter, acc };
}

function pitchClassOf(letter, acc) {
  return ((LETTER_SEMITONE[letter] + acc) % 12 + 12) % 12;
}

// Like noteInfoFromName, but for a MELODY pitch token, which (unlike a
// chord root) always carries a specific octave digit — "E4", "Bb2", "F#3".
// Scientific pitch notation: C4 is middle C. Returns null for anything that
// doesn't match (letter, optional #/b, one or more digits), so callers can
// tell "not a pitch at all" apart from a genuine parse.
function parseMelodyPitch(token) {
  const m = /^([A-Ga-g])([#b]?)(\d+)$/.exec(token);
  if (!m) return null;
  return { letter: m[1].toUpperCase(), acc: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0, octave: Number(m[3]) };
}

// MIDI note number for a melody pitch — used for playback frequency and
// (via octave*7 + letter-index) for staff placement.
function midiFromPitch(letter, acc, octave) {
  return (octave + 1) * 12 + pitchClassOf(letter, acc);
}

// Spell a chord tone `letterStepsUp` letters above the root (2 = third, 4 = fifth),
// `semitoneInterval` semitones above the root pitch class. Returns the correct
// letter + accidental (not just the nearest enharmonic pitch class), e.g. a
// diminished fifth on C is spelled Gb, not F#.
//
// A double sharp/flat (acc === ±2) is respelled one letter over — e.g. A## is
// shown as B, E## as F# — since nothing is lost (same pitch) and it's just
// easier to read. This is a purely local, mechanical simplification; it does
// NOT solve enharmonic choice in general (see the note where this is called).
function spellDegree(rootName, semitoneInterval, letterStepsUp) {
  const root = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(root.letter, root.acc);
  const rootLetterIdx = LETTERS.indexOf(root.letter);
  const targetPC = ((rootPC + semitoneInterval) % 12 + 12) % 12;

  let letterIdx = (rootLetterIdx + letterStepsUp) % 7;
  let octaveBump = Math.floor((rootLetterIdx + letterStepsUp) / 7);
  let acc = targetPC - LETTER_SEMITONE[LETTERS[letterIdx]];
  while (acc > 6) acc -= 12;
  while (acc < -6) acc += 12;

  if (acc >= 2 || acc <= -2) {
    const shift = acc >= 2 ? 1 : -1;
    const absIdx = letterIdx + shift;
    letterIdx = (absIdx + 7) % 7;
    octaveBump += Math.floor(absIdx / 7);
    acc = targetPC - LETTER_SEMITONE[LETTERS[letterIdx]];
    while (acc > 6) acc -= 12;
    while (acc < -6) acc += 12;
  }

  return { letter: LETTERS[letterIdx], acc, octaveBump, pitchClass: targetPC };
}

const ACCIDENTAL_SYMBOL = { "-2": "♭♭", "-1": "♭", "0": "", "1": "♯", "2": "♯♯" };

// A spellDegree() result's `acc` can in principle run past ±2 before the
// double-accidental respelling kicks in; clamp defensively so a lookup
// never misses (used identically by the fretboard, piano, and notation
// views for note labels).
function accidentalSymbolFor(acc) {
  return ACCIDENTAL_SYMBOL[String(Math.max(-2, Math.min(2, acc)))] || "";
}

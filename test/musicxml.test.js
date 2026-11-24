const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadLyre, plain } = require("./helpers/load-lyre.js");

const { importMusicXml, parseSongText, transposeSong, mxParseXmlFallback, musicXmlHeaderText } = loadLyre();

const fixture = name => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));
const pitchName = p => `${p.letter}${p.acc === 1 ? "#" : p.acc === -1 ? "b" : ""}${p.octave}`;
const summarize = events => plain(events.map(e => [e.pos, e.dur, e.pitches ? e.pitches.map(pitchName).join("+") : "r"]));
// Import a fixture and parse the generated text back through the app's own parser.
async function importAndParse(name) {
  const result = await importMusicXml(fixture(name));
  assert.equal(result.error, undefined);
  const song = parseSongText(`${musicXmlHeaderText(result.header)}\n\n${result.text}`);
  assert.equal(song.error, undefined);
  return { result, song };
}

const SIMPLE_MELODY = [
  [0, 4, "C5"], [4, 4, "D5"], [8, 8, "Eb5"],
  [16, 6, "G4"], [22, 2, "Ab4"], [24, 8, "Bb4+D5"],
  [32, 16, "r"],
  [48, 8, "G4"], [56, 4, "A4"], [60, 4, "A4"],       // the tied G + G merge; the two A's stay separate attacks
  [64, 2, "r"], [66, 2, "C5"], [68, 4, "D5"], [72, 8, "r"],
];

test("simple .musicxml: melody durations, chords, key and header come through", async () => {
  const { result, song } = await importAndParse("simple.musicxml");
  assert.deepEqual(plain(result.warnings), []);
  assert.deepEqual(plain(result.header), { title: "Fixture Tune", artist: "Test Composer", beats: 4, bpm: 96, originalKey: "Eb" });
  assert.equal(song.title, "Fixture Tune");
  assert.equal(song.notationBlocks.length, 1);
  assert.equal(song.notationBlocks[0].keySignature, -3);
  assert.deepEqual(summarize(song.notationBlocks[0].voices[0]), SIMPLE_MELODY);
  // chords: bar 1 Cm7 + Abmaj7 on beat 3, bar 2 Fm7 + Bb7 on beat 3, bar 3 Ebmaj7, then held
  const roots = song.measures.map(m => m.map(e => e.root));
  assert.deepEqual(plain(roots.slice(0, 3)), [["C", "Ab"], ["F", "Bb"], ["Eb"]]);
  assert.equal(song.measures[0][1].beat, 3);
});

test(".mxl (deflated and stored) imports identically to the plain .musicxml", async () => {
  const plainText = (await importMusicXml(fixture("simple.musicxml"))).text;
  assert.equal((await importMusicXml(fixture("simple.mxl"))).text, plainText);
  assert.equal((await importMusicXml(fixture("simple-stored.mxl"))).text, plainText);
});

test("imported notation transposes like hand-written notation", async () => {
  const { song } = await importAndParse("simple.musicxml");
  const out = transposeSong(song, 2, false).notationBlocks[0]; // Eb -> F
  assert.equal(out.keySignature, -1);
  assert.deepEqual(summarize(out.voices[0]).slice(0, 3), [[0, 4, "D5"], [4, 4, "E5"], [8, 8, "F5"]]);
});

test("unsupported features each produce a visible warning", async () => {
  const { result } = await importAndParse("warnings.musicxml");
  const all = result.warnings.join("\n");
  for (const expected of ["2 parts", "more than one staff", "Grace notes", "Tuplets", "Ornaments", "slash-chord", "Repeat signs", "tied across a barline", "Lyrics"]) {
    assert.ok(all.includes(expected), `missing warning containing "${expected}" in:\n${all}`);
  }
});

test("a pickup bar is padded with a leading rest", async () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="0" implicit="yes"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration></note></measure>
    <measure number="1"><note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration></note></measure></part></score-partwise>`;
  const result = await importMusicXml(new TextEncoder().encode(xml));
  assert.ok(result.warnings.some(w => w.includes("pickup")));
  const song = parseSongText(`Title: T\nBeats: 4\n\n${result.text}`);
  assert.deepEqual(summarize(song.notationBlocks[0].voices[0]).slice(0, 2), [[0, 12, "r"], [12, 4, "G4"]]);
});

test("errors are returned, not thrown", async () => {
  assert.match((await importMusicXml(new TextEncoder().encode("<score-timewise/>"))).error, /timewise/i);
  assert.match((await importMusicXml(new TextEncoder().encode("<html/>"))).error, /MusicXML/);
  assert.ok((await importMusicXml(new TextEncoder().encode("not xml at all"))).error);
  assert.match((await importMusicXml(new Uint8Array([0x50, 0x4b, 1, 2, 3, 4, 5, 6]))).error, /zip/i);
});

test("fallback XML parser handles entities, CDATA, DOCTYPE and self-closing tags", () => {
  const tree = mxParseXmlFallback(`<?xml version="1.0"?><!DOCTYPE a PUBLIC "x" "y"><!-- c --><a k="1 &amp; 2"><b/><c><![CDATA[<x>]]> &lt;y&gt;</c></a>`);
  assert.equal(tree.name, "a");
  assert.equal(tree.attrs.k, "1 & 2");
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[1].text, "<x> <y>");
});

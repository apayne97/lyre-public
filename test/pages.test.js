// Static checks on the page HTML (there's no browser in CI): the merged
// Scales page must reference only element ids that exist, and nothing may
// still link to the removed Chords page.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("chords.html is gone and no page links to it", () => {
  assert.equal(fs.existsSync(path.join(root, "chords.html")), false);
  for (const f of ["scales.html", "progressions.html", "index.html"]) {
    assert.ok(!read(f).includes("chords.html"), `${f} still links to chords.html`);
  }
});

test("scales.html only looks up ids that exist in the page", () => {
  const html = read("scales.html");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const script = html.slice(html.indexOf("<script>", html.indexOf("views.js")));
  const wanted = new Set();
  for (const m of script.matchAll(/getElementById\(\s*"([^"]+)"/g)) wanted.add(m[1]);
  // ids listed in the arrays (share ids, change listeners)
  for (const m of script.matchAll(/"([A-Za-z][\w-]*)"/g)) {
    if (/^(root|scale|instrument|show[A-Z]\w*|overlayChord|chord[A-Z]\w*|cat-\w+)$/.test(m[1])) wanted.add(m[1]);
  }
  // The chord builder derives ids from its "chord" prefix.
  for (const n of ["Root", "Quality", "Size", "Seventh", "Alt5", "Alt9", "Alt11", "Alt13", "SeventhWrap", "Alt9Wrap", "Alt11Wrap", "Alt13Wrap"]) wanted.add("chord" + n);
  const missing = [...wanted].filter(i => !ids.has(i));
  assert.deepEqual(missing, []);
});

test("scales.html offers the chord controls the old Chords page had", () => {
  const html = read("scales.html");
  for (const id of ["overlayChord", "chordRoot", "degreeOptions", "showTritoneSub", "showResolution", "showChordEnharmonic", "playChordBtn"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});

test("progressions.html only looks up ids that exist, with the decluttered toolbar", () => {
  const html = read("progressions.html");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const wanted = new Set();
  for (const m of html.matchAll(/getElementById\(\s*"([^"]+)"/g)) wanted.add(m[1]);
  // ids built at runtime by renderStructureNav
  ids.add("expandStructureBtn");
  assert.deepEqual([...wanted].filter(i => !ids.has(i)), []);
  // Five view pills; the retired toggles must not come back as pills.
  const pills = html.slice(html.indexOf('class="filter-panel"'), html.indexOf("</div>", html.indexOf('class="filter-panel"')));
  assert.deepEqual([...pills.matchAll(/type="checkbox" id="(\w+)"/g)].map(m => m[1]),
    ["showChords", "showLyrics", "showNotes", "showNotation", "showPiano"]);
  for (const id of ["editSongBtn", "pianoPanel", "pianoModeTabs"]) assert.ok(ids.has(id), id);
});

// Loads theory.js + songs.js the same way every HTML page does — as
// classic (non-module) scripts sharing one global scope, theory.js first
// since songs.js calls its functions (noteInfoFromName, pitchClassOf, ...).
// Both files are pure logic with no DOM references, so this needs no
// browser stubbing at all.
//
// Node's `vm` module makes a plain object the global object for scripts run
// in it, but only `var`/function declarations attach to that object as
// properties — top-level `const`/`let` live in a separate lexical
// environment that isn't reachable from outside the vm context. So after
// running each file, we run one more tiny script INSIDE the same context
// that copies every top-level `const`/`function` name it declared onto a
// `var __exports` object (itself attachable, since it's `var`) — built by
// regex-scanning the source rather than hand-listing names, so this stays
// in sync automatically as theory.js/songs.js grow.
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const FILES = ["theory.js", "songs.js"];

function topLevelNames(src) {
  const names = [];
  const re = /^(?:const|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.push(m[1]);
  return names;
}

function loadLyre() {
  const context = vm.createContext({ console });
  const allNames = [];
  for (const file of FILES) {
    const src = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
    vm.runInContext(src, context, { filename: file });
    allNames.push(...topLevelNames(src));
  }
  vm.runInContext(`var __exports = { ${allNames.join(", ")} };`, context, { filename: "(export shim)" });
  return context.__exports;
}

// Values returned from `loadLyre()`'s functions were built inside the vm
// context, so arrays/objects among them come from THAT context's own
// Array/Object constructors — a different realm than this test file's.
// assert.deepStrictEqual cares about that (constructor/prototype identity),
// so it fails on cross-realm values even when they're shape-identical.
// Round-tripping through JSON strips the foreign realm and leaves a plain
// value safe to deep-compare.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadLyre, plain };

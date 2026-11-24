// One-way MusicXML import (SDR 0003): reads a score (.musicxml / .xml, or a
// compressed .mxl) and emits TEXT in the songs-file grammar — a "Chords:"
// section and a "Melody:" notation block, see songs.js — for the user to paste
// into a song and hand-edit. Nothing here is stored or rendered; no library,
// no build step. Pure logic apart from the DOMParser / DecompressionStream
// calls, which the browser provides (Node 18+ has both streams and, for tests,
// the tiny fallback XML parser below stands in for DOMParser).
//
// Loaded after songs.js (shares its global scope, same as every other file):
// uses STD_DURATIONS_16THS, parseChordSymbol and parseSongText from there.
//
// What the grammar can't express is NOT dropped silently — every such case
// adds a line to `warnings`, which the UI shows above the output: tuplets and
// other off-grid rhythm, ties across a barline, extra staves/parts, grace
// notes, ornaments, lyrics, repeats, chord slashes, and so on.
//
// Output shape of a bar: ONE legato group with every note/rest pinned, e.g.
//   (E4@1 G4@2.3 [C4,E4]@3 R@4-)
// A legato group stretches each note to meet the next one, and the trailing
// "-" on the last token holds it to the barline (see songs.js), so every
// duration is spelled out and nothing depends on inferred defaults. Two
// notes of the same pitch back to back stay separate attacks (a dash chain
// would merge them into one held note).

// ---------- XML in ----------
// A plain {name, attrs, text, children} tree, built from DOMParser's output
// in the browser or by the tiny parser below elsewhere, so the converter has
// exactly one input shape. Attribute and element names ignore namespaces.

function mxElementToTree(el) {
  const attrs = {};
  for (const a of Array.from(el.attributes || [])) attrs[a.name] = a.value;
  const children = Array.from(el.children || []).map(mxElementToTree);
  return { name: el.localName || el.nodeName, attrs, text: children.length ? "" : (el.textContent || ""), children };
}

const MX_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function mxDecodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return MX_ENTITIES[e] !== undefined ? MX_ENTITIES[e] : whole;
  });
}

// Minimal non-validating XML parser — only used where DOMParser doesn't exist
// (the Node tests). Handles the prolog, DOCTYPE, comments, CDATA, attributes
// and entities; that's all MusicXML needs.
function mxParseXmlFallback(src) {
  const root = { name: "#root", attrs: {}, text: "", children: [] };
  const stack = [root];
  const tag = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = tag.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[6] !== undefined) top.text += mxDecodeEntities(m[6]);
    else if (m[3] !== undefined) {
      if (m[2]) { if (stack.length > 1) stack.pop(); continue; }
      const attrs = {};
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].replace(/^.*:/, "")] = mxDecodeEntities(a[2] !== undefined ? a[2] : a[3]);
      const node = { name: m[3].replace(/^.*:/, ""), attrs, text: "", children: [] };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    }
  }
  if (stack.length !== 1 || root.children.length === 0) throw new Error("The file isn't well-formed XML.");
  return root.children[0];
}

function mxParseXml(text) {
  if (typeof DOMParser === "undefined") return mxParseXmlFallback(text);
  const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length || !doc.documentElement) throw new Error("The file isn't well-formed XML.");
  return mxElementToTree(doc.documentElement);
}

// ---------- .mxl (a zip) in ----------
// A small zip reader: end-of-central-directory -> central directory -> the
// entries' local data, inflated with DecompressionStream("deflate-raw"). If a
// browser lacks that API (pre-2023 Safari), the thrown message tells the
// user to export uncompressed .musicxml from MuseScore instead.

function mxZipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This isn't a valid .mxl (zip) file.");
  const count = dv.getUint16(eocd + 10, true);
  let pos = dv.getUint32(eocd + 16, true);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) throw new Error("The .mxl zip directory is damaged.");
    const nameLen = dv.getUint16(pos + 28, true), extraLen = dv.getUint16(pos + 30, true), commentLen = dv.getUint16(pos + 32, true);
    entries.push({
      flags: dv.getUint16(pos + 8, true),
      method: dv.getUint16(pos + 10, true),
      compressedSize: dv.getUint32(pos + 20, true),
      localOffset: dv.getUint32(pos + 42, true),
      name: new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLen)),
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function mxZipEntryBytes(bytes, entry) {
  if (entry.flags & 1) throw new Error("This .mxl is password-protected.");
  if (entry.compressedSize === 0xFFFFFFFF) throw new Error("Zip64 .mxl files aren't supported.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.localOffset;
  if (dv.getUint32(o, true) !== 0x04034b50) throw new Error("The .mxl zip data is damaged.");
  const start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new Error(`Unsupported zip compression method ${entry.method}.`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser can't unzip .mxl files. In MuseScore use File > Export > MusicXML and choose the uncompressed .musicxml format instead.");
  }
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Bytes of a .mxl -> the root score's XML text. META-INF/container.xml names
// the root file; if it doesn't, fall back to the first non-META-INF .xml.
async function mxlToXmlText(bytes) {
  const entries = mxZipEntries(bytes);
  const byName = name => entries.find(e => e.name === name);
  let rootPath = null;
  const container = byName("META-INF/container.xml");
  if (container) {
    const tree = mxParseXml(new TextDecoder().decode(await mxZipEntryBytes(bytes, container)));
    const rootfiles = [];
    (function walk(n) { if (n.name === "rootfile") rootfiles.push(n); n.children.forEach(walk); })(tree);
    const pick = rootfiles.find(r => !r.attrs["media-type"] || /musicxml/i.test(r.attrs["media-type"])) || rootfiles[0];
    if (pick) rootPath = pick.attrs["full-path"];
  }
  const entry = (rootPath && byName(rootPath)) || entries.find(e => /\.(xml|musicxml)$/i.test(e.name) && !/^META-INF\//i.test(e.name));
  if (!entry) throw new Error("No MusicXML score found inside this .mxl.");
  return new TextDecoder().decode(await mxZipEntryBytes(bytes, entry));
}

// A File/Blob/ArrayBuffer/Uint8Array -> converter result (or {error}).
async function importMusicXml(input) {
  try {
    const buf = input instanceof Uint8Array ? input : new Uint8Array(input.arrayBuffer ? await input.arrayBuffer() : input);
    const isZip = buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b;
    const xml = isZip ? await mxlToXmlText(buf) : new TextDecoder().decode(buf);
    return musicXmlToNotation(mxParseXml(xml));
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

// ---------- Converter ----------
const mxKids = (n, name) => n.children.filter(c => c.name === name);
const mxKid = (n, name) => (n && n.children.find(c => c.name === name)) || null;
const mxText = (n, name) => { const k = mxKid(n, name); return k ? k.text.trim() : null; };
const mxNum = (n, name) => { const t = mxText(n, name); return t === null || t === "" || isNaN(Number(t)) ? null : Number(t); };

// Warnings keyed by kind so "tuplet in bar 3, 4, 9" reads as one line.
function mxWarningSet() {
  const map = new Map();
  return {
    add(key, message, bar) {
      if (!map.has(key)) map.set(key, { message, bars: [] });
      const w = map.get(key);
      if (bar !== undefined && !w.bars.includes(bar)) w.bars.push(bar);
    },
    list() {
      return [...map.values()].map(w => {
        if (!w.bars.length) return w.message;
        const shown = w.bars.slice(0, 8).join(", ") + (w.bars.length > 8 ? ", …" : "");
        return `${w.message} (bar${w.bars.length > 1 ? "s" : ""} ${shown})`;
      });
    },
  };
}

const MX_MAJOR_KEYS = { "-7": "Cb", "-6": "Gb", "-5": "Db", "-4": "Ab", "-3": "Eb", "-2": "Bb", "-1": "F", 0: "C", 1: "G", 2: "D", 3: "A", 4: "E", 5: "B", 6: "F#", 7: "C#" };
const MX_MINOR_KEYS = { "-7": "Ab", "-6": "Eb", "-5": "Bb", "-4": "F", "-3": "C", "-2": "G", "-1": "D", 0: "A", 1: "E", 2: "B", 3: "F#", 4: "C#", 5: "G#", 6: "D#", 7: "A#" };
const MX_STEP_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MX_SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MX_FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// <kind> -> the suffix parseChordSymbol (songs.js) understands. Anything not
// listed falls back to the kind's own `text` attribute, then to a warning.
const MX_CHORD_KINDS = {
  major: "", minor: "m", augmented: "aug", diminished: "dim", dominant: "7",
  "major-seventh": "maj7", "minor-seventh": "m7", "diminished-seventh": "dim7",
  "augmented-seventh": "aug7", "half-diminished": "ø7", "major-minor": "mmaj7",
  "major-sixth": "6", "minor-sixth": "m6",
  "dominant-ninth": "9", "major-ninth": "maj9", "minor-ninth": "m9",
  "dominant-11th": "11", "major-11th": "maj11", "minor-11th": "m11",
  "dominant-13th": "13", "major-13th": "maj13", "minor-13th": "m13",
  "suspended-second": "sus2", "suspended-fourth": "sus4",
};

// A <harmony> element -> chord text ("Cmaj7", "N.C.") or null (dropped), with
// anything lost reported through `warn(message)`.
function mxHarmonyText(h, warn) {
  const kindEl = mxKid(h, "kind");
  const kind = kindEl ? kindEl.text.trim() : "";
  if (kind === "none") return "N.C.";
  const root = mxKid(h, "root");
  if (!root) { warn("a chord without a root note was dropped"); return null; }
  const alter = mxNum(root, "root-alter") || 0;
  if (Math.abs(alter) > 1) { warn("a chord with a double-sharp/flat root was dropped"); return null; }
  const rootName = mxText(root, "root-step") + (alter === 1 ? "#" : alter === -1 ? "b" : "");
  let suffix = kind in MX_CHORD_KINDS ? MX_CHORD_KINDS[kind] : null;
  if (suffix === null && kindEl && kindEl.attrs.text !== undefined) suffix = kindEl.attrs.text;
  if (suffix === null) { warn(`chord kind "${kind}" isn't supported, played as a plain triad`); suffix = ""; }
  let alterations = "";
  for (const d of mxKids(h, "degree")) {
    const value = mxNum(d, "degree-value"), a = mxNum(d, "degree-alter"), type = mxText(d, "degree-type");
    if (type === "subtract" || !a || ![5, 9, 11, 13].includes(value)) { warn("a chord alteration (degree) was dropped"); continue; }
    alterations += (a < 0 ? "b" : "#") + value;
  }
  let text = rootName + suffix + alterations;
  if (!parseChordSymbol(text)) {
    if (alterations) warn(`chord "${text}" can't be written; alterations dropped`);
    text = rootName + suffix;
    if (!parseChordSymbol(text)) { warn(`chord "${text}" can't be written; played as a plain triad`); text = rootName; }
  }
  if (mxKid(h, "bass")) warn("a slash-chord bass note was dropped");
  return text;
}

// One <note>'s pitch -> "C4"/"Bb3"/"F#5". Double accidentals and microtones
// aren't in the grammar, so they're respelled to the nearest chromatic pitch.
function mxPitchName(pitchEl, warn) {
  const step = mxText(pitchEl, "step"), octave = mxNum(pitchEl, "octave");
  const alterRaw = mxNum(pitchEl, "alter") || 0;
  const alter = Math.round(alterRaw);
  if (alter !== alterRaw) warn("microtonal pitch rounded to the nearest semitone");
  if (Math.abs(alter) <= 1) return step + (alter === 1 ? "#" : alter === -1 ? "b" : "") + octave;
  warn("double sharp/flat respelled as its enharmonic");
  const midi = MX_STEP_SEMITONE[step] + alter + 12 * (octave + 1);
  const name = (alter > 0 ? MX_SHARP_NAMES : MX_FLAT_NAMES)[((midi % 12) + 12) % 12];
  return name + (Math.floor(midi / 12) - 1);
}

const mxPin = pos => { const beat = Math.floor(pos / 4) + 1, sub = pos % 4; return sub === 0 ? `@${beat}` : `@${beat}.${sub + 1}`; };

// Events of one voice in one bar -> contiguous segments {pos, dur, pitches}
// (pitches null = rest) covering the whole bar, every duration a standard
// note value. Same-pitch ties inside the bar merge; anything that can't be a
// single standard value is split into separate attacks and reported.
function mxBarSegments(events, barLen, shift, warn) {
  const sorted = events.map(e => ({ ...e, s: e.s + shift, e: Math.min(e.e + shift, barLen) })).filter(e => e.s < barLen && e.e > e.s).sort((a, b) => a.s - b.s);
  const segs = [];
  let at = 0;
  for (const ev of sorted) {
    const s = Math.max(ev.s, at);
    if (ev.e <= s) continue;
    if (s > at) segs.push({ s: at, e: s, pitches: null });
    segs.push({ s, e: ev.e, pitches: ev.pitches, tieStart: ev.tieStart, tieStop: ev.tieStop });
    at = ev.e;
  }
  if (at < barLen) segs.push({ s: at, e: barLen, pitches: null });

  const merged = [];
  for (const seg of segs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.pitches && seg.pitches && prev.tieStart && seg.tieStop && prev.pitches.join() === seg.pitches.join()) {
      prev.e = seg.e; prev.tieStart = seg.tieStart;
    } else merged.push({ ...seg });
  }

  const std = [...new Set([...STD_DURATIONS_16THS, barLen])].filter(d => d <= barLen).sort((a, b) => b - a);
  const out = [];
  for (const seg of merged) {
    let pos = seg.s;
    const total = seg.e - seg.s;
    if (!std.includes(total) && seg.pitches) warn("a note whose length isn't a single standard note value was split into separate notes");
    while (pos < seg.e) {
      const dur = std.find(d => d <= seg.e - pos);
      out.push({ pos, dur, pitches: seg.pitches, tieStart: seg.tieStart, tieStop: seg.tieStop });
      pos += dur;
    }
  }
  return out;
}

function musicXmlToNotation(root) {
  if (root.name === "score-timewise") return { error: "This is a timewise MusicXML file. Re-export it as partwise (MuseScore's default) and import that." };
  if (root.name !== "score-partwise") return { error: "This doesn't look like a MusicXML score." };
  const W = mxWarningSet();
  const parts = mxKids(root, "part");
  if (parts.length === 0) return { error: "The score has no parts." };

  const partNames = {};
  const partList = mxKid(root, "part-list");
  if (partList) for (const sp of mxKids(partList, "score-part")) partNames[sp.attrs.id] = mxText(sp, "part-name") || "";
  if (parts.length > 1) {
    const skipped = parts.slice(1).map(p => partNames[p.attrs.id] || p.attrs.id).join(", ");
    W.add("parts", `The score has ${parts.length} parts: only the first (${partNames[parts[0].attrs.id] || parts[0].attrs.id || "unnamed"}) was imported, skipped ${skipped}`);
  }

  let divisions = 1, beats = null, beatType = 4, keyFifths = null, keyMode = "major", bpm = null;
  const measures = mxKids(parts[0], "measure");
  const voiceBars = new Map(); // voice id -> array (per measure) of segments
  const chordBars = [];
  const pendingTie = new Map(); // voice -> pitch key of a note tied out of the previous bar
  let barLen = null;
  let hasLyrics = false;

  measures.forEach((m, mi) => {
    const barNo = m.attrs.number || String(mi + 1);
    let cursor = 0, maxCursor = 0, last = null, irregular = false;
    const raw = new Map();
    const harmonies = [];
    const toUnits = x => { const v = x * 4 / divisions; const r = Math.round(v); if (Math.abs(v - r) > 1e-6) irregular = true; return r; };

    for (const el of m.children) {
      if (el.name === "attributes") {
        const d = mxNum(el, "divisions"); if (d) divisions = d;
        const time = mxKid(el, "time");
        if (time) {
          const nb = mxNum(time, "beats"), bt = mxNum(time, "beat-type");
          if (nb && bt) {
            if (beats === null) { beats = nb; beatType = bt; }
            else if (nb !== beats || bt !== beatType) W.add("timechange", "The time signature changes mid-score; the song has one Beats value, so only the first is used", barNo);
          }
        }
        const key = mxKid(el, "key");
        if (key && mxNum(key, "fifths") !== null) {
          const f = mxNum(key, "fifths"), mode = mxText(key, "mode") || "major";
          if (keyFifths === null) { keyFifths = f; keyMode = mode; }
          else if (f !== keyFifths) W.add("keychange", "The key changes mid-score; only the first key signature is used", barNo);
        }
        if ((mxNum(el, "staves") || 1) > 1) W.add("staves", "The part has more than one staff: only staff 1 was imported");
        if (mxKid(el, "transpose")) W.add("transpose", "The part is a transposing instrument; pitches are imported as written, not concert pitch");
      } else if (el.name === "harmony") {
        harmonies.push({ start: cursor, el });
      } else if (el.name === "backup") {
        cursor -= mxNum(el, "duration") || 0;
      } else if (el.name === "forward") {
        cursor += mxNum(el, "duration") || 0;
        maxCursor = Math.max(maxCursor, cursor);
      } else if (el.name === "barline") {
        if (mxKid(el, "repeat") || mxKid(el, "ending")) W.add("repeats", "Repeat signs or endings are present: the score was imported once as written, not expanded");
      } else if (el.name === "sound" || el.name === "direction") {
        const snd = el.name === "sound" ? el : mxKid(el, "sound");
        if (snd) {
          if (bpm === null && snd.attrs.tempo) bpm = Math.round(Number(snd.attrs.tempo));
          if (["dacapo", "dalsegno", "tocoda", "fine"].some(a => snd.attrs[a] !== undefined)) W.add("jumps", "D.C./D.S./coda jumps are present and were not followed", barNo);
        }
      } else if (el.name === "note") {
        const dur = mxNum(el, "duration") || 0;
        const isChord = !!mxKid(el, "chord");
        const start = isChord && last ? last.startDiv : cursor;
        if (!isChord) { cursor += dur; maxCursor = Math.max(maxCursor, cursor); }
        if (mxKid(el, "grace")) { W.add("grace", "Grace notes were dropped", barNo); last = null; continue; }
        if ((mxNum(el, "staff") || 1) !== 1) { W.add("staves", "The part has more than one staff: only staff 1 was imported"); last = null; continue; }
        if (mxKid(el, "lyric")) hasLyrics = true;
        if (mxKid(el, "time-modification")) W.add("tuplets", "Tuplets can't be written: their notes were rounded to the nearest 16th", barNo);
        const notations = mxKids(el, "notations");
        if (notations.some(n => mxKid(n, "ornaments"))) W.add("ornaments", "Ornaments (trills, mordents, turns…) were dropped", barNo);
        const voice = mxText(el, "voice") || "1";
        if (!raw.has(voice)) raw.set(voice, []);
        if (isChord && last && last.voice === voice && last.ev.pitches) {
          if (mxKid(el, "pitch")) last.ev.pitches.push(mxPitchName(mxKid(el, "pitch"), msg => W.add("pitchfix:" + msg, `Note spelling: ${msg}`, barNo)));
          continue;
        }
        const ev = { start, startDiv: start, durDiv: dur, pitches: null, tieStart: false, tieStop: false };
        if (mxKid(el, "pitch")) ev.pitches = [mxPitchName(mxKid(el, "pitch"), msg => W.add("pitchfix:" + msg, `Note spelling: ${msg}`, barNo))];
        else if (mxKid(el, "unpitched")) W.add("unpitched", "Unpitched (percussion) notes were treated as rests", barNo);
        for (const t of mxKids(el, "tie")) { if (t.attrs.type === "start") ev.tieStart = true; if (t.attrs.type === "stop") ev.tieStop = true; }
        raw.get(voice).push(ev);
        last = { voice, ev, startDiv: start };
      }
    }

    if (barLen === null) {
      if (beats === null) { beats = 4; beatType = 4; W.add("notime", "The score has no time signature; 4/4 was assumed"); }
      const quarters = beats * 4 / beatType;
      if (!Number.isInteger(quarters)) return;
      barLen = quarters * 4;
    }
    const measureUnits = toUnits(maxCursor);
    const isPickup = mi === 0 && measureUnits > 0 && measureUnits < barLen;
    const shift = isPickup ? barLen - measureUnits : 0;
    if (isPickup) W.add("pickup", "The score starts with a pickup (partial) bar: it was padded with a leading rest to a full bar", barNo);
    if (measureUnits > barLen) W.add("overfull", "A bar is longer than the time signature: its overflow was cut off", barNo);

    for (const [voice, events] of raw) {
      const evs = events.map(ev => ({ s: toUnits(ev.start), e: toUnits(ev.start + ev.durDiv), pitches: ev.pitches, tieStart: ev.tieStart, tieStop: ev.tieStop }));
      if (!voiceBars.has(voice)) voiceBars.set(voice, []);
      const segs = mxBarSegments(evs, barLen, shift, msg => W.add("split", `Note lengths: ${msg}`, barNo));
      voiceBars.get(voice)[mi] = segs;
      // A tie into the next bar can't be written (nothing sustains across "|"): the next bar re-attacks.
      const prevKey = pendingTie.get(voice);
      const first = segs[0];
      if (prevKey && first && first.pitches && first.tieStop && first.pitches.join() === prevKey) W.add("tiebar", "A note is tied across a barline; it is re-attacked in the next bar instead", barNo);
      const lastSeg = segs[segs.length - 1];
      if (lastSeg && lastSeg.pitches && lastSeg.tieStart) pendingTie.set(voice, lastSeg.pitches.join()); else pendingTie.delete(voice);
    }
    if (irregular) W.add("tuplets", "Tuplets can't be written: their notes were rounded to the nearest 16th", barNo);

    const chords = [];
    for (const h of harmonies) {
      const text = mxHarmonyText(h.el, msg => W.add("chord:" + msg, `Chord symbols: ${msg}`, barNo));
      if (text) chords.push({ pos: Math.min(toUnits(h.start) + shift, barLen - 1), text });
    }
    chordBars[mi] = chords;
  });

  if (barLen === null) return { error: `This time signature (${beats}/${beatType}) can't be written: the grammar counts whole quarter-note beats per bar.` };
  if (beatType !== 4) W.add("meter", `The ${beats}/${beatType} time signature was imported as ${barLen / 4} quarter-note beats per bar`);
  if (hasLyrics) W.add("lyrics", "Lyrics under the notes were dropped");

  // ----- text out -----
  const lines = [];
  const chordRows = [];
  let heldChord = null; // last chord text, for bars with no <harmony> of their own
  if (chordBars.some(c => c && c.length)) {
    const bars = measures.map((_, mi) => {
      const chords = (chordBars[mi] || []).sort((a, b) => a.pos - b.pos).filter((c, i, arr) => !arr[i + 1] || arr[i + 1].pos !== c.pos);
      if (chords.length === 0) return { hold: true, text: heldChord || "N.C." };
      if (chords[0].pos > 0 && heldChord) chords.unshift({ pos: 0, text: heldChord }); // the previous chord still sounds until the first new one
      heldChord = chords[chords.length - 1].text;
      return { text: chords.map((c, i) => c.text === "N.C." ? "N.C." : i === 0 && c.pos === 0 ? c.text : c.text + mxPin(c.pos)).join(" ") };
    });
    // A bare "-" holds the previous bar's chord but can't start a row (each
    // row restarts), so a row's first bar spells its chord out instead.
    for (let i = 0; i < bars.length; i += 4) chordRows.push(bars.slice(i, i + 4).map((b, k) => b.hold && k > 0 && b.text !== "N.C." ? "-" : b.text).join(" | "));
    lines.push("Chords:", ...chordRows, "");
  }

  const voiceIds = [...voiceBars.keys()].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  if (voiceIds.length) {
    lines.push("Melody:");
    const keyName = keyFifths === null ? null : (keyMode === "minor" ? MX_MINOR_KEYS[keyFifths] + "m" : MX_MAJOR_KEYS[keyFifths]);
    if (keyName && keyName !== "C") lines.push(`Key: ${keyName}`);
    for (const v of voiceIds) {
      const bars = measures.map((_, mi) => {
        const segs = (voiceBars.get(v)[mi]) || [{ pos: 0, dur: barLen, pitches: null }];
        const toks = segs.map(s => (s.pitches === null ? "R" : s.pitches.length === 1 ? s.pitches[0] : `[${[...new Set(s.pitches)].join(",")}]`) + mxPin(s.pos));
        toks[toks.length - 1] += "-";
        return "(" + toks.join(" ") + ")";
      });
      lines.push("- " + bars.join(" | "));
    }
  } else {
    W.add("nonotes", "The first part has no notes, so there is no melody block");
  }

  const text = lines.join("\n").trim();
  const warnings = W.list();

  // Safety net: the emitted text must parse with the app's own parser.
  if (typeof parseSongText === "function") {
    const parsed = parseSongText(`Title: check\nBeats: ${barLen / 4}\n\n${text}`);
    if (parsed.error) warnings.unshift(`The generated text did not parse (${parsed.error}). Please report this file.`);
  }

  const title = mxText(mxKid(root, "work"), "work-title") || mxText(root, "movement-title") || "";
  const ident = mxKid(root, "identification");
  const composer = ident ? (mxKids(ident, "creator").find(c => c.attrs.type === "composer") || { text: "" }).text.trim() : "";
  const header = {
    title, artist: composer, beats: barLen / 4, bpm,
    originalKey: keyFifths === null ? null : (keyMode === "minor" ? MX_MINOR_KEYS[keyFifths] + "m" : MX_MAJOR_KEYS[keyFifths]),
  };
  return { text, warnings, header, bars: measures.length };
}

// The song-file header lines for an import (what a fresh song needs on top).
function musicXmlHeaderText(header) {
  const lines = [`Title: ${header.title || "Imported score"}`, `Artist: ${header.artist || "Unknown"}`, `Beats: ${header.beats}`];
  if (header.bpm) lines.push(`BPM: ${header.bpm}`);
  return lines.join("\n");
}

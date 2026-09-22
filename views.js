// Shared rendering for the circle / fretboard / piano / notation views.
// Every render function takes (rootName, tones, toneIdx) where `tones` is
// the {interval, letterStep}[] shape produced by buildChord() or
// buildScale(), and `toneIdx` is tones.map(t => (rootIdx + t.interval) % 12)
// — the pitch classes, used for membership checks and interval coloring.
// Used by both chords.html and scales.html so the two pages stay visually
// consistent and a fix here applies everywhere at once.

// ---------- Shared chord-builder control wiring ----------
// Powers the compositional chord builder (quality -> size -> 7th type ->
// 9th/11th/13th alterations, plus an independent 5th override) — used both
// by the Chords page's own builder and the Scales page's "overlay a chord"
// builder, which are the exact same five dependent <select>s under
// different id prefixes ("" for Chords' plain ids like "quality", "chord"
// for Scales' prefixed ones like "chordQuality"). Handles: populating the
// root select, populating the 9th/11th/13th alteration options, keeping
// the 7th-type options in sync with quality, toggling the 9th/11th/13th
// rows' visibility by size, and firing `onChange` (the page's own
// render()) whenever any of these controls change — the caller still
// wires its own other controls (instrument, show/hide toggles, etc).
function wireChordBuilder(prefix, onChange) {
  const id = (name) => prefix ? prefix + name : name.charAt(0).toLowerCase() + name.slice(1);
  const field = (name) => document.getElementById(id(name));

  function setOptions(select, options) {
    select.innerHTML = "";
    for (const [value, text] of options) {
      const opt = document.createElement("option");
      opt.value = value; opt.textContent = text;
      select.appendChild(opt);
    }
  }

  function updateSeventhOptions() {
    const quality = field("Quality").value;
    const sel = field("Seventh");
    const prev = sel.value;
    setOptions(sel, SEVENTH_OPTIONS[quality].map(s => [s.key, s.qualityWord]));
    if (SEVENTH_OPTIONS[quality].some(s => s.key === prev)) sel.value = prev;
  }

  function updateVisibility() {
    const sizeIdx = SIZE_ORDER.indexOf(field("Size").value);
    field("SeventhWrap").classList.toggle("hidden", sizeIdx < 1);
    field("Alt9Wrap").classList.toggle("hidden", sizeIdx < 2);
    field("Alt11Wrap").classList.toggle("hidden", sizeIdx < 3);
    field("Alt13Wrap").classList.toggle("hidden", sizeIdx < 4);
  }

  const rootSel = field("Root");
  for (const n of ROOT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    rootSel.appendChild(opt);
  }
  rootSel.value = "C";

  for (const num of [9, 11, 13]) {
    setOptions(field(`Alt${num}`), [
      ["omit", "Omit"], ["b", `♭${num}`], ["nat", `${num}`], ["s", `♯${num}`],
    ]);
    field(`Alt${num}`).value = "nat";
  }
  updateSeventhOptions();
  updateVisibility();

  field("Quality").addEventListener("change", () => { updateSeventhOptions(); onChange(); });
  field("Size").addEventListener("change", () => { updateVisibility(); onChange(); });
  ["Root", "Alt5", "Seventh", "Alt9", "Alt11", "Alt13"].forEach(name => {
    field(name).addEventListener("change", onChange);
  });
}

// ---------- Audio (Web Audio API, no assets) ----------
// One shared AudioContext, created lazily on first play (browsers block
// audio before a user gesture, and a button click satisfies that). iOS in
// particular can leave the context suspended (e.g. after the tab loses
// focus, or across a looped playback's background-scheduled notes) without
// resuming itself, so we defensively resume on every call.
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Playback is scheduled entirely up front — a whole chord/scale/song's
// worth of oscillators get created and given start/stop times the moment
// play begins, not incrementally as playback progresses. So "stop" can't
// just mean "don't schedule anything else": all those already-scheduled
// oscillators (and the setTimeouts used for beat-synced UI updates, e.g.
// the Progressions page's chord highlighting) need to be forcibly cut off
// too, or they keep sounding/firing on their original schedule regardless
// of the stop button. registerOscillator/stopAllNotes and
// scheduleTimeout/clearAllTimeouts below track everything so
// makeLoopController's stop() can cancel it all immediately.
let activeOscillators = [];
function registerOscillator(osc) {
  activeOscillators.push(osc);
  osc.addEventListener("ended", () => {
    activeOscillators = activeOscillators.filter(o => o !== osc);
  });
}
function stopAllNotes() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  activeOscillators.forEach(osc => {
    try { osc.stop(now); } catch (e) { /* already stopped/ended */ }
  });
  activeOscillators = [];
}

let pendingTimeouts = [];
function scheduleTimeout(fn, ms) {
  const id = setTimeout(() => {
    pendingTimeouts = pendingTimeouts.filter(t => t !== id);
    fn();
  }, ms);
  pendingTimeouts.push(id);
  return id;
}
function clearAllTimeouts() {
  pendingTimeouts.forEach(id => clearTimeout(id));
  pendingTimeouts = [];
}

function playNote(ctx, freq, startTime, duration, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  registerOscillator(osc);
}

// Root's own octave chosen so a plain triad sits comfortably mid-keyboard.
function freqsFor(rootName, tones) {
  const rootInfo = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(rootInfo.letter, rootInfo.acc);
  const rootMidi = 60 + rootPC;
  return tones.map(t => 440 * Math.pow(2, (rootMidi + t.interval - 69) / 12));
}

// Chords: arpeggiate through the tones, then play them together as a block
// — a block chord is the whole point of a chord. `rate` is a speed
// multiplier from the tempo slider (1 = normal, <1 slower, >1 faster).
// Returns the total duration scheduled (seconds), so a caller looping this
// knows when to fire the next pass.
function playTones(rootName, tones, rate) {
  const ctx = getAudioCtx();
  const freqs = freqsFor(rootName, tones);

  const arpGap = 0.5 / rate, arpLen = 0.85 / rate;
  const chordStart = ctx.currentTime + tones.length * arpGap + 0.2;
  const chordLen = 2.2 / rate;

  freqs.forEach((freq, i) => {
    playNote(ctx, freq, ctx.currentTime + i * arpGap, arpLen, 0.18);
    playNote(ctx, freq, chordStart, chordLen, 0.12);
  });

  return tones.length * arpGap + 0.2 + chordLen + 0.4;
}

// Scales: run up through the tones then back down (skipping the repeated
// top note) — no block chord, that's just noise for a 6-15 note scale.
// Returns the total duration scheduled (seconds).
function playScale(rootName, tones, rate) {
  const ctx = getAudioCtx();
  const up = freqsFor(rootName, tones);
  const down = up.slice(0, -1).reverse();
  const sequence = up.concat(down);

  const gap = 0.28 / rate, len = 0.5 / rate;
  sequence.forEach((freq, i) => {
    playNote(ctx, freq, ctx.currentTime + i * gap, len, 0.15);
  });

  return sequence.length * gap + 0.4;
}

// ---------- Looping playback ----------
// Wraps a play function (playTones/playScale) so a button can toggle
// repeat-until-stopped. `getArgs()` is re-called before every pass, so
// changing the root/quality/scale mid-loop takes effect on the next
// repeat rather than requiring a stop/restart.
function makeLoopController(playFn) {
  let timeoutId = null;
  let playing = false;
  function step(getArgs) {
    if (!playing) return;
    const duration = playFn(...getArgs());
    timeoutId = setTimeout(() => step(getArgs), duration * 1000);
  }
  return {
    isPlaying() { return playing; },
    start(getArgs) {
      if (playing) return;
      playing = true;
      step(getArgs);
    },
    stop() {
      playing = false;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      stopAllNotes();
      clearAllTimeouts();
    },
  };
}

const NOTE_LABELS = [
  ["C"], ["C#", "Db"], ["D"], ["D#", "Eb"], ["E"], ["F"],
  ["F#", "Gb"], ["G"], ["G#", "Ab"], ["A"], ["A#", "Bb"], ["B"]
];

const ns = "http://www.w3.org/2000/svg";
function el(tag, attrs) {
  const e = document.createElementNS(ns, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// Color for tone i: root is neutral, every other tone is colored by the
// interval it forms with the tone below it (a 3rd for chords, a step for
// scales — whatever the actual adjacent relationship is).
function toneColor(toneIdx, i) {
  if (i === 0) return "var(--dot)";
  const diff = ((toneIdx[i] - toneIdx[i - 1]) % 12 + 12) % 12;
  return intervalStyle(diff).color;
}

// ---------- Circle view ----------
const CX = 300, CY = 300, R = 220, LABEL_R = 262, NODE_R = 10, BULGE = 60;

function pointFor(i) {
  const angle = (-90 + i * 30) * Math.PI / 180;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
}

function arcPath(p1, p2) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = mx - CX, dy = my - CY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const cx = mx + (dx / dist) * BULGE;
  const cy = my + (dy / dist) * BULGE;
  return `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
}

// Draws the arcs/lines for one tone set. `weight` is "bold" (full color,
// thick) or "faint" (thin, translucent) — used to layer a persistent scale
// underneath a chord without the two competing for attention.
function drawArcs(svg, idx, enabledCategories, weight) {
  for (let i = 0; i < idx.length; i++) {
    for (let j = i + 1; j < idx.length; j++) {
      const semis = ((idx[j] - idx[i]) % 12 + 12) % 12;
      const style = intervalStyle(semis);
      if (!style.category || !enabledCategories.has(style.category)) continue;
      if (style.category === "thirds" && j !== i + 1) continue;
      const p1 = pointFor(idx[i]), p2 = pointFor(idx[j]);
      svg.appendChild(el("path", {
        d: style.curved ? arcPath(p1, p2) : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        fill: "none", stroke: style.color, "stroke-width": weight === "bold" ? 4 : 2,
        opacity: weight === "bold" ? 1 : 0.35,
      }));
    }
  }
}

// `backgroundToneIdx`, if given, is a persistent set (e.g. a scale) drawn
// underneath `toneIdx` (e.g. a chord): its own step-arcs show faintly, and
// its dots read as four states — size flags "in the scale or chord at all",
// then: solid black = in both; gray with a black outline = in the chord but
// chromatic to the scale (flagged, not affirmed); slate blue, no outline =
// in the scale only; small gray = in neither. With no backgroundToneIdx
// (plain chord/scale view, no overlay), chord tones are just solid black.
function renderCircle(toneIdx, enabledCategories, backgroundToneIdx) {
  const svg = document.getElementById("wheel");
  svg.innerHTML = "";

  svg.appendChild(el("circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: "var(--ink)", "stroke-width": 3 }));

  if (backgroundToneIdx) drawArcs(svg, backgroundToneIdx, enabledCategories, "faint");
  drawArcs(svg, toneIdx, enabledCategories, "bold");

  for (let i = 0; i < 12; i++) {
    const p = pointFor(i);
    const inChord = toneIdx.includes(i);
    const inScale = !!backgroundToneIdx && backgroundToneIdx.includes(i);
    const inEither = inChord || inScale;

    const attrs = { cx: p.x, cy: p.y };
    if (inChord && inScale) {
      // In both — the strongest signal, solid black, same as an ordinary
      // chord tone with no scale context.
      attrs.r = NODE_R + 3;
      attrs.fill = "var(--ink)";
    } else if (inChord && backgroundToneIdx) {
      // In the chord but chromatic to the scale — outlined, not filled
      // black, so it reads as "flagged" rather than fully affirmed.
      attrs.r = NODE_R + 3;
      attrs.fill = "var(--ink-muted)";
      attrs.stroke = "var(--ink)";
      attrs["stroke-width"] = 3;
    } else if (inChord) {
      attrs.r = NODE_R + 3;
      attrs.fill = "var(--ink)";
    } else if (inScale) {
      attrs.r = NODE_R + 3;
      attrs.fill = "var(--scale-accent)";
    } else {
      attrs.r = NODE_R - 3;
      attrs.fill = "var(--ink-muted)";
    }
    svg.appendChild(el("circle", attrs));

    const angle = (-90 + i * 30) * Math.PI / 180;
    const lx = CX + LABEL_R * Math.cos(angle), ly = CY + LABEL_R * Math.sin(angle);
    const text = el("text", {
      x: lx, y: ly, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": inEither ? 24 : 20, "font-weight": inEither ? "800" : "600",
      fill: inEither ? "var(--ink)" : "var(--ink-faint)",
    });
    text.textContent = NOTE_LABELS[i].join("/");
    svg.appendChild(text);
  }
}

// ---------- Fretboard view (vertical, like a real chord chart) ----------
// Both tunings listed low string first (left edge of the diagram). Fret
// counts are each tuning's minimum-for-full-chromatic-coverage plus one
// fret of margin: guitar (mostly 4ths, one 3rd between G and B) needs 0-3,
// bass (straight 4ths) needs 0-4.
const INSTRUMENTS = {
  guitar: { label: "Guitar", stringPCs: [4, 9, 2, 7, 11, 4], stringLabels: ["E", "A", "D", "G", "B", "E"], frets: 4 },
  bass:   { label: "Bass",   stringPCs: [4, 9, 2, 7],        stringLabels: ["E", "A", "D", "G"],          frets: 5 },
};
const FB_NUT_Y = 90, FB_FRET_SPACING = 50, FB_STRING_X0 = 55, FB_STRING_SPACING = 55, FB_DOT_R = 16;

// Fret f's dot sits in the middle of its cell, including a virtual "open
// string" cell above the nut so fret 0 lines up the same way as the rest.
function fbDotY(f) {
  return f === 0 ? FB_NUT_Y - FB_FRET_SPACING / 2 : FB_NUT_Y + (f - 0.5) * FB_FRET_SPACING;
}

function renderFretboard(rootName, tones, toneIdx) {
  const instrument = INSTRUMENTS[document.getElementById("instrument").value];
  const { stringPCs, stringLabels, frets } = instrument;
  const numStrings = stringPCs.length;

  const svg = document.getElementById("fret");
  svg.innerHTML = "";
  const width = FB_STRING_X0 * 2 + (numStrings - 1) * FB_STRING_SPACING;
  const height = FB_NUT_Y + frets * FB_FRET_SPACING + 30;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const lineStartY = FB_NUT_Y - FB_FRET_SPACING;
  for (let s = 0; s < numStrings; s++) {
    const x = FB_STRING_X0 + s * FB_STRING_SPACING;
    svg.appendChild(el("text", {
      x, y: lineStartY - 18, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": 22, "font-weight": 800, fill: "var(--ink)",
    })).textContent = stringLabels[s];
    svg.appendChild(el("line", {
      x1: x, y1: lineStartY, x2: x, y2: FB_NUT_Y + frets * FB_FRET_SPACING,
      stroke: "var(--ink)", "stroke-width": 2,
    }));
  }

  const lastX = FB_STRING_X0 + (numStrings - 1) * FB_STRING_SPACING;
  svg.appendChild(el("line", {
    x1: FB_STRING_X0 - 10, y1: FB_NUT_Y, x2: lastX + 10, y2: FB_NUT_Y,
    stroke: "var(--ink)", "stroke-width": 5,
  }));
  for (let f = 1; f <= frets; f++) {
    const y = FB_NUT_Y + f * FB_FRET_SPACING;
    svg.appendChild(el("line", {
      x1: FB_STRING_X0 - 10, y1: y, x2: lastX + 10, y2: y,
      stroke: "var(--ink)", "stroke-width": 2,
    }));
  }

  // Spelling per tone (index in toneIdx -> letter/accidental), same
  // convention as the notation view, so labels agree across views.
  const spellings = tones.map(t => spellDegree(rootName, t.interval, t.letterStep));

  for (let s = 0; s < numStrings; s++) {
    const x = FB_STRING_X0 + s * FB_STRING_SPACING;
    for (let f = 0; f <= frets; f++) {
      const pc = (stringPCs[s] + f) % 12;
      const idx = toneIdx.indexOf(pc);
      if (idx === -1) continue;
      const y = fbDotY(f);
      svg.appendChild(el("circle", { cx: x, cy: y, r: FB_DOT_R, fill: toneColor(toneIdx, idx) }));
      const spelled = spellings[idx];
      const label = spelled.letter + accidentalSymbolFor(spelled.acc);
      svg.appendChild(el("text", {
        x, y: y + 5, "text-anchor": "middle", "font-size": label.length > 1 ? 12 : 14,
        "font-weight": 700, fill: "#fff",
      })).textContent = label;
    }
  }
}

// ---------- Piano view (2 octaves from root, each tone at its true absolute
// offset — a 9th sits a full octave above where a 2nd would, not on top of it) ----------
const WHITE_PC_SET = new Set([0, 2, 4, 5, 7, 9, 11]);
// Covers up to a #13 (22 semitones above root) with a couple keys of margin.
const PIANO_SPAN = 24;
const PIANO_WW = 42, PIANO_WH = 170, PIANO_BW = 26, PIANO_BH = 105;

// Lay out PIANO_SPAN consecutive semitones starting at the root's own pitch
// class (so the root is always the leftmost key, whatever note it is) using
// the real, fixed white/black pattern — always 14 white + 10 black over 2
// full octaves, regardless of where in the pattern the root falls.
function buildPianoKeys(rootPC) {
  const whites = [], blacks = [];
  let whiteCount = 0;
  for (let offset = 0; offset < PIANO_SPAN; offset++) {
    const pc = (rootPC + offset) % 12;
    if (WHITE_PC_SET.has(pc)) {
      whites.push({ offset, xi: whiteCount });
      whiteCount++;
    } else {
      blacks.push({ offset, afterXi: whiteCount - 1 });
    }
  }
  return { whites, blacks, whiteCount };
}

function renderPiano(rootName, tones, toneIdx) {
  const rootInfo = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(rootInfo.letter, rootInfo.acc);
  const { whites, blacks, whiteCount } = buildPianoKeys(rootPC);

  // A black key at either end of the span (root is a black key, or the top
  // key lands on one) sticks out half a black-key-width past the white
  // keys' bounding box — pad both sides so it doesn't get clipped.
  const MARGIN = PIANO_BW / 2;

  const svg = document.getElementById("piano");
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${whiteCount * PIANO_WW + 2 * MARGIN} ${PIANO_WH}`);

  const spellings = tones.map(t => spellDegree(rootName, t.interval, t.letterStep));
  const idxByOffset = new Map(tones.map((t, i) => [t.interval, i]));
  const labelFor = offset => {
    const idx = idxByOffset.get(offset);
    if (idx === undefined) return null;
    const spelled = spellings[idx];
    return { text: spelled.letter + accidentalSymbolFor(spelled.acc), color: toneColor(toneIdx, idx) };
  };

  for (const { offset, xi } of whites) {
    const x = xi * PIANO_WW + MARGIN;
    const label = labelFor(offset);
    svg.appendChild(el("rect", {
      x, y: 0, width: PIANO_WW, height: PIANO_WH, fill: label ? label.color : "var(--paper)",
      stroke: "#000", "stroke-width": 2,
    }));
    if (label) {
      svg.appendChild(el("text", {
        x: x + PIANO_WW / 2, y: PIANO_WH - 20, "text-anchor": "middle", "font-size": 14,
        "font-weight": 700, fill: "#fff",
      })).textContent = label.text;
    }
  }

  for (const { offset, afterXi } of blacks) {
    const x = (afterXi + 1) * PIANO_WW - PIANO_BW / 2 + MARGIN;
    const label = labelFor(offset);
    svg.appendChild(el("rect", {
      x, y: 0, width: PIANO_BW, height: PIANO_BH, fill: label ? label.color : "var(--paper-key-off)",
      stroke: "#000", "stroke-width": 2,
    }));
    if (label) {
      svg.appendChild(el("text", {
        x: x + PIANO_BW / 2, y: PIANO_BH - 14, "text-anchor": "middle", "font-size": 11,
        "font-weight": 700, fill: "#fff",
      })).textContent = label.text;
    }
  }
}

// ---------- Voiced piano view (Progressions page) ----------
// Unlike renderPiano above (root-relative window, every occurrence of
// each tone highlighted — a reference/theory view), this shows ONE
// specific jazz-style voicing on a FIXED keyboard window that doesn't
// move chord to chord, with each voice picking whichever octave keeps it
// closest to where it sat in the PREVIOUS chord — so consecutive chords
// read as small, natural hand movements instead of the window jumping to
// a new root-relative position every time.
const PIANO_VOICED_MIN_MIDI = 40, PIANO_VOICED_MAX_MIDI = 88; // E2..E6, generous headroom either side
const PIANO_VOICE_LH_DEFAULT = 48; // C3 — first chord's bass note, absent any previous voicing
const PIANO_VOICE_RH_DEFAULT = 64; // E4 — first chord's first right-hand tone

function nearestOctaveMidi(pc, refMidi) {
  const base = refMidi - (((refMidi - pc) % 12) + 12) % 12;
  const up = base + 12;
  return Math.abs(base - refMidi) <= Math.abs(up - refMidi) ? base : up;
}

// Among several candidate previous notes, connects to whichever one is
// PITCH-CLASS-nearest to the target — not necessarily "the same chord
// degree as before" (e.g. a chord's 3rd and the next chord's 7th can be
// the exact same note) — so genuinely shared tones land with zero
// movement instead of each nominal voice being pinned to its own
// separate octave history.
function nearestAmong(pc, refs, fallback) {
  if (refs.length === 0) return nearestOctaveMidi(pc, fallback);
  let bestCandidate = null, bestDist = Infinity;
  for (const ref of refs) {
    const candidate = nearestOctaveMidi(pc, ref);
    const dist = Math.abs(candidate - ref);
    if (dist < bestDist) { bestDist = dist; bestCandidate = candidate; }
  }
  return bestCandidate;
}

// `prevVoicing` is `{ midiByIndex }` from the previous call (or
// null/undefined for the first chord of a progression). Returns the new
// `{ midiByIndex }` — the caller threads it into the next call.
function voiceChordJazz(tones, rootPC, prevVoicing) {
  const prev = (prevVoicing && prevVoicing.midiByIndex) || [];
  const prevRH = prev.slice(1).filter(m => m !== undefined);

  const midiByIndex = [];
  // Left hand: the root alone, low register.
  midiByIndex.push(nearestOctaveMidi(rootPC, prev[0] !== undefined ? prev[0] : PIANO_VOICE_LH_DEFAULT));
  // Right hand: everything else, each connecting to the pitch-class-
  // nearest previous RH note (falling back to chaining off whichever RH
  // tone was just placed for THIS chord, when there's no previous chord
  // at all yet — e.g. the very first chord of a progression).
  for (let i = 1; i < tones.length; i++) {
    const pc = (rootPC + tones[i].interval) % 12;
    const refs = prevRH.length > 0 ? prevRH : midiByIndex.slice(1);
    const fallback = midiByIndex.length > 1 ? midiByIndex[midiByIndex.length - 1] : PIANO_VOICE_RH_DEFAULT;
    midiByIndex.push(nearestAmong(pc, refs, fallback));
  }
  return { midiByIndex };
}

function buildPianoKeysAbs(minMidi, maxMidi) {
  const whites = [], blacks = [];
  let whiteCount = 0;
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const pc = ((midi % 12) + 12) % 12;
    if (WHITE_PC_SET.has(pc)) {
      whites.push({ midi, xi: whiteCount });
      whiteCount++;
    } else {
      blacks.push({ midi, afterXi: whiteCount - 1 });
    }
  }
  return { whites, blacks, whiteCount };
}

// Returns the new voicing (`{ midiByIndex }`) so the caller can pass it
// back in as `prevVoicing` on the next call, threading voice-leading
// state across a whole progression.
function renderPianoVoiced(rootName, tones, toneIdx, prevVoicing) {
  const rootInfo = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(rootInfo.letter, rootInfo.acc);
  const voicing = voiceChordJazz(tones, rootPC, prevVoicing);

  const { whites, blacks, whiteCount } = buildPianoKeysAbs(PIANO_VOICED_MIN_MIDI, PIANO_VOICED_MAX_MIDI);
  const MARGIN = PIANO_BW / 2;

  const svg = document.getElementById("piano");
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${whiteCount * PIANO_WW + 2 * MARGIN} ${PIANO_WH}`);

  const spellings = tones.map(t => spellDegree(rootName, t.interval, t.letterStep));
  const toneIdxByMidi = new Map(voicing.midiByIndex.map((m, i) => [m, i]));
  const labelFor = midi => {
    const i = toneIdxByMidi.get(midi);
    if (i === undefined) return null;
    const spelled = spellings[i];
    return { text: spelled.letter + accidentalSymbolFor(spelled.acc), color: toneColor(toneIdx, i) };
  };

  for (const { midi, xi } of whites) {
    const x = xi * PIANO_WW + MARGIN;
    const label = labelFor(midi);
    svg.appendChild(el("rect", {
      x, y: 0, width: PIANO_WW, height: PIANO_WH, fill: label ? label.color : "var(--paper)",
      stroke: "#000", "stroke-width": 2,
    }));
    if (label) {
      svg.appendChild(el("text", {
        x: x + PIANO_WW / 2, y: PIANO_WH - 20, "text-anchor": "middle", "font-size": 14,
        "font-weight": 700, fill: "#fff",
      })).textContent = label.text;
    }
  }

  for (const { midi, afterXi } of blacks) {
    const x = (afterXi + 1) * PIANO_WW - PIANO_BW / 2 + MARGIN;
    const label = labelFor(midi);
    svg.appendChild(el("rect", {
      x, y: 0, width: PIANO_BW, height: PIANO_BH, fill: label ? label.color : "var(--paper-key-off)",
      stroke: "#000", "stroke-width": 2,
    }));
    if (label) {
      svg.appendChild(el("text", {
        x: x + PIANO_BW / 2, y: PIANO_BH - 14, "text-anchor": "middle", "font-size": 11,
        "font-weight": 700, fill: "#fff",
      })).textContent = label.text;
    }
  }

  return voicing;
}

// ---------- Notation view (noteheads only, no rhythm) ----------
const STAFF_TOP_Y = 90, STAFF_LINE_SPACING = 18, STAFF_LINES_X0 = 50, NOTES_X0 = 190;
const E4_STEP = 4 * 7 + LETTERS.indexOf("E"); // reference: bottom line of treble staff

function staffY(halfSpaces) {
  // bottom line (E4, halfSpaces=0) sits at STAFF_TOP_Y + 4*STAFF_LINE_SPACING
  return STAFF_TOP_Y + 4 * STAFF_LINE_SPACING - halfSpaces * (STAFF_LINE_SPACING / 2);
}

function ledgerLinesFor(h) {
  const lines = [];
  if (h < 0) {
    const bottom = h % 2 === 0 ? h : h - 1;
    for (let ls = -2; ls >= bottom; ls -= 2) lines.push(ls);
  } else if (h > 8) {
    const top = h % 2 === 0 ? h : h + 1;
    for (let ls = 10; ls <= top; ls += 2) lines.push(ls);
  }
  return lines;
}

function renderNotation(rootName, tones, toneIdx) {
  const svg = document.getElementById("staff");
  svg.innerHTML = "";

  const spacing = 65;
  const staffX1 = NOTES_X0 + 60 + Math.max(0, tones.length - 1) * spacing;
  svg.setAttribute("viewBox", `0 0 ${staffX1 + 40} 280`);

  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP_Y + i * STAFF_LINE_SPACING;
    svg.appendChild(el("line", { x1: STAFF_LINES_X0, y1: y, x2: staffX1, y2: y, stroke: "var(--ink)", "stroke-width": 2 }));
  }
  svg.appendChild(el("text", {
    x: STAFF_LINES_X0 + 8, y: STAFF_TOP_Y + 3.3 * STAFF_LINE_SPACING, "font-size": 90, fill: "var(--ink)",
  })).textContent = "𝄞"; // treble clef, sitting on the staff lines

  tones.forEach((tone, i) => {
    const x = NOTES_X0 + i * spacing;
    const spelled = spellDegree(rootName, tone.interval, tone.letterStep);
    const octave = 4 + spelled.octaveBump;
    const step = octave * 7 + LETTERS.indexOf(spelled.letter);
    const halfSpaces = step - E4_STEP;
    const y = staffY(halfSpaces);
    const color = toneColor(toneIdx, i);

    for (const ls of ledgerLinesFor(halfSpaces)) {
      const ly = staffY(ls);
      svg.appendChild(el("line", { x1: x - 16, y1: ly, x2: x + 16, y2: ly, stroke: "var(--ink)", "stroke-width": 2 }));
    }

    const symbol = accidentalSymbolFor(spelled.acc);
    if (symbol) {
      svg.appendChild(el("text", {
        x: x - 22, y: y + 7, "text-anchor": "middle", "font-size": 22, fill: color,
      })).textContent = symbol;
    }

    svg.appendChild(el("ellipse", { cx: x, cy: y, rx: 13, ry: 10, fill: color }));
    // Bare letter only — the accidental is already conveyed by the symbol
    // to the left, same as real notation; showing it twice was redundant.
    svg.appendChild(el("text", {
      x, y: y + 4, "text-anchor": "middle", "font-size": 12,
      "font-weight": 700, fill: "#fff",
    })).textContent = spelled.letter;
  });
}

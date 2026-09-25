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
    const sizeVal = field("Size").value;
    const sizeIdx = SIZE_ORDER.indexOf(sizeVal);
    field("SeventhWrap").classList.toggle("hidden", sizeIdx < 1);
    field("Alt9Wrap").classList.toggle("hidden", sizeIdx < 2);
    field("Alt11Wrap").classList.toggle("hidden", sizeIdx < 3);
    field("Alt13Wrap").classList.toggle("hidden", sizeIdx < 4);
    // "Intervals" (chords.html only — scales.html's chord-overlay builder
    // never offers it, hence the optional chaining: no matching wrap
    // there to hide) replaces quality/5th entirely with direct interval
    // picks, so those become meaningless too.
    field("QualityWrap")?.classList.toggle("hidden", sizeVal === "intervals");
    field("Alt5Wrap")?.classList.toggle("hidden", sizeVal === "intervals");
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

// Like playNote, but holds at peak volume until near the very end of
// `duration` instead of decaying continuously from the start. playNote's
// exponential ramp drops most of its audible loudness in the first
// fraction of its own window — fine for the chord/scale views' long fixed
// durations (2+ seconds, plenty of sustain left over even after the early
// drop), but for notation playback, where `duration` IS the actual
// note-value length (a quarter note might be well under a second), that
// same curve made a quarter note sound more like a 16th. Used only by
// playNotationBlock — left playNote itself alone so chord/scale playback
// keeps its existing feel.
function playNotationNote(ctx, freq, startTime, duration, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const attack = 0.015;
  const release = Math.min(0.08, duration * 0.25);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.setValueAtTime(peakGain, startTime + duration - release);
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
// scales — whatever the actual adjacent relationship is). `overrideColors`
// (optional, parallel to the tones array) skips that adjacent-relationship
// math entirely in favor of an explicit per-tone color — used by the
// Chords page's "Intervals" mode (buildIntervalSet's own toneColors),
// where each tone's color means "this exact interval above the ROOT",
// which isn't the same thing once more than one extra tone is selected.
function toneColor(toneIdx, i, overrideColors) {
  if (i === 0) return "var(--dot)";
  if (overrideColors && overrideColors[i]) return overrideColors[i];
  const diff = ((toneIdx[i] - toneIdx[i - 1]) % 12 + 12) % 12;
  return intervalStyle(diff).color;
}

// ---------- Circle view ----------
const CX = 300, CY = 300, R = 220, LABEL_R = 262, NODE_R = 10, BULGE = 60;

function pointFor(i) {
  const angle = (-90 + i * 30) * Math.PI / 180;
  return { x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
}

// How far a curve's control point (and so its peak) gets pushed outward
// from its chord's own midpoint, in the same outward direction for every
// interval. Half step and whole step get a reduced bulge, tuned by ear
// rather than reusing the general BULGE=60: at 60 their peak would land
// past the circle's edge entirely (their chord midpoint already sits close
// to it), so half step is scaled down to just skirt the boundary and whole
// step to land about halfway between its straight chord and the boundary.
function bulgeFor(d) {
  const theta = (d * 30 * Math.PI) / 180;
  const chordMidDist = R * Math.cos(theta / 2);
  if (d === 1) return 2 * (R - 3 - chordMidDist); // half step: hugs just inside the edge
  if (d === 2) return R - chordMidDist; // whole step: peak lands halfway to the edge
  return BULGE;
}

function arcPath(p1, p2, bulge) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = mx - CX, dy = my - CY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const cx = mx + (dx / dist) * bulge;
  const cy = my + (dy / dist) * bulge;
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
      const d = Math.min(semis, 12 - semis);
      svg.appendChild(el("path", {
        d: style.curved ? arcPath(p1, p2, bulgeFor(d)) : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
        fill: "none", stroke: style.color, "stroke-width": weight === "bold" ? 4 : 2,
        opacity: weight === "bold" ? 1 : 0.35,
      }));
    }
  }
}

// Root-relative-only arcs (Chords page's "Intervals" mode) — one line per
// selected tone, from the root straight to it, colored via toneColors
// (buildIntervalSet's own root-relative colors) instead of the general
// pairwise-relationship system every other mode uses — that system draws
// an arc between EVERY pair of selected tones (and, for thirds
// specifically, only between array-adjacent ones — see drawArcs above),
// which is the right picture for "how do this chord's tones relate to
// each other" but the wrong one for "which note is this exact interval
// above the root," the whole point of Intervals mode. No adjacency
// filtering needed since there's only ever one arc per selected tone here.
function drawRootArcs(svg, idx, toneColors) {
  const rootPoint = pointFor(idx[0]);
  for (let i = 1; i < idx.length; i++) {
    const p2 = pointFor(idx[i]);
    const semis = ((idx[i] - idx[0]) % 12 + 12) % 12;
    const curved = intervalStyle(semis).curved;
    const d = Math.min(semis, 12 - semis);
    svg.appendChild(el("path", {
      d: curved ? arcPath(rootPoint, p2, bulgeFor(d)) : `M ${rootPoint.x} ${rootPoint.y} L ${p2.x} ${p2.y}`,
      fill: "none", stroke: toneColors[i], "stroke-width": 4, opacity: 1,
    }));
  }
}

// `backgroundToneIdx`, if given, is a persistent set (e.g. a scale) drawn
// underneath `toneIdx` (e.g. a chord): its own step-arcs show faintly, and
// its dots read as four states — size flags "in the scale or chord at all",
// then: solid black = in both; gray with a black outline = in the chord but
// chromatic to the scale (flagged, not affirmed); slate blue, no outline =
// in the scale only; small gray = in neither. With no backgroundToneIdx
// (plain chord/scale view, no overlay), chord tones are just solid black.
// `toneColors`, if given (Intervals mode only), switches to drawRootArcs
// instead of the normal pairwise system — see its own comment above.
function renderCircle(toneIdx, enabledCategories, backgroundToneIdx, toneColors) {
  const svg = document.getElementById("wheel");
  svg.innerHTML = "";

  svg.appendChild(el("circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: "var(--ink)", "stroke-width": 3 }));

  if (toneColors) {
    drawRootArcs(svg, toneIdx, toneColors);
  } else {
    if (backgroundToneIdx) drawArcs(svg, backgroundToneIdx, enabledCategories, "faint");
    drawArcs(svg, toneIdx, enabledCategories, "bold");
  }

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

function renderFretboard(rootName, tones, toneIdx, toneColors) {
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
      svg.appendChild(el("circle", { cx: x, cy: y, r: FB_DOT_R, fill: toneColor(toneIdx, idx, toneColors) }));
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

function renderPiano(rootName, tones, toneIdx, toneColors) {
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
    return { text: spelled.letter + accidentalSymbolFor(spelled.acc), color: toneColor(toneIdx, idx, toneColors) };
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

// Shared by both fixed-window piano views below (voiced and stacked) —
// draws the keyboard over `[minMidi, maxMidi]` and labels whichever keys
// are in `midiByIndex` (tones[i] sits at midiByIndex[i]).
function drawPianoAbs(minMidi, maxMidi, midiByIndex, spellings, toneIdx) {
  const { whites, blacks, whiteCount } = buildPianoKeysAbs(minMidi, maxMidi);
  const MARGIN = PIANO_BW / 2;

  const svg = document.getElementById("piano");
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${whiteCount * PIANO_WW + 2 * MARGIN} ${PIANO_WH}`);

  const toneIdxByMidi = new Map(midiByIndex.map((m, i) => [m, i]));
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
}

// Returns the new voicing (`{ midiByIndex }`) so the caller can pass it
// back in as `prevVoicing` on the next call, threading voice-leading
// state across a whole progression.
function renderPianoVoiced(rootName, tones, toneIdx, prevVoicing) {
  const rootInfo = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(rootInfo.letter, rootInfo.acc);
  const voicing = voiceChordJazz(tones, rootPC, prevVoicing);
  const spellings = tones.map(t => spellDegree(rootName, t.interval, t.letterStep));
  drawPianoAbs(PIANO_VOICED_MIN_MIDI, PIANO_VOICED_MAX_MIDI, voicing.midiByIndex, spellings, toneIdx);
  return voicing;
}

// ---------- Stacked piano view (Progressions page, current default) ----------
// The same plain full-chord stacking as the Chords page's renderPiano
// (root + every tone at its true absolute interval — a 9th a full octave
// above a 2nd), but on a FIXED keyboard window instead of one that slides
// to sit under a different root every chord. The root always lands
// between A3 and A4 (whichever of those 12 keys matches its pitch class),
// and every other tone stacks upward from there in natural chord order.
const PIANO_STACKED_MIN_MIDI = 52; // E3 — a few keys of headroom below the lowest possible root (A3 = 57)
const PIANO_STACKED_MAX_MIDI = 92; // headroom above the highest possible tone (root G#4=68 plus a #13 = 22, so 90)

function renderPianoStacked(rootName, tones, toneIdx) {
  const rootInfo = noteInfoFromName(rootName);
  const rootPC = pitchClassOf(rootInfo.letter, rootInfo.acc);
  const rootMidi = 57 + ((rootPC - 9 + 12) % 12); // 57 (A3) is pitch class 9 (A); offset up to the root's own pitch class
  const midiByIndex = tones.map(t => rootMidi + t.interval);
  const spellings = tones.map(t => spellDegree(rootName, t.interval, t.letterStep));
  drawPianoAbs(PIANO_STACKED_MIN_MIDI, PIANO_STACKED_MAX_MIDI, midiByIndex, spellings, toneIdx);
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

function renderNotation(rootName, tones, toneIdx, toneColors) {
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
    const color = toneColor(toneIdx, i, toneColors);

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

// ---------- Notation blocks (Progressions' "Melody:"/percussion voices) ----------
// A self-contained figure per block (see songs.js's parseSongSections
// comment) — real rhythm this time, unlike the chord/scale Notation view
// above. Individual flags rather than full beam-grouping across a beat is
// a deliberate simplification (see [[project_lyre_app]]) that keeps this
// small; likewise no bass-clef support (everything's treble, including a
// low counter-melody voice, which just picks up extra ledger lines).

// A chord-symbol event's pitches, spelled the same way the Chords page's
// own Notation tab does — rooted at octave 4 by default.
function chordSymbolPitches(root, chord) {
  const built = buildChord(chord);
  return built.tones.map(t => {
    const spelled = spellDegree(root, t.interval, t.letterStep);
    return { letter: spelled.letter, acc: spelled.acc, octave: 4 + spelled.octaveBump };
  });
}

function eventPitches(ev) {
  if (ev.chordSymbol) return chordSymbolPitches(ev.chordSymbol.root, ev.chordSymbol.chord);
  return ev.pitches || null; // null for a rest
}

function halfSpacesForPitch(letter, octave) {
  return octave * 7 + LETTERS.indexOf(letter) - E4_STEP;
}

// Traditional key signature (see songs.js's "Key:" line / parseKeySignature
// — `count` is +sharps/-flats). Octave per letter matches the real
// traditional treble-clef flat-order zigzag (B4 E5 A4 D5 G4 C5 F4 — each
// alternating up a 4th/down a 5th from the last); reused as-is for the
// sharp order too rather than splitting the table, so G# in a 5+-sharp key
// sits inside the staff (G4) rather than its own traditional above-staff
// spot — a minor simplification for a rare case in lead-sheet keys.
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const KEY_SIG_OCTAVE = { B: 4, E: 5, A: 4, D: 5, G: 4, C: 5, F: 4 };
const KEY_SIG_SPACING = 14;

function keySignatureWidth(count) {
  return count ? Math.abs(count) * KEY_SIG_SPACING + 10 : 0;
}

// The accidental (+1/0/-1) a key signature already implies for a LETTER
// (any octave) — e.g. Cm (-3, i.e. B/E/A flatted) implies -1 for "B". Used
// so a note matching its key signature doesn't redundantly show its own
// accidental too, same as traditional notation.
function keySignatureAccFor(letter, count) {
  if (!count) return 0;
  const order = count > 0 ? SHARP_ORDER : FLAT_ORDER;
  const idx = order.indexOf(letter);
  if (idx === -1 || idx >= Math.abs(count)) return 0;
  return count > 0 ? 1 : -1;
}

function renderKeySignature(svg, x0, topY, count) {
  if (!count) return;
  const order = count > 0 ? SHARP_ORDER : FLAT_ORDER;
  const symbol = count > 0 ? "♯" : "♭";
  let x = x0;
  for (let i = 0; i < Math.abs(count); i++) {
    const halfSpaces = halfSpacesForPitch(order[i], KEY_SIG_OCTAVE[order[i]]);
    const y = topY + 4 * STAFF_LINE_SPACING - halfSpaces * (STAFF_LINE_SPACING / 2);
    svg.appendChild(el("text", { x, y: y + 13, "text-anchor": "middle", "font-size": 42, fill: "var(--ink)" })).textContent = symbol;
    x += KEY_SIG_SPACING;
  }
}

// Duration (16th-note units) -> visual note value.
function noteValueFor(durUnits, beatsPerMeasure) {
  if (durUnits === beatsPerMeasure * 4) return { open: true, stem: false, flags: 0, dot: false };
  return {
    12: { open: true, stem: true, flags: 0, dot: true },
    8: { open: true, stem: true, flags: 0, dot: false },
    6: { open: false, stem: true, flags: 0, dot: true },
    4: { open: false, stem: true, flags: 0, dot: false },
    3: { open: false, stem: true, flags: 1, dot: true },
    2: { open: false, stem: true, flags: 1, dot: false },
    1: { open: false, stem: true, flags: 2, dot: false },
  }[durUnits] || { open: false, stem: true, flags: 0, dot: false };
}

const NOTATION_UNIT_WIDTH = 9; // px per 16th-note unit
const NOTATION_HEAD_RX = 11, NOTATION_HEAD_RY = 9;

// A real traced FILLED-notehead glyph (not a plain ellipse) — CC0, from
// the same Jeramee Sikorski music-vectors set as the rest glyphs, this
// one derived from "Notes 4 Quarter" by dropping its stem: the original
// is one fused notehead+stem outline (`m 2426,865 c 8,771 ... z`), so the
// long near-vertical stem segment at the very start (and its mirror
// closing the path back up to the start point) are cut, and the path is
// re-started where the stem meets the notehead's own curve instead —
// the closing "z" then draws one short straight edge across where the
// stem used to attach, barely visible at notehead size. Natural bounding
// box 721x629 (a genuine slightly-slanted oval, not a true ellipse),
// centered at (2067.5, 2814.5) in its own coordinates — only used for the
// FILLED case (quarter/8th/16th); half/whole notes still use a plain
// hollow ellipse below, since there's no traced open-notehead glyph.
const NOTEHEAD_PATH = "m 2428,2712 c -6,95 -26,109 -63,165 -36,55 -85,106 -143,148 -58,43 -120,75 -184,94 -64,19 -123,22 -176,10 -53,-11 -94,-34 -122,-72 -29,-37 -39,-85 -33,-138 4,-53 26,-109 62,-165 37,-55 84,-107 142,-150 58,-42 121,-74 185,-92 63,-19 124,-22 176,-12 27,7 11,0 90,42 z";

function drawNotehead(svg, x, y, value) {
  if (value.open) {
    svg.appendChild(el("ellipse", {
      cx: x, cy: y, rx: NOTATION_HEAD_RX, ry: NOTATION_HEAD_RY,
      fill: "none", stroke: "var(--ink)", "stroke-width": 2,
      transform: `rotate(-20 ${x} ${y})`,
    }));
  } else {
    const sx = (NOTATION_HEAD_RX * 2) / 721, sy = (NOTATION_HEAD_RY * 2) / 629;
    svg.appendChild(el("path", {
      d: NOTEHEAD_PATH, fill: "var(--ink)",
      transform: `translate(${x} ${y}) scale(${sx} ${sy}) translate(-2067.5 -2814.5)`,
    }));
  }
  if (value.dot) svg.appendChild(el("circle", { cx: x + NOTATION_HEAD_RX + 5, cy: y, r: 2, fill: "var(--ink)" }));
}

// Real traced rest glyphs (not hand-approximated shapes) — CC0, from
// Jeramee Sikorski's music-vectors set (publicdomainvectors.org /
// freesvg.org). Each is given as its raw path `d` plus its own natural
// bounding-box CENTER (in the path's own untransformed coordinates —
// each source file additionally wraps its path in a group transform of
// its own, which is irrelevant here since only the bare `d` is used, not
// that wrapper), so drawRest below can recenter/scale/reposition it to
// sit at whatever (x, midY) a given rest needs via one shared formula:
// translate(x, y) scale(REST_GLYPH_SCALE) translate(-center).
const REST_GLYPH_SCALE = 39 / 2879; // quarter rest's natural height (2879) mapped to ~39 units tall
const REST_GLYPHS = {
  whole: { center: [1941.5, 2553], d: "m 1081,2394 v -142 h 1720 v 142 h -333 v 459 H 1413 v -459 z" },
  half: { center: [1941.5, 2552], d: "m 1081,2710 v 142 H 2801 V 2710 H 2468 V 2251 H 1413 v 459 z" },
  quarter: { center: [2061, 1814.5], d: "m 2467,1086 4,66 c 0,0 -235,354 -307,552 -24,66 -44,137 -41,208 3,79 30,156 62,228 114,176 369,564 369,564 0,0 -181,-64 -274,-83 -34,-7 -69,-15 -103,-12 -37,3 -76,14 -108,33 -53,28 -113,62 -154,195 -9,31 -7,64 -4,96 3,30 12,59 21,87 11,36 24,71 41,104 20,39 100,79 71,112 -42,48 -109,-24 -174,-79 -51,-33 -97,-75 -137,-121 -60,-70 -119,-145 -150,-232 -12,-60 -17,-77 -16,-149 7,-95 -1,-118 20,-171 19,-48 50,-95 92,-124 39,-27 91,-27 137,-37 70,-15 211,-34 211,-34 l -132,-207 c 0,0 -143,-168 -200,-307 -13,-29 -18,-34 -32,-95 -3,-38 -10,-34 -1,-100 11,-64 27,-80 46,-117 36,-71 128,-203 128,-203 0,0 121,-214 150,-332 10,-42 12,-86 8,-129 -5,-48 -37,-141 -37,-141 l -95,-264 41,-18 z" },
  eighth: { center: [1207.5, 1975.5], d: "m 1881,706 c 162,3 158,7 158,7 l -785,2590 h -158 l 616,-2024 c 0,0 -49,46 -77,65 -54,38 -113,70 -173,97 -61,27 -124,50 -189,65 -77,18 -156,29 -235,31 -73,2 -147,0 -219,-16 -72,-13 -145,-24 -258,-96 -49,-31 -111,-100 -142,-165 -37,-82 -50,-177 -42,-266 6,-61 27,-122 61,-173 35,-52 84,-97 139,-127 50,-28 108,-42 165,-46 41,-3 83,5 123,15 48,12 87,32 128,60 25,18 54,38 72,63 21,29 40,60 54,93 13,29 22,60 27,92 6,38 3,77 0,116 -3,36 -15,71 -30,104 -18,38 -41,66 -70,96 -26,28 -81,81 -81,81 l 70,25 156,-20 163,-52 153,-72 169,-127 92,-107 98,-232 z" },
  sixteenth: { center: [1609.5, 1958], d: "m 2542,586 -131,5 c 0,0 -76,239 -153,335 -44,55 -169,127 -169,127 l -153,72 -163,52 c 0,0 -104,25 -156,20 -24,-3 -70,-25 -70,-25 27,-27 55,-53 81,-81 29,-30 52,-58 70,-96 15,-33 27,-68 30,-104 3,-39 6,-78 0,-116 -5,-32 -14,-63 -27,-92 -14,-33 -33,-64 -54,-93 -18,-25 -47,-45 -72,-63 -41,-28 -80,-48 -128,-60 -40,-10 -82,-18 -123,-15 -57,4 -115,18 -165,46 -55,30 -104,75 -139,127 -34,51 -55,112 -61,173 -8,89 5,184 42,266 31,65 93,134 142,165 113,72 186,83 258,96 72,16 146,18 219,16 79,-2 158,-13 235,-31 65,-15 128,-38 189,-65 60,-27 138,-77 192,-115 28,-19 -161,628 -161,628 l -98,102 -169,127 -153,72 -163,52 c 0,0 -104,25 -156,20 -24,-3 -70,-25 -70,-25 27,-27 55,-53 81,-81 29,-30 52,-58 70,-96 15,-33 27,-68 30,-104 3,-39 6,-78 0,-116 -5,-32 -14,-63 -27,-92 -14,-33 -33,-64 -54,-93 -18,-25 -47,-45 -72,-63 -41,-28 -80,-48 -128,-60 -40,-10 -82,-18 -123,-15 -57,4 -115,18 -165,46 -55,30 -104,75 -139,127 -34,51 -55,112 -61,173 -8,89 4,185 42,266 30,66 93,134 142,165 113,72 186,83 258,96 72,16 146,18 219,16 79,-2 158,-13 235,-31 65,-15 128,-38 189,-65 60,-27 144,-57 198,-95 15,-25 -240,845 -374,1367 91,14 86,17 155,7 141,-429 653,-2286 800,-2872 z" },
};

function drawRestGlyph(svg, name, x, y) {
  const g = REST_GLYPHS[name];
  svg.appendChild(el("path", {
    d: g.d, fill: "var(--ink)",
    transform: `translate(${x} ${y}) scale(${REST_GLYPH_SCALE}) translate(${-g.center[0]} ${-g.center[1]})`,
  }));
}

// A rest, shaped by duration the same way a notehead is, using the real
// traced glyphs above. `midY` is the staff's own middle line, the shared
// reference point rests hang from/sit on/center around.
function drawRest(svg, x, midY, value) {
  if (!value.stem && value.open) {
    drawRestGlyph(svg, "whole", x, midY - 15); // hangs below the line just above middle
  } else if (value.open) {
    drawRestGlyph(svg, "half", x, midY - 3); // sits on top of the middle line
  } else if (value.flags === 0) {
    drawRestGlyph(svg, "quarter", x, midY);
  } else {
    drawRestGlyph(svg, value.flags === 1 ? "eighth" : "sixteenth", x, midY);
  }
  if (value.dot) svg.appendChild(el("circle", { cx: x + 14, cy: midY, r: 2, fill: "var(--ink)" }));
}

// yTop/yBottom: the extreme noteheads' y (equal for a single note). Stem
// anchors at whichever end its direction starts from and extends a fixed
// length beyond the other end, with individual flags for 8th/16ths.
function drawStem(svg, x, yTop, yBottom, stemUp, value) {
  if (!value.stem) return;
  const stemLen = 40;
  const stemX = stemUp ? x + NOTATION_HEAD_RX : x - NOTATION_HEAD_RX;
  const anchorY = stemUp ? yBottom : yTop;
  const endY = stemUp ? yTop - stemLen : yBottom + stemLen;
  svg.appendChild(el("line", { x1: stemX, y1: anchorY, x2: stemX, y2: endY, stroke: "var(--ink)", "stroke-width": 3 }));
  // A short, perfectly horizontal, filled rectangle per flag (1 = 8th, 2 =
  // 16th) — a real beam stub's actual shape (sharp square ends), not a
  // thick rounded-cap line. Thick enough to read as clearly bolder than a
  // barline (stroke-width 1.5-4) at a glance. Not connected to a
  // neighboring note (no beam-grouping — see project notes).
  const beamLen = 17, beamThick = 9;
  for (let f = 0; f < value.flags; f++) {
    const fy = endY + (stemUp ? 1 : -1) * f * 12;
    svg.appendChild(el("rect", {
      x: stemX, y: fy - beamThick / 2, width: beamLen, height: beamThick, fill: "var(--ink)",
    }));
  }
}

// Time-proportional x for each of `positions` (16th-units, need not be
// sorted/unique) — EXCEPT never closer together than `minGap`, so a dense,
// dash-chained passage (several chord-brackets landing 1-3 sixteenths
// apart) doesn't draw its noteheads on top of each other. This does mean a
// very dense passage reads a bit more evenly-spaced than its actual
// rhythm — a real simplification, but a much smaller problem than
// overlapping noteheads.
function layoutXs(positions, notesX0, minGap) {
  const xMap = new Map();
  let prevX = null;
  for (const pos of [...new Set(positions)].sort((a, b) => a - b)) {
    let x = notesX0 + pos * NOTATION_UNIT_WIDTH;
    if (prevX !== null) x = Math.max(x, prevX + minGap);
    xMap.set(pos, x);
    prevX = x;
  }
  return xMap;
}

// A barline's x — the MIDPOINT between the last note strictly before it
// and the first note at-or-after it, so it's equally clear of whatever's
// on either side (a note starting exactly on a measure boundary used to
// render right on top of the barline — this is the fix for that). Falls
// back to a fixed offset when there's nothing on one side (the very start
// of the staff, or a block that ends right at a barline).
function barlineX(bp, sortedPositions, xMap, notesX0) {
  let beforeX = null, afterX = null;
  for (const p of sortedPositions) {
    if (p < bp) beforeX = xMap.get(p);
    if (p >= bp && afterX === null) afterX = xMap.get(p);
  }
  if (beforeX === null) beforeX = (afterX ?? notesX0) - 24;
  if (afterX === null) afterX = beforeX + 24;
  return (beforeX + afterX) / 2;
}

// Shared staff/clef/key-signature/barline scaffolding for a block's
// combined content — `noteVoices` (each rendered with its own rhythm, but
// see stem-direction below) and `chordVoices` (pure chord-symbol voices,
// always rendered as name labels above the staff, never spelled out — see
// buildNotationBlockEl for how a block's voices get split into these two
// groups). Two or more note-voices share one staff the way real multi-
// voice notation does: the first keeps stems up, every other one stems
// down, so overlapping lines stay visually distinguishable — a single
// note-voice instead falls back to the usual per-note pitch-based stem
// direction. Returns the x just past the last note.
function renderCombinedStaff(svg, noteVoices, chordVoices, beatsPerMeasure, cfg) {
  const allEvents = [...noteVoices.flat(), ...chordVoices.flat()];
  const endPos = Math.max(...allEvents.map(ev => ev.pos + ev.dur));
  const totalMeasures = Math.ceil(endPos / (beatsPerMeasure * 4));
  const barPositions = [0];
  for (let m = 1; m <= totalMeasures; m++) {
    const bp = m * beatsPerMeasure * 4;
    if (bp <= endPos) barPositions.push(bp);
  }

  const minGap = 46;
  const xMap = layoutXs(allEvents.map(ev => ev.pos), cfg.notesX0, minGap);
  const sortedPositions = [...xMap.keys()].sort((a, b) => a - b);
  const x1 = Math.max(...xMap.values(), cfg.notesX0) + 40;

  for (let i = 0; i < 5; i++) {
    const y = cfg.topY + i * STAFF_LINE_SPACING;
    svg.appendChild(el("line", { x1: cfg.x0, y1: y, x2: x1, y2: y, stroke: "var(--ink)", "stroke-width": 2 }));
  }
  if (cfg.drawClef) {
    svg.appendChild(el("text", { x: cfg.x0 + 8, y: cfg.topY + 3.3 * STAFF_LINE_SPACING, "font-size": 118, fill: "var(--ink)" })).textContent = "𝄞";
  }
  if (cfg.keySignature) {
    renderKeySignature(svg, cfg.keySigX0, cfg.topY, cfg.keySignature);
  }

  const staffBottom = cfg.topY + 4 * STAFF_LINE_SPACING;
  for (const bp of barPositions) {
    const bx = barlineX(bp, sortedPositions, xMap, cfg.notesX0);
    svg.appendChild(el("line", { x1: bx, y1: cfg.topY, x2: bx, y2: staffBottom, stroke: "var(--ink)", "stroke-width": bp === 0 ? 4 : 1.5 }));
  }

  chordVoices.forEach(events => {
    events.forEach(ev => {
      const built = buildChord(ev.chordSymbol.chord);
      svg.appendChild(el("text", {
        x: xMap.get(ev.pos), y: cfg.topY - 10, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "var(--ink)",
      })).textContent = `${ev.chordSymbol.root}${built.symbol}`;
    });
  });

  noteVoices.forEach((events, vi) => {
    const forcedStemUp = noteVoices.length > 1 ? vi === 0 : null;
    for (const ev of events) {
      const x = xMap.get(ev.pos);
      const value = noteValueFor(ev.dur, beatsPerMeasure);

      if (!ev.pitches && !ev.chordSymbol) { // a rest
        drawRest(svg, x, cfg.topY + 2 * STAFF_LINE_SPACING, value);
        continue;
      }

      // A chord symbol mixed into an otherwise-melodic voice — labeled
      // above the staff (same "root+symbol" text the chord leadsheet
      // itself uses) rather than spelled out, since mixing spelled chords
      // in with real melody notes reads as clutter.
      if (ev.chordSymbol) {
        const built = buildChord(ev.chordSymbol.chord);
        svg.appendChild(el("text", {
          x, y: cfg.topY - 10, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "var(--ink)",
        })).textContent = `${ev.chordSymbol.root}${built.symbol}`;
        continue;
      }

      const pitches = eventPitches(ev);
      const placed = pitches.map(p => ({ ...p, halfSpaces: halfSpacesForPitch(p.letter, p.octave) }))
        .sort((a, b) => a.halfSpaces - b.halfSpaces);

      // Simple second-collision offset: alternate side when two adjacent
      // noteheads (by pitch) are only a staff-step apart.
      let offsetSide = 1;
      placed.forEach((p, idx) => {
        p.dx = 0;
        if (idx > 0 && Math.abs(p.halfSpaces - placed[idx - 1].halfSpaces) === 1) {
          p.dx = offsetSide * (NOTATION_HEAD_RX * 2 - 1);
          offsetSide = -offsetSide;
        } else {
          offsetSide = 1;
        }
      });

      const allLedgers = new Set();
      placed.forEach(p => ledgerLinesFor(p.halfSpaces).forEach(l => allLedgers.add(l)));
      for (const ls of allLedgers) {
        const ly = cfg.topY + 4 * STAFF_LINE_SPACING - ls * (STAFF_LINE_SPACING / 2);
        svg.appendChild(el("line", { x1: x - 16, y1: ly, x2: x + 16, y2: ly, stroke: "var(--ink)", "stroke-width": 2 }));
      }

      placed.forEach(p => {
        p.y = cfg.topY + 4 * STAFF_LINE_SPACING - p.halfSpaces * (STAFF_LINE_SPACING / 2);
        // Only show an accidental when it differs from what the key
        // signature already implies for this letter — a natural sign when
        // the signature flats/sharps it but this note isn't, the actual
        // symbol for anything else, nothing when they already match.
        const impliedAcc = keySignatureAccFor(p.letter, cfg.keySignature || 0);
        const symbol = p.acc === impliedAcc ? "" : (p.acc === 0 ? "♮" : accidentalSymbolFor(p.acc));
        if (symbol) {
          svg.appendChild(el("text", { x: x + p.dx - 20, y: p.y + 6, "text-anchor": "middle", "font-size": 26, fill: "var(--ink)" })).textContent = symbol;
        }
        drawNotehead(svg, x + p.dx, p.y, value);
      });

      const stemUp = forcedStemUp !== null ? forcedStemUp : placed[0].halfSpaces < 4; // below/at the middle line -> stem up
      drawStem(svg, x, placed[placed.length - 1].y, placed[0].y, stemUp, value);
    }
  });

  return x1;
}

// A percussion block's voice(s) — 1 or 2 (see songs.js), sharing a single
// line instead of a 5-line staff, with `percussionOffset` placing this
// voice's hits on it (0), above it (-1), or below it (+1). No chord
// labels/key signature/clef — percussion hits carry no pitch at all.
function renderPercussionVoice(svg, events, beatsPerMeasure, cfg) {
  const endPos = Math.max(...events.map(ev => ev.pos + ev.dur));
  const totalMeasures = Math.ceil(endPos / (beatsPerMeasure * 4));
  const barPositions = [0];
  for (let m = 1; m <= totalMeasures; m++) {
    const bp = m * beatsPerMeasure * 4;
    if (bp <= endPos) barPositions.push(bp);
  }

  const xMap = layoutXs(events.map(ev => ev.pos), cfg.notesX0, 32);
  const sortedPositions = [...xMap.keys()].sort((a, b) => a - b);
  const x1 = Math.max(...xMap.values(), cfg.notesX0) + 40;

  svg.appendChild(el("line", { x1: cfg.x0, y1: cfg.topY, x2: x1, y2: cfg.topY, stroke: "var(--ink)", "stroke-width": 2 }));
  for (const bp of barPositions) {
    const bx = barlineX(bp, sortedPositions, xMap, cfg.notesX0);
    svg.appendChild(el("line", { x1: bx, y1: cfg.topY - 16, x2: bx, y2: cfg.topY + 16, stroke: "var(--ink)", "stroke-width": bp === 0 ? 4 : 1.5 }));
  }

  for (const ev of events) {
    const x = xMap.get(ev.pos);
    const value = noteValueFor(ev.dur, beatsPerMeasure);
    const y = cfg.topY + cfg.percussionOffset * 16;
    if (!ev.hit) { // a rest — filled in by fillGapsAndCompleteMeasure (see songs.js)
      drawRest(svg, x, y, value);
      continue;
    }
    drawNotehead(svg, x, y, value);
    drawStem(svg, x, y, y, cfg.percussionOffset <= 0, value);
  }

  return x1;
}

// Builds one notation block's whole DOM subtree — title, its own Play
// button (independent of the song's main playback engine — see
// [[project_lyre_app]]), and an svg with every voice stacked.
// A voice's pitch range in half-spaces from E4 (the staff's own bottom
// line=0, top line=8) — used to reserve enough room for THIS voice's own
// ledger lines before starting the next voice, instead of a fixed gap that
// a low counter-melody (lots of ledger lines below the staff) would
// overlap into.
function voiceHalfSpacesRange(events) {
  let min = 0, max = 8;
  events.forEach(ev => {
    (eventPitches(ev) || []).forEach(p => {
      const hs = halfSpacesForPitch(p.letter, p.octave);
      min = Math.min(min, hs);
      max = Math.max(max, hs);
    });
  });
  return { min, max };
}

function buildNotationBlockEl(block, beatsPerMeasure, getBpm) {
  const wrap = document.createElement("div");
  wrap.className = "notation-block";

  const header = document.createElement("div");
  header.className = "notation-block-header";
  const title = document.createElement("span");
  title.className = "notation-block-title";
  title.textContent = block.name || "Notation";
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "notation-block-play";
  playBtn.textContent = "▶";
  playBtn.title = `Play ${block.name || "this"}`;
  playBtn.addEventListener("click", () => playNotationBlock(block, beatsPerMeasure, getBpm()));
  header.append(title, playBtn);
  wrap.appendChild(header);

  const svg = el("svg", {});
  const topPad = 20;
  let maxX = 0, totalHeight;

  if (block.percussion) {
    block.voices.forEach((events, i) => {
      const cfg = {
        topY: topPad, x0: STAFF_LINES_X0, notesX0: STAFF_LINES_X0 + 20,
        percussionOffset: block.voices.length === 1 ? 0 : (i === 0 ? -1 : 1),
      };
      maxX = Math.max(maxX, renderPercussionVoice(svg, events, beatsPerMeasure, cfg));
    });
    totalHeight = topPad + 60;
  } else {
    // A voice that's ENTIRELY chord symbols is a chord label row, not
    // spelled out onto its own staff; every other voice (even if it also
    // has some chord symbols mixed in — see renderCombinedStaff) shares
    // ONE staff together, real multi-voice notation instead of one staff
    // per voice — see the "combine into a single staff" discussion.
    const chordVoices = block.voices.filter(events => events.every(ev => ev.chordSymbol));
    const noteVoices = block.voices.filter(events => !events.every(ev => ev.chordSymbol));
    const range = voiceHalfSpacesRange(noteVoices.flat());
    const topY = topPad + Math.max(0, range.max - 8) * (STAFF_LINE_SPACING / 2) + (chordVoices.length ? 24 : 0);
    const keySigWidth = keySignatureWidth(block.keySignature);
    const cfg = {
      topY, x0: STAFF_LINES_X0, notesX0: STAFF_LINES_X0 + 85 + keySigWidth, drawClef: true,
      keySignature: block.keySignature, keySigX0: STAFF_LINES_X0 + 85,
    };
    maxX = renderCombinedStaff(svg, noteVoices, chordVoices, beatsPerMeasure, cfg);
    totalHeight = topY + 4 * STAFF_LINE_SPACING + Math.max(0, -range.min) * (STAFF_LINE_SPACING / 2) + 30;
  }

  svg.setAttribute("viewBox", `0 0 ${maxX} ${totalHeight}`);
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", totalHeight);
  wrap.appendChild(svg);
  return wrap;
}

// A short, high, percussive "tock" for a percussion-block hit (see
// songs.js — a hit event carries `hit: true`, no pitch at all) — a fixed
// clave-ish pitch with a near-instant attack/decay regardless of the
// hit's own written duration, rather than the sustained-tone envelope a
// real pitch gets.
function playClaveHit(ctx, startTime, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 2500;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.07);
  osc.start(startTime);
  osc.stop(startTime + 0.1);
  registerOscillator(osc);
}

// Plays every voice of one notation block together — independent of the
// song's own chord/lyric playback engine (a deliberate scope cut: this
// isn't synced to the main Play button's timeline, just its own thing).
function playNotationBlock(block, beatsPerMeasure, bpm) {
  const ctx = getAudioCtx();
  const secPerUnit = (60 / bpm) / 4; // a beat (quarter) = 4 units
  const startTime = ctx.currentTime + 0.05;
  block.voices.forEach(events => {
    events.forEach(ev => {
      if (ev.hit) { playClaveHit(ctx, startTime + ev.pos * secPerUnit, 0.2); return; }
      const pitches = eventPitches(ev);
      if (!pitches) return; // rest
      // A chord symbol (spelled out or labeled — see renderCombinedStaff)
      // always sounds as a quarter-note-length hit regardless of its
      // written duration, rather than being held for a whole measure —
      // reads more like a comping stab than an oddly long sustained
      // block chord.
      const dur = (ev.chordSymbol ? 4 : ev.dur) * secPerUnit * 0.9;
      pitches.forEach(p => {
        const freq = 440 * Math.pow(2, (midiFromPitch(p.letter, p.acc, p.octave) - 69) / 12);
        playNotationNote(ctx, freq, startTime + ev.pos * secPerUnit, dur, 0.15);
      });
    });
  });

  // Same click/toggle as the main chord-chart playback (see playProgression)
  // — reuses playClick and the #metronome checkbox rather than its own.
  if (document.getElementById("metronome").checked) {
    const allEvents = block.voices.flat();
    const endPos = Math.max(...allEvents.map(ev => ev.pos + ev.dur));
    const totalBeats = Math.ceil(endPos / 4);
    for (let b = 0; b < totalBeats; b++) {
      playClick(ctx, startTime + b * secPerUnit * 4, b % beatsPerMeasure === 0);
    }
  }
}

// Renders every notation block in `container` (a flex row — see style.css),
// or hides it entirely when the song has none.
function renderNotationBlocks(container, notationBlocks, beatsPerMeasure, getBpm) {
  container.innerHTML = "";
  if (!notationBlocks || notationBlocks.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  notationBlocks.forEach(block => container.appendChild(buildNotationBlockEl(block, beatsPerMeasure, getBpm)));
}

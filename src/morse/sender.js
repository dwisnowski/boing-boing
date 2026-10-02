/**
 * Builds timed key-down / key-up schedules for a phrase so it can be played
 * back (heard and watched) at a chosen speed, timing, fist and cadence.
 */

import { MORSE_CODES } from "./tree.js";

export const SPEEDS = [5, 10, 13, 15, 18, 20, 25, 30];
export const CHAR_SPEEDS = [18, 20];

export const TIMINGS = [
  { id: "standard", label: "standard", title: "PARIS timing: 1-3-7 unit spacing" },
  { id: "farnsworth", label: "farnsworth", title: "Fast characters, stretched gaps" },
];

export const FISTS = [
  { id: "iambic", label: "iambic", title: "Iambic paddle: machine-perfect" },
  { id: "bug", label: "bug", title: "Semi-automatic bug: crisp dits, long hand-made dahs" },
  { id: "straight", label: "straight", title: "Straight key: human swing and jitter" },
];

export const CADENCES = [
  { id: "plain", label: "plain", title: "As written" },
  { id: "ragchew", label: "ragchew", title: "Grouped repeats, pauses before DE and around BT" },
  { id: "contest", label: "contest", title: "Cut numbers (9→N, 0→T, 1→A) and tight spacing" },
  { id: "signoff", label: "sign-off", title: "Adds the traditional dit dit after SK" },
];

/**
 * @typedef {{
 *   wpm: number,
 *   timing: "standard" | "farnsworth",
 *   charWpm: number,
 *   fist: "iambic" | "bug" | "straight",
 *   cadence: "plain" | "ragchew" | "contest" | "signoff",
 *   loop: boolean,
 *   autoListen: boolean,
 * }} ListenSettings
 */

/** @type {ListenSettings} */
export const DEFAULT_LISTEN_SETTINGS = {
  wpm: 13,
  timing: "standard",
  charWpm: 18,
  fist: "iambic",
  cadence: "plain",
  loop: false,
  autoListen: false,
};

/**
 * @typedef {{ start: number, end: number, kind: "dot" | "dash" }} ElementSpan
 * @typedef {{
 *   wordIndex: number,
 *   charIndex: number,
 *   token: string,
 *   start: number,
 *   end: number,
 *   elements: ElementSpan[],
 * }} CharSpan
 * @typedef {{
 *   t: number,
 *   type: "down" | "up",
 *   wordIndex: number,
 *   charIndex: number,
 *   token: string,
 *   element: number,
 * }} KeyEvent
 * @typedef {{
 *   words: string[][],
 *   events: KeyEvent[],
 *   chars: CharSpan[],
 *   totalMs: number,
 *   unitMs: number,
 * }} Schedule
 */

const CUT_NUMBERS = { 9: "N", 0: "T", 1: "A" };

function seededRandom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rewrite the phrase for a cadence. `gapScale[i]` scales the word gap after word i.
 * @param {string[][]} words
 * @param {ListenSettings["cadence"]} cadence
 */
export function applyCadence(words, cadence) {
  let out = words.map((w) => w.slice());
  if (cadence === "contest") {
    out = out.map((w) => w.map((t) => CUT_NUMBERS[t] || t));
  }
  if (cadence === "signoff") {
    const last = out[out.length - 1];
    if (last && last[last.length - 1] === "<SK>") out.push(["E"], ["E"]);
  }

  const gapScale = out.map(() => 1);
  for (let i = 0; i < out.length - 1; i++) {
    const cur = out[i].join("");
    const next = out[i + 1].join("");
    if (cadence === "contest") gapScale[i] = 0.7;
    if (cadence === "ragchew") {
      if (cur === next) gapScale[i] = 0.75;
      if (next === "DE") gapScale[i] = 1.6;
      if (cur === "<BT>" || next === "<BT>") gapScale[i] = 1.8;
    }
    if (cadence === "signoff" && next === "E" && cur !== "E") gapScale[i] = 2;
  }
  return { words: out, gapScale };
}

/**
 * @param {string[][]} words tokens per word (from `tokenize`)
 * @param {ListenSettings} settings
 * @returns {Schedule}
 */
export function buildSchedule(words, settings) {
  const { words: shaped, gapScale } = applyCadence(words, settings.cadence);
  const farnsworth = settings.timing === "farnsworth" && settings.wpm < settings.charWpm;
  const charWpm = farnsworth ? settings.charWpm : settings.wpm;
  const unit = 1200 / charWpm;

  let charGap = unit * 3;
  let wordGap = unit * 7;
  if (farnsworth) {
    const c = settings.charWpm;
    const s = settings.wpm;
    const ta = ((60 * c - 37.2 * s) / (s * c)) * 1000;
    charGap = (3 * ta) / 19;
    wordGap = (7 * ta) / 19;
  }

  const rand = seededRandom(shaped.map((w) => w.join("")).join(" "));
  const jitter = (amount) => 1 + (rand() * 2 - 1) * amount;
  const fist = settings.fist;

  const elementMs = (kind) => {
    if (fist === "bug") return kind === "dash" ? unit * (3.6 + rand() * 0.4) : unit;
    if (fist === "straight") return kind === "dash" ? unit * 3.25 * jitter(0.12) : unit * jitter(0.12);
    return kind === "dash" ? unit * 3 : unit;
  };
  const intraMs = (prevKind) => {
    if (fist === "straight") return unit * jitter(0.12) * (prevKind === "dash" ? 0.88 : 1);
    return unit;
  };
  const charGapMs = () => {
    if (fist === "bug") return charGap * 1.1 * jitter(0.05);
    if (fist === "straight") return charGap * jitter(0.12);
    return charGap;
  };
  const wordGapMs = (scale) => {
    const base = Math.max(charGap, wordGap * scale);
    return fist === "straight" ? base * jitter(0.1) : base;
  };

  /** @type {KeyEvent[]} */
  const events = [];
  /** @type {CharSpan[]} */
  const chars = [];
  let t = 0;

  shaped.forEach((word, wordIndex) => {
    word.forEach((token, charIndex) => {
      const code = MORSE_CODES[token] || "";
      /** @type {CharSpan} */
      const span = { wordIndex, charIndex, token, start: t, end: t, elements: [] };
      for (let e = 0; e < code.length; e++) {
        const kind = code[e] === "-" ? "dash" : "dot";
        const dur = elementMs(kind);
        events.push({ t, type: "down", wordIndex, charIndex, token, element: e });
        events.push({ t: t + dur, type: "up", wordIndex, charIndex, token, element: e });
        span.elements.push({ start: t, end: t + dur, kind });
        t += dur;
        if (e < code.length - 1) t += intraMs(kind);
      }
      span.end = t;
      chars.push(span);
      if (charIndex < word.length - 1) t += charGapMs();
    });
    if (wordIndex < shaped.length - 1) t += wordGapMs(gapScale[wordIndex]);
  });

  return { words: shaped, events, chars, totalMs: t, unitMs: unit };
}

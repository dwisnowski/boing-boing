/**
 * Timing decoder: press duration → dit/dah; letter/word gaps commit text.
 */

import { BRANCH_DASH, BRANCH_DOT } from "./tree.js";

/** @typedef {{ unitMs: number, ditThresholdMs: number, letterGapMs: number, wordGapMs: number }} TimingConfig */

/**
 * @param {Partial<TimingConfig>} [overrides]
 * @returns {TimingConfig}
 */
export function defaultTiming(overrides = {}) {
  const unitMs = overrides.unitMs ?? 90;
  return {
    unitMs,
    // Presses shorter than this are dits; longer are dahs.
    ditThresholdMs: overrides.ditThresholdMs ?? unitMs * 2.4,
    // Forgiving gaps so on-screen Dit/Dah taps can form multi-element letters.
    letterGapMs: overrides.letterGapMs ?? Math.max(900, unitMs * 9),
    wordGapMs: overrides.wordGapMs ?? Math.max(2200, unitMs * 22),
  };
}

/**
 * @param {{
 *   onElement: (branch: "dash"|"dot", durationMs: number) => void,
 *   onLetterGap: () => void,
 *   onWordGap: () => void,
 *   timing?: Partial<TimingConfig>,
 * }} opts
 */
export function createDecoder(opts) {
  let timing = defaultTiming(opts.timing);
  let keyDownAt = 0;
  let keyed = false;
  let lastUpAt = 0;
  let hasPending = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let letterTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let wordTimer = null;
  const ditSamples = [];

  function clearTimers() {
    if (letterTimer) {
      clearTimeout(letterTimer);
      letterTimer = null;
    }
    if (wordTimer) {
      clearTimeout(wordTimer);
      wordTimer = null;
    }
  }

  function scheduleGaps() {
    clearTimers();
    if (!hasPending) return;
    letterTimer = setTimeout(() => {
      letterTimer = null;
      hasPending = false;
      opts.onLetterGap();
      wordTimer = setTimeout(() => {
        wordTimer = null;
        opts.onWordGap();
      }, Math.max(0, timing.wordGapMs - timing.letterGapMs));
    }, timing.letterGapMs);
  }

  function adaptUnit(durationMs, branch) {
    if (branch === BRANCH_DOT && durationMs > 20 && durationMs < 250) {
      ditSamples.push(durationMs);
      if (ditSamples.length > 8) ditSamples.shift();
      const avg =
        ditSamples.reduce((a, b) => a + b, 0) / ditSamples.length;
      timing = defaultTiming({
        unitMs: Math.max(45, Math.min(140, avg)),
      });
    }
  }

  function keyDown(now = performance.now()) {
    clearTimers();
    keyed = true;
    keyDownAt = now;
  }

  function keyUp(now = performance.now()) {
    if (!keyed) return null;
    keyed = false;
    const durationMs = Math.max(1, now - keyDownAt);
    lastUpAt = now;
    const branch =
      durationMs < timing.ditThresholdMs ? BRANCH_DOT : BRANCH_DASH;
    adaptUnit(durationMs, branch);
    hasPending = true;
    opts.onElement(branch, durationMs);
    scheduleGaps();
    return { branch, durationMs };
  }

  function forceCommitLetter() {
    clearTimers();
    if (hasPending) {
      hasPending = false;
      opts.onLetterGap();
    }
  }

  /** Arm letter/word gap timers after an externally applied element. */
  function armGaps() {
    hasPending = true;
    scheduleGaps();
  }

  function reset() {
    clearTimers();
    keyed = false;
    hasPending = false;
    keyDownAt = 0;
    lastUpAt = 0;
  }

  function getTiming() {
    return { ...timing };
  }

  function isKeyDown() {
    return keyed;
  }

  return {
    keyDown,
    keyUp,
    forceCommitLetter,
    armGaps,
    reset,
    getTiming,
    isKeyDown,
    clearTimers,
  };
}

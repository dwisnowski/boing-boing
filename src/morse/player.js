/**
 * Plays a phrase schedule: CW tone, lit LED path per element, character
 * callbacks for highlighting, and a frame callback for the rhythm strip.
 */

import { buildSchedule } from "./sender.js";
import { MORSE_CODES, MORSE_ROOT, pathIdsTo, step } from "./tree.js";

const LOOP_PAUSE_MS = 1500;
const DEFAULT_SEGMENT_MS = 260;

/** @param {string} token @param {number} elementCount */
function prefixPath(token, elementCount) {
  const code = MORSE_CODES[token] || "";
  let node = MORSE_ROOT;
  for (let i = 0; i < elementCount && i < code.length; i++) {
    const next = step(node, code[i] === "-" ? "dash" : "dot");
    if (!next) break;
    node = next;
  }
  return node === MORSE_ROOT ? null : node;
}

/**
 * @typedef {import("./sender.js").Schedule} Schedule
 * @typedef {import("./sender.js").CharSpan} CharSpan
 * @typedef {{
 *   onStart?: (schedule: Schedule) => void,
 *   onChar?: (span: CharSpan | null) => void,
 *   onFrame?: (ms: number, schedule: Schedule) => void,
 *   onDone?: (stopped: boolean) => void,
 *   shouldLoop?: () => boolean,
 * }} PlayHandlers
 */

/**
 * @param {{
 *   toneOn: () => void,
 *   toneOff: () => void,
 *   showPath: (ids: string[], currentId: string) => void,
 *   clearPath: () => void,
 *   setSegmentMs: (ms: number) => void,
 *   setLocked: (locked: boolean) => void,
 *   onChar?: (span: CharSpan | null) => void,
 * }} io
 */
export function createPlayer(io) {
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  let raf = 0;
  let playing = false;
  let startedAt = 0;
  /** @type {Schedule | null} */
  let schedule = null;
  /** @type {PlayHandlers} */
  let handlers = {};

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function at(ms, fn) {
    timers.push(setTimeout(fn, Math.max(0, ms)));
  }

  function frame() {
    if (!playing || !schedule) return;
    handlers.onFrame?.(performance.now() - startedAt, schedule);
    raf = requestAnimationFrame(frame);
  }

  function runOnce() {
    if (!schedule) return;
    const sched = schedule;
    startedAt = performance.now();
    handlers.onStart?.(sched);

    for (const ev of sched.events) {
      at(ev.t, () => {
        if (!playing) return;
        if (ev.type === "down") {
          io.toneOn();
          const node = prefixPath(ev.token, ev.element + 1);
          if (node) io.showPath(pathIdsTo(node), node.id);
        } else {
          io.toneOff();
        }
      });
    }

    sched.chars.forEach((span, i) => {
      at(span.start, () => {
        if (!playing) return;
        io.onChar?.(span);
        handlers.onChar?.(span);
      });
      const next = sched.chars[i + 1];
      const hold = next ? Math.min(350, (next.start - span.end) * 0.7) : 350;
      at(span.end + hold, () => {
        if (!playing) return;
        io.clearPath();
        if (!next || next.wordIndex !== span.wordIndex) {
          io.onChar?.(null);
          handlers.onChar?.(null);
        }
      });
    });

    at(sched.totalMs + 380, () => {
      if (!playing) return;
      handlers.onFrame?.(sched.totalMs, sched);
      if (handlers.shouldLoop?.()) {
        at(LOOP_PAUSE_MS, () => playing && runOnce());
      } else {
        finish(false);
      }
    });

    if (!raf) raf = requestAnimationFrame(frame);
  }

  function finish(stopped) {
    const wasPlaying = playing;
    playing = false;
    clearTimers();
    io.toneOff();
    io.clearPath();
    io.setSegmentMs(DEFAULT_SEGMENT_MS);
    io.setLocked(false);
    io.onChar?.(null);
    if (wasPlaying) {
      handlers.onChar?.(null);
      handlers.onDone?.(stopped);
    }
  }

  /**
   * @param {string[][]} words
   * @param {import("./sender.js").ListenSettings} settings
   * @param {PlayHandlers} [nextHandlers]
   * @returns {Schedule}
   */
  function play(words, settings, nextHandlers = {}) {
    stop();
    handlers = nextHandlers;
    schedule = buildSchedule(words, settings);
    playing = true;
    io.setLocked(true);
    io.setSegmentMs(Math.min(DEFAULT_SEGMENT_MS, Math.max(40, schedule.unitMs)));
    runOnce();
    return schedule;
  }

  function stop() {
    if (playing) finish(true);
  }

  return {
    play,
    stop,
    isPlaying: () => playing,
  };
}

/**
 * Draw the phrase timeline: dits green, dahs red, gaps to scale, playhead gold.
 * @param {HTMLCanvasElement} canvas
 * @param {Schedule | null} schedule
 * @param {number} playheadMs negative to hide the playhead; Infinity draws it fully lit with no playhead
 */
export function drawRhythmStrip(canvas, schedule, playheadMs = -1) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cssW = canvas.clientWidth || 300;
  const cssH = canvas.clientHeight || 56;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (!schedule || schedule.totalMs <= 0) return;

  const padX = 6;
  const w = cssW - padX * 2;
  const xFor = (ms) => padX + (ms / schedule.totalMs) * w;
  const barTop = 8;
  const barH = Math.max(10, cssH * 0.34);
  const labelY = barTop + barH + 6;

  ctx.strokeStyle = "rgba(214, 199, 161, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, barTop + barH / 2);
  ctx.lineTo(padX + w, barTop + barH / 2);
  ctx.stroke();

  ctx.font = '700 10px "IBM Plex Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let lastLabelRight = -Infinity;

  for (let i = 0; i < schedule.chars.length; i++) {
    const span = schedule.chars[i];
    const active = playheadMs >= span.start && playheadMs <= span.end;
    const done = playheadMs > span.end;
    if (active) {
      ctx.fillStyle = "rgba(255, 212, 90, 0.12)";
      ctx.fillRect(xFor(span.start) - 2, barTop - 4, xFor(span.end) - xFor(span.start) + 4, barH + 8);
    }
    for (const el of span.elements) {
      const x = xFor(el.start);
      const bw = Math.max(1.5, xFor(el.end) - x);
      const lit = playheadMs >= el.start;
      if (el.kind === "dash") ctx.fillStyle = lit ? "#ff6a52" : "rgba(224, 85, 68, 0.55)";
      else ctx.fillStyle = lit ? "#5dff96" : "rgba(61, 204, 110, 0.55)";
      ctx.fillRect(x, barTop, bw, barH);
    }
    const prev = schedule.chars[i - 1];
    if (prev && prev.wordIndex !== span.wordIndex) {
      const gx = xFor((prev.end + span.start) / 2);
      ctx.strokeStyle = "rgba(214, 199, 161, 0.3)";
      ctx.beginPath();
      ctx.moveTo(gx, barTop - 4);
      ctx.lineTo(gx, labelY + 10);
      ctx.stroke();
    }
    const cx = (xFor(span.start) + xFor(span.end)) / 2;
    const label = span.token.replace(/[<>]/g, "");
    const half = ctx.measureText(label).width / 2;
    if (cx - half >= lastLabelRight + 1) {
      ctx.fillStyle = active ? "#ffd45a" : done ? "#f6f1e1" : "rgba(214, 199, 161, 0.5)";
      ctx.fillText(label, cx, labelY);
      lastLabelRight = cx + half;
    }
  }

  if (playheadMs >= 0 && Number.isFinite(playheadMs)) {
    const x = xFor(Math.min(playheadMs, schedule.totalMs));
    ctx.strokeStyle = "#ffd45a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x, cssH - 2);
    ctx.stroke();
  }
}

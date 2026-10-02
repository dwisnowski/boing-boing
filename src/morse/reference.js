/**
 * Quick-reference code chart (letters, digits, prosigns) with live highlights
 * for the character being keyed, played, or expected next.
 */

import { drawRhythmStrip } from "./player.js";
import { MORSE_CODES } from "./tree.js";

const KINDS = ["keyed", "playing", "expected"];

const GROUPS = [
  { title: "Letters", rows: 13, tokens: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") },
  { title: "Digits", rows: 5, tokens: "1234567890".split("") },
  { title: "Prosigns", rows: 2, tokens: ["<AR>", "<BT>", "<KN>", "<SK>"] },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** @param {string} token */
function glyphsFor(token) {
  const glyphs = el("span", "ref-glyphs");
  glyphs.setAttribute("aria-label", MORSE_CODES[token].replace(/-/g, " dah").replace(/\./g, " dit").trim());
  for (const c of MORSE_CODES[token]) glyphs.appendChild(el("span", c === "-" ? "ref-dah" : "ref-dit"));
  return glyphs;
}

/** @param {string} token */
function charFor(token) {
  const id = token.replace(/[<>]/g, "");
  const ch = el("span", "ref-char", id === "0" ? "Ø" : id);
  if (id.length > 1) ch.classList.add("ch-prosign");
  return ch;
}

/**
 * @param {HTMLElement} root
 * @param {{ onPick?: (token: string) => void }} [opts]
 */
export function createReference(root, opts = {}) {
  /** @type {Map<string, HTMLElement>} */
  const rows = new Map();

  root.innerHTML = "";
  const player = el("div", "ref-player");
  const head = el("div", "ref-player-head");
  const hint = el("p", "ref-hint", "Click a character to hear it.");
  head.appendChild(hint);
  const meta = el("p", "ref-player-meta");
  meta.hidden = true;
  const strip = /** @type {HTMLCanvasElement} */ (el("canvas", "ref-strip"));
  strip.setAttribute("aria-label", "Rhythm strip: dits and dahs to scale");
  strip.hidden = true;
  player.append(head, strip, meta);
  root.appendChild(player);

  /** @type {import("./sender.js").Schedule | null} */
  let stripSchedule = null;

  for (const g of GROUPS) {
    root.appendChild(el("p", "ref-title", g.title));
    const grid = el("div", "ref-grid");
    grid.style.gridTemplateRows = `repeat(${g.rows}, auto)`;
    grid.style.gridAutoFlow = "column";
    for (const token of g.tokens) {
      const id = token.replace(/[<>]/g, "");
      const row = el("button", "ref-row");
      row.type = "button";
      row.dataset.id = id;
      row.title = `Play ${id}`;
      row.append(charFor(token), glyphsFor(token));
      row.addEventListener("click", () => {
        opts.onPick?.(token);
        row.blur();
      });
      rows.set(id, row);
      grid.appendChild(row);
    }
    root.appendChild(grid);
  }

  /** @type {Record<string, string | null>} */
  const current = { keyed: null, playing: null, expected: null };

  /**
   * @param {string | null} id node id (e.g. `"A"`, `"7"`, `"AR"`); null clears
   * @param {"keyed" | "playing" | "expected"} kind
   */
  function highlight(id, kind) {
    if (!KINDS.includes(kind) || current[kind] === id) return;
    if (current[kind]) rows.get(current[kind])?.classList.remove(`is-${kind}`);
    current[kind] = id;
    if (id) rows.get(id)?.classList.add(`is-${kind}`);
  }

  function clearAll() {
    for (const kind of KINDS) highlight(null, kind);
  }

  /**
   * @param {string} token
   * @param {import("./sender.js").Schedule} schedule
   * @param {string} metaText
   */
  function showStrip(token, schedule, metaText) {
    stripSchedule = schedule;
    head.replaceChildren(charFor(token), glyphsFor(token));
    meta.textContent = metaText;
    meta.hidden = false;
    strip.hidden = false;
    player.classList.add("is-active");
    drawRhythmStrip(strip, schedule, -1);
  }

  /** @param {number} ms */
  function drawStrip(ms) {
    if (stripSchedule) drawRhythmStrip(strip, stripSchedule, ms);
  }

  function endStrip() {
    if (stripSchedule) drawRhythmStrip(strip, stripSchedule, Infinity);
    player.classList.remove("is-active");
  }

  return { highlight, clearAll, showStrip, drawStrip, endStrip };
}

/**
 * Dichotomous Morse tree matching the Trainer Card Pro layout.
 * Left branch = dash, right branch = dit (dot).
 * Dash nodes use rectangular pads; dit nodes use circular pads.
 * Intermediate codes with no character use small "stub" pads.
 */

export const BRANCH_DASH = "dash";
export const BRANCH_DOT = "dot";

/**
 * @typedef {{
 *   id: string,
 *   letter: string | null,
 *   label: string | null,
 *   code: string,
 *   kind: "dash" | "dot" | null,
 *   shape: "rect" | "circle" | "stub" | "root",
 *   dash: MorseNode | null,
 *   dot: MorseNode | null,
 * }} MorseNode
 */

/** Committed token → Morse code (`.` dit, `-` dah). Prosigns commit as `<XX>`. */
export const MORSE_CODES = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  "<AR>": ".-.-.",
  "<BT>": "-...-",
  "<KN>": "-.--.",
  "<SK>": "...-.-",
};

function makeNode(code, letter) {
  const last = code[code.length - 1];
  const kind = last === "-" ? BRANCH_DASH : BRANCH_DOT;
  return {
    id: letter ? letter.replace(/[<>]/g, "") : `stub${code}`,
    letter,
    label: letter ? letter.replace(/[<>]/g, "") : null,
    code,
    kind,
    shape: letter ? (kind === BRANCH_DASH ? "rect" : "circle") : "stub",
    dash: null,
    dot: null,
  };
}

function buildTree() {
  /** @type {MorseNode} */
  const root = {
    id: "root",
    letter: null,
    label: null,
    code: "",
    kind: null,
    shape: "root",
    dash: null,
    dot: null,
  };
  for (const [letter, code] of Object.entries(MORSE_CODES)) {
    let node = root;
    for (let i = 0; i < code.length; i++) {
      const branch = code[i] === "-" ? BRANCH_DASH : BRANCH_DOT;
      const prefix = code.slice(0, i + 1);
      if (!node[branch]) node[branch] = makeNode(prefix, null);
      node = node[branch];
    }
    node.letter = letter;
    node.label = letter.replace(/[<>]/g, "");
    node.id = node.label;
    node.shape = node.kind === BRANCH_DASH ? "rect" : "circle";
  }
  return root;
}

/** @type {MorseNode} */
export const MORSE_ROOT = buildTree();

/**
 * Flat list of every non-root node for layout / LED lookup.
 * @returns {MorseNode[]}
 */
export function flattenTree(node = MORSE_ROOT, out = []) {
  if (node !== MORSE_ROOT) out.push(node);
  if (node.dash) flattenTree(node.dash, out);
  if (node.dot) flattenTree(node.dot, out);
  return out;
}

/**
 * Walk one step from `node` for a dit or dah.
 * @param {MorseNode} node
 * @param {"dash"|"dot"} branch
 * @returns {MorseNode | null}
 */
export function step(node, branch) {
  if (branch === BRANCH_DASH) return node.dash;
  if (branch === BRANCH_DOT) return node.dot;
  return null;
}

/**
 * Collect ids from root down to `target` inclusive.
 * @param {MorseNode} target
 * @returns {string[]}
 */
export function pathIdsTo(target) {
  const path = [];
  let node = MORSE_ROOT;
  for (const ch of target.code) {
    node = ch === "-" ? node.dash : node.dot;
    if (!node) break;
    path.push(node.id);
  }
  return path;
}

/**
 * Node for a committed token (e.g. `"A"`, `"7"`, `"<AR>"`).
 * @param {string} token
 * @returns {MorseNode | null}
 */
export function nodeForToken(token) {
  const code = MORSE_CODES[token];
  if (!code) return null;
  let node = MORSE_ROOT;
  for (const ch of code) {
    node = ch === "-" ? node.dash : node.dot;
    if (!node) return null;
  }
  return node;
}

/**
 * Human-readable dit/dah pattern, e.g. `"· − · −"`.
 * @param {string} token
 */
export function patternFor(token) {
  const code = MORSE_CODES[token];
  if (!code) return "";
  return code
    .split("")
    .map((c) => (c === "-" ? "−" : "·"))
    .join(" ");
}

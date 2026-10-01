/**
 * Dichotomous Morse tree matching the Trainer Card Pro layout.
 * Left branch = dash, right branch = dit (dot).
 * Dash nodes use rectangular pads; dit nodes use circular pads.
 */

export const BRANCH_DASH = "dash";
export const BRANCH_DOT = "dot";

/**
 * @typedef {{
 *   id: string,
 *   letter: string | null,
 *   shape: "rect" | "circle" | "root",
 *   dash: MorseNode | null,
 *   dot: MorseNode | null,
 * }} MorseNode
 */

/** @type {MorseNode} */
export const MORSE_ROOT = {
  id: "root",
  letter: null,
  shape: "root",
  dash: {
    id: "T",
    letter: "T",
    shape: "rect",
    dash: {
      id: "M",
      letter: "M",
      shape: "rect",
      dash: {
        id: "O",
        letter: "O",
        shape: "rect",
        dash: null,
        dot: null,
      },
      dot: {
        id: "G",
        letter: "G",
        shape: "circle",
        dash: {
          id: "Q",
          letter: "Q",
          shape: "rect",
          dash: null,
          dot: null,
        },
        dot: {
          id: "Z",
          letter: "Z",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
    },
    dot: {
      id: "N",
      letter: "N",
      shape: "circle",
      dash: {
        id: "K",
        letter: "K",
        shape: "rect",
        dash: {
          id: "Y",
          letter: "Y",
          shape: "rect",
          dash: null,
          dot: null,
        },
        dot: {
          id: "C",
          letter: "C",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
      dot: {
        id: "D",
        letter: "D",
        shape: "circle",
        dash: {
          id: "X",
          letter: "X",
          shape: "rect",
          dash: null,
          dot: null,
        },
        dot: {
          id: "B",
          letter: "B",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
    },
  },
  dot: {
    id: "E",
    letter: "E",
    shape: "circle",
    dash: {
      id: "A",
      letter: "A",
      shape: "rect",
      dash: {
        id: "W",
        letter: "W",
        shape: "rect",
        dash: {
          id: "J",
          letter: "J",
          shape: "rect",
          dash: null,
          dot: null,
        },
        dot: {
          id: "P",
          letter: "P",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
      dot: {
        id: "R",
        letter: "R",
        shape: "circle",
        dash: null,
        dot: {
          id: "L",
          letter: "L",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
    },
    dot: {
      id: "I",
      letter: "I",
      shape: "circle",
      dash: {
        id: "U",
        letter: "U",
        shape: "rect",
        dash: null,
        dot: {
          id: "F",
          letter: "F",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
      dot: {
        id: "S",
        letter: "S",
        shape: "circle",
        dash: {
          id: "V",
          letter: "V",
          shape: "rect",
          dash: null,
          dot: null,
        },
        dot: {
          id: "H",
          letter: "H",
          shape: "circle",
          dash: null,
          dot: null,
        },
      },
    },
  },
};

/**
 * Flat list of every letter node for layout / LED lookup.
 * @returns {MorseNode[]}
 */
export function flattenTree(node = MORSE_ROOT, out = []) {
  if (node.letter) out.push(node);
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
  function walk(node) {
    if (!node) return false;
    if (node === target || node.id === target.id) {
      path.push(node.id);
      return true;
    }
    if (walk(node.dash)) {
      path.unshift(node.id);
      return true;
    }
    if (walk(node.dot)) {
      path.unshift(node.id);
      return true;
    }
    return false;
  }
  walk(MORSE_ROOT);
  return path.filter((id) => id !== "root");
}

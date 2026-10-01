/**
 * Interactive SVG PCB board for the Morse dichotomous chart.
 */

import { MORSE_ROOT, flattenTree } from "./tree.js";

const W = 360;
const H = 520;

/**
 * Explicit layout matching the Trainer Card Pro dichotomous key.
 * Coordinates are in SVG viewBox space (360×520).
 */
const LAYOUT = {
  root: { x: 180, y: 78 },
  T: { x: 100, y: 132 },
  E: { x: 260, y: 132 },
  M: { x: 52, y: 198 },
  N: { x: 132, y: 198 },
  A: { x: 228, y: 198 },
  I: { x: 308, y: 198 },
  O: { x: 24, y: 275 },
  G: { x: 72, y: 275 },
  K: { x: 112, y: 275 },
  D: { x: 160, y: 275 },
  W: { x: 208, y: 275 },
  R: { x: 252, y: 275 },
  U: { x: 296, y: 275 },
  S: { x: 336, y: 275 },
  Q: { x: 42, y: 365 },
  Z: { x: 82, y: 365 },
  Y: { x: 102, y: 365 },
  C: { x: 132, y: 365 },
  X: { x: 150, y: 365 },
  B: { x: 180, y: 365 },
  J: { x: 198, y: 365 },
  P: { x: 228, y: 365 },
  L: { x: 262, y: 365 },
  F: { x: 306, y: 365 },
  V: { x: 322, y: 365 },
  H: { x: 346, y: 365 },
};

/**
 * Parent → child edges for trace drawing (parentId, childId, branch).
 * @returns {{ from: string, to: string, branch: "dash"|"dot" }[]}
 */
function collectEdges(node = MORSE_ROOT, edges = []) {
  if (node.dash) {
    edges.push({ from: node.id, to: node.dash.id, branch: "dash" });
    collectEdges(node.dash, edges);
  }
  if (node.dot) {
    edges.push({ from: node.id, to: node.dot.id, branch: "dot" });
    collectEdges(node.dot, edges);
  }
  return edges;
}

function labelOffset(nodeId, shape) {
  // Nudge letter labels so they sit beside pads like the physical card
  const leftish = ["T", "M", "O", "G", "Q", "Z", "N", "K", "Y", "C", "D", "X", "B"];
  const side = leftish.includes(nodeId) ? -1 : 1;
  if (shape === "rect") return { dx: side * 14, dy: 4 };
  return { dx: side * 12, dy: 4 };
}

/**
 * @param {HTMLElement} mount
 */
export function createBoard(mount) {
  const nodes = flattenTree();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = collectEdges();

  mount.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Morse code dichotomous trainer board");
  svg.classList.add("morse-board-svg");

  // PCB plate
  svg.innerHTML = `
    <defs>
      <filter id="morse-led-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3.5" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <radialGradient id="morse-plate" cx="50%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#1a1a1a"/>
        <stop offset="100%" stop-color="#050505"/>
      </radialGradient>
    </defs>
    <rect class="morse-plate" x="8" y="8" width="${W - 16}" height="${H - 16}" rx="18" ry="18"/>
    <rect class="morse-plate-rim" x="14" y="14" width="${W - 28}" height="${H - 28}" rx="14" ry="14" fill="none"/>
    <circle class="morse-mount-hole" cx="${W - 36}" cy="36" r="7"/>
  `;

  // Header: MORSE | antenna | CODE
  const header = document.createElementNS("http://www.w3.org/2000/svg", "g");
  header.classList.add("morse-header");
  header.innerHTML = `
    <text x="52" y="48" class="morse-title">MORSE</text>
    <g class="morse-antenna" transform="translate(180, 42)">
      <line x1="0" y1="8" x2="0" y2="-10" />
      <line x1="-8" y1="-4" x2="8" y2="-4" />
      <line x1="-5" y1="-8" x2="5" y2="-8" />
      <circle cx="0" cy="12" r="3.5" class="morse-node-pad root" data-node="root"/>
    </g>
    <text x="248" y="48" class="morse-title">CODE</text>
  `;
  svg.appendChild(header);

  // Traces
  const traces = document.createElementNS("http://www.w3.org/2000/svg", "g");
  traces.classList.add("morse-traces");
  for (const edge of edges) {
    const a = LAYOUT[edge.from];
    const b = LAYOUT[edge.to];
    if (!a || !b) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // Elbow: vertical then horizontal then vertical for a PCB-trace feel
    const midY = (a.y + b.y) / 2;
    path.setAttribute(
      "d",
      `M ${a.x} ${a.y} V ${midY} H ${b.x} V ${b.y}`
    );
    path.setAttribute("data-edge", `${edge.from}-${edge.to}`);
    path.classList.add("morse-trace");
    traces.appendChild(path);
  }
  // Root stem into T/E fork
  const rootPos = LAYOUT.root;
  const stem = document.createElementNS("http://www.w3.org/2000/svg", "path");
  stem.setAttribute(
    "d",
    `M ${rootPos.x} ${rootPos.y - 18} V ${rootPos.y}`
  );
  stem.classList.add("morse-trace");
  traces.insertBefore(stem, traces.firstChild);
  svg.appendChild(traces);

  // Nodes + labels
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  nodeLayer.classList.add("morse-nodes");

  // Root pad already in antenna; ensure data attribute target exists
  for (const node of nodes) {
    const pos = LAYOUT[node.id];
    if (!pos) continue;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-node", node.id);
    g.classList.add("morse-node", `morse-shape-${node.shape}`);

    if (node.shape === "rect") {
      const pad = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      pad.setAttribute("x", String(pos.x - 6));
      pad.setAttribute("y", String(pos.y - 5));
      pad.setAttribute("width", "12");
      pad.setAttribute("height", "10");
      pad.setAttribute("rx", "1.5");
      pad.classList.add("morse-node-pad");
      g.appendChild(pad);
    } else {
      const pad = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pad.setAttribute("cx", String(pos.x));
      pad.setAttribute("cy", String(pos.y));
      pad.setAttribute("r", "5");
      pad.classList.add("morse-node-pad");
      g.appendChild(pad);
    }

    const led = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    led.setAttribute("cx", String(pos.x));
    led.setAttribute("cy", String(pos.y));
    led.setAttribute("r", "4.2");
    led.classList.add("morse-led");
    g.appendChild(led);

    const off = labelOffset(node.id, node.shape);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(pos.x + off.dx));
    label.setAttribute("y", String(pos.y + off.dy));
    label.setAttribute("text-anchor", off.dx < 0 ? "end" : "start");
    label.classList.add("morse-letter");
    label.textContent = node.letter || "";
    g.appendChild(label);

    nodeLayer.appendChild(g);
  }
  svg.appendChild(nodeLayer);

  // Footer speaker glyph
  const footer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  footer.classList.add("morse-footer");
  footer.setAttribute("transform", `translate(${W / 2}, ${H - 48})`);
  footer.innerHTML = `
    <circle cx="0" cy="0" r="4" class="morse-speaker-core"/>
    <path d="M 8 -6 A 10 10 0 0 1 8 6" class="morse-speaker-arc" fill="none"/>
    <path d="M 14 -11 A 17 17 0 0 1 14 11" class="morse-speaker-arc" fill="none"/>
    <path d="M 20 -16 A 24 24 0 0 1 20 16" class="morse-speaker-arc" fill="none"/>
  `;
  svg.appendChild(footer);

  mount.appendChild(svg);

  /** @type {Set<string>} */
  let lit = new Set();
  /** @type {string | null} */
  let current = null;

  /**
   * @param {string[]} pathIds nodes from first letter down to current
   * @param {string | null} currentId
   */
  function setPath(pathIds, currentId = null) {
    lit = new Set(pathIds);
    current = currentId || (pathIds.length ? pathIds[pathIds.length - 1] : null);
    paint();
  }

  function clearPath() {
    lit = new Set();
    current = null;
    paint();
  }

  function flashError() {
    svg.classList.add("morse-board-error");
    setTimeout(() => svg.classList.remove("morse-board-error"), 280);
  }

  function paint() {
    nodeLayer.querySelectorAll(".morse-node").forEach((el) => {
      const id = el.getAttribute("data-node");
      el.classList.toggle("is-lit", lit.has(id));
      el.classList.toggle("is-current", id === current);
      // Alternate red / green along path depth for PCB LED feel
      const idx = [...lit].indexOf(id);
      el.classList.toggle("led-green", lit.has(id) && idx % 2 === 1);
      el.classList.toggle("led-red", lit.has(id) && idx % 2 === 0);
    });

    // Light traces that connect consecutive lit nodes (plus root→first)
    const litList = [...lit];
    traces.querySelectorAll(".morse-trace").forEach((el) => {
      const key = el.getAttribute("data-edge");
      if (!key) {
        el.classList.toggle("is-lit", litList.length > 0);
        return;
      }
      const [from, to] = key.split("-");
      const fromOk = from === "root" || lit.has(from);
      const toOk = lit.has(to);
      el.classList.toggle("is-lit", fromOk && toOk);
    });
  }

  return {
    svg,
    setPath,
    clearPath,
    flashError,
    byId,
    LAYOUT,
  };
}

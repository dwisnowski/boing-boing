/**
 * Vector Morse Trainer Card drawn on HTML Canvas.
 * Layout matches the dichotomous PCB chart (tight card crop).
 */

import { MORSE_ROOT, flattenTree } from "./tree.js";

const GOLD = "#d6c7a1";
const GOLD_DIM = "rgba(214, 199, 161, 0.85)";
const INK = "#050505";
const LOGICAL_W = 360;
const LOGICAL_H = 500;

/**
 * Node positions in logical canvas space.
 * Matches the physical Trainer Card Pro dichotomous key.
 */
const LAYOUT = {
  root: { x: 180, y: 72 },
  // Dash rail (left): O — M — T
  O: { x: 48, y: 128 },
  M: { x: 100, y: 128 },
  T: { x: 152, y: 128 },
  // Dit rail (right): E — I — S — H
  E: { x: 228, y: 128 },
  I: { x: 270, y: 128 },
  S: { x: 308, y: 128 },
  H: { x: 340, y: 128 },
  // Under M
  Q: { x: 48, y: 188 },
  G: { x: 100, y: 188 },
  Z: { x: 100, y: 248 },
  // Under I / S
  U: { x: 270, y: 188 },
  V: { x: 308, y: 188 },
  F: { x: 270, y: 248 },
  // Center spine under T
  N: { x: 152, y: 220 },
  D: { x: 152, y: 300 },
  B: { x: 152, y: 380 },
  // Left of N / D
  Y: { x: 58, y: 220 },
  K: { x: 105, y: 220 },
  C: { x: 105, y: 280 },
  X: { x: 105, y: 340 },
  // Right spine under E
  A: { x: 228, y: 220 },
  R: { x: 278, y: 220 },
  L: { x: 322, y: 220 },
  W: { x: 228, y: 300 },
  P: { x: 286, y: 300 },
  J: { x: 228, y: 380 },
};

/** Letter label offsets relative to node center. */
const LABEL_OFFSET = {
  O: { dx: 0, dy: -16 },
  M: { dx: 0, dy: -16 },
  T: { dx: 14, dy: -4 },
  Q: { dx: 0, dy: -16 },
  G: { dx: 14, dy: 4 },
  Z: { dx: 14, dy: 4 },
  Y: { dx: 0, dy: -16 },
  K: { dx: 0, dy: -16 },
  C: { dx: 14, dy: 4 },
  X: { dx: 0, dy: -16 },
  N: { dx: 14, dy: 4 },
  D: { dx: 14, dy: 4 },
  B: { dx: 14, dy: 4 },
  E: { dx: 0, dy: -16 },
  I: { dx: 0, dy: -16 },
  S: { dx: 0, dy: -16 },
  H: { dx: 0, dy: -16 },
  U: { dx: 14, dy: -4 },
  V: { dx: 14, dy: -4 },
  F: { dx: 14, dy: 4 },
  A: { dx: -14, dy: -4 },
  R: { dx: 0, dy: -16 },
  L: { dx: 0, dy: -16 },
  W: { dx: -14, dy: -4 },
  P: { dx: 0, dy: -16 },
  J: { dx: -14, dy: -4 },
};

function collectEdges(node = MORSE_ROOT, edges = []) {
  if (node.dash) {
    edges.push({ from: node.id, to: node.dash.id });
    collectEdges(node.dash, edges);
  }
  if (node.dot) {
    edges.push({ from: node.id, to: node.dot.id });
    collectEdges(node.dot, edges);
  }
  return edges;
}

function elbowPath(a, b) {
  // Orthogonal PCB-style elbow: vertical then horizontal then vertical
  const midY = (a.y + b.y) / 2;
  return [
    { x: a.x, y: a.y },
    { x: a.x, y: midY },
    { x: b.x, y: midY },
    { x: b.x, y: b.y },
  ];
}

/**
 * @param {HTMLElement} mount
 */
export function createBoard(mount) {
  const nodes = flattenTree();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = collectEdges();

  mount.innerHTML = "";
  mount.classList.add("morse-board");

  const canvas = document.createElement("canvas");
  canvas.className = "morse-board-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Morse code trainer card");
  mount.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cssW = LOGICAL_W;
  let cssH = LOGICAL_H;

  /** @type {Set<string>} */
  let lit = new Set();
  /** @type {string | null} */
  let current = null;
  let errorFlash = 0;
  let anim = 0;
  let raf = 0;

  function resize() {
    const parentW = mount.clientWidth || LOGICAL_W;
    const maxH = Math.min(window.innerHeight * 0.56, 560);
    const scale = Math.min(parentW / LOGICAL_W, maxH / LOGICAL_H);
    cssW = Math.floor(LOGICAL_W * scale);
    cssH = Math.floor(LOGICAL_H * scale);
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    paint();
  }

  function toScreen(x, y) {
    return {
      x: (x / LOGICAL_W) * cssW,
      y: (y / LOGICAL_H) * cssH,
    };
  }

  function drawRoundedRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function drawAntenna(c, x, y, s) {
    c.strokeStyle = GOLD;
    c.fillStyle = GOLD;
    c.lineWidth = Math.max(1.2, s * 0.08);
    c.lineCap = "round";
    // mast
    c.beginPath();
    c.moveTo(x, y + s * 0.55);
    c.lineTo(x, y - s * 0.35);
    c.stroke();
    // top bar
    c.beginPath();
    c.moveTo(x - s * 0.35, y - s * 0.2);
    c.lineTo(x + s * 0.35, y - s * 0.2);
    c.stroke();
    // triangle tip
    c.beginPath();
    c.moveTo(x, y - s * 0.55);
    c.lineTo(x - s * 0.22, y - s * 0.22);
    c.lineTo(x + s * 0.22, y - s * 0.22);
    c.closePath();
    c.fill();
  }

  function drawSpeaker(c, x, y, s) {
    c.strokeStyle = GOLD;
    c.fillStyle = GOLD;
    c.lineWidth = Math.max(1.2, s * 0.08);
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y, s * 0.14, 0, Math.PI * 2);
    c.fill();
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const r = s * (0.22 + i * 0.16);
        c.beginPath();
        c.arc(x, y, r, side < 0 ? Math.PI * 0.65 : -Math.PI * 0.35, side < 0 ? Math.PI * 1.35 : Math.PI * 0.35);
        c.stroke();
      }
    }
  }

  function drawGlow(c, x, y, kind, radius, pulse) {
    const a = 0.75 + pulse * 0.25;
    const rgba =
      kind === "green"
        ? [
            `rgba(80,255,140,${0.95 * a})`,
            `rgba(0,255,100,${0.42 * a})`,
            "rgba(0,255,80,0)",
          ]
        : [
            `rgba(255,50,30,${0.95 * a})`,
            `rgba(255,0,0,${0.42 * a})`,
            "rgba(255,0,0,0)",
          ];
    const grad = c.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, rgba[0]);
    grad.addColorStop(0.45, rgba[1]);
    grad.addColorStop(1, rgba[2]);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
  }

  function paint() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const sx = cssW / LOGICAL_W;
    const sy = cssH / LOGICAL_H;
    const s = Math.min(sx, sy);
    const pulse = 0.5 + 0.5 * Math.sin(anim * 0.006);

    // Card plate
    const pad = 6 * s;
    const plateX = pad;
    const plateY = pad;
    const plateW = cssW - pad * 2;
    const plateH = cssH - pad * 2;
    const radius = 18 * s;

    ctx.fillStyle = INK;
    drawRoundedRect(ctx, plateX, plateY, plateW, plateH, radius);
    ctx.fill();

    const borderColor = errorFlash > 0 ? "#ff4444" : GOLD;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.5, 2.2 * s);
    drawRoundedRect(ctx, plateX, plateY, plateW, plateH, radius);
    ctx.stroke();

    // Inner rim
    ctx.strokeStyle = "rgba(214, 199, 161, 0.35)";
    ctx.lineWidth = Math.max(1, 1.1 * s);
    drawRoundedRect(
      ctx,
      plateX + 5 * s,
      plateY + 5 * s,
      plateW - 10 * s,
      plateH - 10 * s,
      radius - 4 * s
    );
    ctx.stroke();

    // Mount hole
    const hole = toScreen(328, 36);
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 9 * s, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0a0a";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.2, 1.5 * s);
    ctx.stroke();

    // Header
    ctx.fillStyle = GOLD;
    ctx.font = `700 ${Math.round(15 * s)}px "IBM Plex Sans", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const morsePos = toScreen(42, 40);
    const codePos = toScreen(248, 40);
    ctx.fillText("MORSE", morsePos.x, morsePos.y);
    ctx.fillText("CODE", codePos.x, codePos.y);

    const ant = toScreen(180, 40);
    drawAntenna(ctx, ant.x, ant.y, 22 * s);

    // Stem from antenna to fork
    const root = toScreen(LAYOUT.root.x, LAYOUT.root.y);
    ctx.strokeStyle = GOLD_DIM;
    ctx.lineWidth = Math.max(1.1, 1.35 * s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ant.x, ant.y + 12 * s);
    ctx.lineTo(root.x, root.y);
    ctx.stroke();

    // Traces
    const litList = [...lit];
    for (const edge of edges) {
      const a = LAYOUT[edge.from];
      const b = LAYOUT[edge.to];
      if (!a || !b) continue;
      const pts = elbowPath(a, b).map((p) => toScreen(p.x, p.y));
      const active =
        (edge.from === "root" && lit.has(edge.to)) ||
        (lit.has(edge.from) && lit.has(edge.to));
      ctx.strokeStyle = active ? "#ff5555" : GOLD_DIM;
      ctx.lineWidth = Math.max(1.1, (active ? 1.7 : 1.3) * s);
      if (active) {
        ctx.shadowColor = "rgba(255,0,0,0.55)";
        ctx.shadowBlur = 6 * s;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Nodes + LEDs + labels
    ctx.font = `700 ${Math.round(11 * s)}px "IBM Plex Sans", sans-serif`;
    ctx.textBaseline = "middle";

    for (const node of nodes) {
      const pos = LAYOUT[node.id];
      if (!pos) continue;
      const p = toScreen(pos.x, pos.y);
      const on = lit.has(node.id);
      const idx = litList.indexOf(node.id);
      const isGreen = on && idx % 2 === 1;
      const isRed = on && idx % 2 === 0;
      const isCurrent = node.id === current;

      if (on) {
        drawGlow(
          ctx,
          p.x,
          p.y,
          isGreen ? "green" : "red",
          (isCurrent ? 16 : 13) * s * (0.92 + pulse * 0.08),
          pulse
        );
      }

      ctx.lineWidth = Math.max(1.2, 1.45 * s);
      ctx.strokeStyle = on ? (isGreen ? "#66ff99" : "#ff6666") : GOLD;
      ctx.fillStyle = INK;

      if (node.shape === "rect") {
        const rw = 14 * s;
        const rh = 9 * s;
        drawRoundedRect(ctx, p.x - rw / 2, p.y - rh / 2, rw, rh, 2 * s);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      const off = LABEL_OFFSET[node.id] || { dx: 12, dy: 0 };
      ctx.fillStyle = on ? "#fff4c2" : GOLD;
      ctx.textAlign = off.dx < 0 ? "end" : off.dx === 0 ? "center" : "start";
      ctx.fillText(node.letter, p.x + off.dx * s, p.y + off.dy * s);
    }

    // Footer speaker
    const sp = toScreen(180, 455);
    drawSpeaker(ctx, sp.x, sp.y, 28 * s);

    if (errorFlash > 0) errorFlash -= 1;
  }

  function tick(now) {
    anim = now;
    paint();
    const needsAnim = lit.size > 0 || errorFlash > 0;
    if (needsAnim) raf = requestAnimationFrame(tick);
    else raf = 0;
  }

  function ensureAnim() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /**
   * @param {string[]} pathIds
   * @param {string | null} currentId
   */
  function setPath(pathIds, currentId = null) {
    lit = new Set(pathIds);
    current = currentId || (pathIds.length ? pathIds[pathIds.length - 1] : null);
    ensureAnim();
    paint();
  }

  function clearPath() {
    lit = new Set();
    current = null;
    paint();
  }

  function flashError() {
    errorFlash = 18;
    ensureAnim();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(mount);
  window.addEventListener("resize", resize);
  resize();

  return {
    canvas,
    setPath,
    clearPath,
    flashError,
    resize,
    destroy() {
      ro.disconnect();
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    },
    byId,
    LAYOUT,
  };
}

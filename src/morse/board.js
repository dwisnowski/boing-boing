/**
 * Vector Morse Trainer Card drawn on HTML Canvas.
 * Layout matches the dichotomous PCB chart (tight card crop).
 *
 * LEDs: dit (circle) = green, dah (rect) = red
 * Keyed traces: animated gold leading into lit LEDs
 */

import { MORSE_ROOT, flattenTree } from "./tree.js";

const GOLD = "#d6c7a1";
const GOLD_DIM = "rgba(214, 199, 161, 0.85)";
const GOLD_LIT = "#f0e0a8";
const INK = "#050505";
const LOGICAL_W = 360;
const LOGICAL_H = 500;
const SEGMENT_MS = 220;

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
    edges.push({ from: node.id, to: node.dash.id, branch: "dash" });
    collectEdges(node.dash, edges);
  }
  if (node.dot) {
    edges.push({ from: node.id, to: node.dot.id, branch: "dot" });
    collectEdges(node.dot, edges);
  }
  return edges;
}

function elbowPath(a, b) {
  const midY = (a.y + b.y) / 2;
  return [
    { x: a.x, y: a.y },
    { x: a.x, y: midY },
    { x: b.x, y: midY },
    { x: b.x, y: b.y },
  ];
}

function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/** Walk `progress` (0–1) along polyline; returns points up to that fraction. */
function partialPolyline(pts, progress) {
  if (progress >= 1) return pts.slice();
  if (progress <= 0 || pts.length < 2) return [pts[0]];
  const total = pathLength(pts);
  let remain = total * progress;
  const out = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    const seg = Math.hypot(dx, dy);
    if (remain >= seg) {
      out.push({ x: pts[i].x, y: pts[i].y });
      remain -= seg;
    } else {
      const t = seg === 0 ? 0 : remain / seg;
      out.push({
        x: pts[i - 1].x + dx * t,
        y: pts[i - 1].y + dy * t,
      });
      break;
    }
  }
  return out;
}

function easeOutCubic(t) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
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

  /** @type {string[]} */
  let litPath = [];
  /** @type {string | null} */
  let current = null;
  let errorFlash = 0;
  let anim = 0;
  let raf = 0;
  /** Trace draw-in animation */
  let traceAnim = {
    /** @type {string[]} */
    pathIds: [],
    fromCount: 0,
    startedAt: 0,
  };

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
    c.beginPath();
    c.moveTo(x, y + s * 0.55);
    c.lineTo(x, y - s * 0.35);
    c.stroke();
    c.beginPath();
    c.moveTo(x - s * 0.35, y - s * 0.2);
    c.lineTo(x + s * 0.35, y - s * 0.2);
    c.stroke();
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
        c.arc(
          x,
          y,
          r,
          side < 0 ? Math.PI * 0.65 : -Math.PI * 0.35,
          side < 0 ? Math.PI * 1.35 : Math.PI * 0.35
        );
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

  function strokePolyline(c, pts, { color, width, glow = false, dashOffset = 0 }) {
    if (pts.length < 2) return;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    if (glow) {
      c.shadowColor = "rgba(240, 224, 168, 0.65)";
      c.shadowBlur = width * 2.2;
    } else {
      c.shadowBlur = 0;
    }
    if (dashOffset) {
      c.setLineDash([width * 3.5, width * 2.2]);
      c.lineDashOffset = -dashOffset;
    } else {
      c.setLineDash([]);
      c.lineDashOffset = 0;
    }
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
    c.setLineDash([]);
    c.lineDashOffset = 0;
    c.shadowBlur = 0;
  }

  /** Ordered active edges from root → current, for draw-in animation. */
  function activeEdgeChain(pathIds) {
    const chain = [];
    let prev = "root";
    for (const id of pathIds) {
      chain.push({ from: prev, to: id });
      prev = id;
    }
    return chain;
  }

  function segmentProgress(now) {
    const pathIds = traceAnim.pathIds;
    if (!pathIds.length) return { drawnCount: 0, partial: 0 };
    const newSegs = Math.max(0, pathIds.length - traceAnim.fromCount);
    if (newSegs === 0) {
      return { drawnCount: pathIds.length, partial: 1 };
    }
    const elapsed = Math.max(0, now - traceAnim.startedAt);
    const total = newSegs * SEGMENT_MS;
    const t = easeOutCubic(elapsed / total);
    const f = t * newSegs;
    const full = Math.floor(f);
    return {
      drawnCount: traceAnim.fromCount + full,
      partial: f - full,
    };
  }

  function paint() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const sx = cssW / LOGICAL_W;
    const sy = cssH / LOGICAL_H;
    const s = Math.min(sx, sy);
    const pulse = 0.5 + 0.5 * Math.sin(anim * 0.006);
    const flow = (anim * 0.05) % 40;

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

    // Stem antenna → root
    const root = toScreen(LAYOUT.root.x, LAYOUT.root.y);
    const stemActive = litPath.length > 0;
    strokePolyline(
      ctx,
      [
        { x: ant.x, y: ant.y + 12 * s },
        { x: root.x, y: root.y },
      ],
      {
        color: stemActive ? GOLD_LIT : GOLD_DIM,
        width: Math.max(1.1, (stemActive ? 1.7 : 1.3) * s),
        glow: stemActive,
        dashOffset: stemActive ? flow : 0,
      }
    );

    // Idle traces (dim gold)
    const litSet = new Set(litPath);
    for (const edge of edges) {
      const a = LAYOUT[edge.from];
      const b = LAYOUT[edge.to];
      if (!a || !b) continue;
      const active =
        (edge.from === "root" && litSet.has(edge.to)) ||
        (litSet.has(edge.from) && litSet.has(edge.to));
      if (active) continue; // drawn in animated pass
      const pts = elbowPath(a, b).map((p) => toScreen(p.x, p.y));
      strokePolyline(ctx, pts, {
        color: GOLD_DIM,
        width: Math.max(1.1, 1.3 * s),
      });
    }

    // Animated gold traces along keyed path
    const chain = activeEdgeChain(litPath);
    const { drawnCount, partial } = segmentProgress(anim);
    for (let i = 0; i < chain.length; i++) {
      const edge = chain[i];
      const a = LAYOUT[edge.from];
      const b = LAYOUT[edge.to];
      if (!a || !b) continue;
      const fullPts = elbowPath(a, b).map((p) => toScreen(p.x, p.y));

      let prog = 0;
      if (i < drawnCount) prog = 1;
      else if (i === drawnCount) prog = partial;
      else prog = 0;
      if (prog <= 0) continue;

      const pts = partialPolyline(fullPts, prog);
      const complete = prog >= 1;
      strokePolyline(ctx, pts, {
        color: GOLD_LIT,
        width: Math.max(1.2, 1.85 * s),
        glow: true,
        dashOffset: complete ? flow : 0,
      });
    }

    // Nodes + LEDs + labels
    // Dah (rect) → red LED; Dit (circle) → green LED
    ctx.font = `700 ${Math.round(11 * s)}px "IBM Plex Sans", sans-serif`;
    ctx.textBaseline = "middle";

    // Only light a node once its inbound trace has finished drawing
    const litReady = new Set(litPath.slice(0, drawnCount));
    if (partial >= 0.92 && drawnCount < litPath.length) {
      litReady.add(litPath[drawnCount]);
    }

    for (const node of nodes) {
      const pos = LAYOUT[node.id];
      if (!pos) continue;
      const p = toScreen(pos.x, pos.y);
      const on = litReady.has(node.id);
      const isDah = node.shape === "rect";
      const kind = isDah ? "red" : "green";
      const isCurrent = node.id === current && on;

      if (on) {
        drawGlow(
          ctx,
          p.x,
          p.y,
          kind,
          (isCurrent ? 16 : 13) * s * (0.92 + pulse * 0.08),
          pulse
        );
      }

      ctx.lineWidth = Math.max(1.2, 1.45 * s);
      ctx.strokeStyle = on
        ? isDah
          ? "#ff6666"
          : "#66ff99"
        : GOLD;
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

    const sp = toScreen(180, 455);
    drawSpeaker(ctx, sp.x, sp.y, 28 * s);

    if (errorFlash > 0) errorFlash -= 1;
  }

  function animComplete(now) {
    if (!litPath.length) return true;
    const newSegs = Math.max(0, litPath.length - traceAnim.fromCount);
    if (newSegs === 0) return true;
    return now - traceAnim.startedAt >= newSegs * SEGMENT_MS;
  }

  function tick(now) {
    anim = now;
    paint();
    const needsAnim =
      litPath.length > 0 || errorFlash > 0 || !animComplete(now);
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
    const next = pathIds.slice();
    // Shared prefix stays drawn; animate only new segments
    let shared = 0;
    while (
      shared < litPath.length &&
      shared < next.length &&
      litPath[shared] === next[shared]
    ) {
      shared += 1;
    }
    const fromCount =
      next.length >= litPath.length ? Math.min(shared, next.length) : 0;

    litPath = next;
    current = currentId || (next.length ? next[next.length - 1] : null);
    traceAnim = {
      pathIds: next,
      fromCount,
      startedAt: performance.now(),
    };
    ensureAnim();
    paint();
  }

  function clearPath() {
    litPath = [];
    current = null;
    traceAnim = { pathIds: [], fromCount: 0, startedAt: 0 };
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

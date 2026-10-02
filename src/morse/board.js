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
const GOLD_LIT = "#ffd45a";
const GOLD_CORE = "#ffe9a0";
const INK = "#050505";
const LOGICAL_W = 440;
const LOGICAL_H = 560;
const SEGMENT_MS = 260;

/**
 * Node positions in logical canvas space.
 * Letters follow the physical Trainer Card Pro dichotomous key; digits,
 * prosigns and unlabeled stub pads hang off the same rails.
 */
const LAYOUT = {
  root: { x: 220, y: 72 },
  // Dash rail (left): ---- — O — M — T
  "stub----": { x: 36, y: 130 },
  O: { x: 80, y: 130 },
  M: { x: 128, y: 130 },
  T: { x: 176, y: 130 },
  0: { x: 36, y: 94 },
  9: { x: 36, y: 172 },
  "stub---.": { x: 80, y: 172 },
  8: { x: 80, y: 210 },
  // Under M
  G: { x: 128, y: 172 },
  Q: { x: 116, y: 212 },
  Z: { x: 148, y: 212 },
  7: { x: 148, y: 250 },
  // Center-left spine under T
  N: { x: 176, y: 290 },
  K: { x: 128, y: 290 },
  Y: { x: 80, y: 290 },
  KN: { x: 80, y: 330 },
  C: { x: 128, y: 330 },
  D: { x: 176, y: 370 },
  X: { x: 128, y: 370 },
  B: { x: 176, y: 420 },
  BT: { x: 128, y: 420 },
  6: { x: 176, y: 470 },
  // Dit rail (right): E — I — S — H
  E: { x: 264, y: 130 },
  I: { x: 304, y: 130 },
  S: { x: 344, y: 130 },
  H: { x: 384, y: 130 },
  5: { x: 384, y: 94 },
  4: { x: 384, y: 172 },
  // Under I / S
  U: { x: 304, y: 172 },
  F: { x: 304, y: 212 },
  "stub..--": { x: 284, y: 212 },
  2: { x: 284, y: 250 },
  V: { x: 344, y: 172 },
  3: { x: 344, y: 212 },
  "stub...-.": { x: 400, y: 212 },
  SK: { x: 400, y: 250 },
  // Center-right spine under E
  A: { x: 264, y: 300 },
  R: { x: 312, y: 300 },
  L: { x: 360, y: 300 },
  "stub.-.-": { x: 312, y: 340 },
  AR: { x: 352, y: 340 },
  W: { x: 264, y: 380 },
  P: { x: 312, y: 380 },
  J: { x: 264, y: 430 },
  1: { x: 264, y: 470 },
};

const RIGHT = { dx: 14, dy: 0 };
const LEFT = { dx: -14, dy: 0 };
const ABOVE = { dx: 0, dy: -16 };

/** Label offsets relative to node center. */
const LABEL_OFFSET = {
  T: { dx: 14, dy: -6 },
  M: ABOVE,
  O: ABOVE,
  0: RIGHT,
  9: RIGHT,
  8: LEFT,
  G: RIGHT,
  Q: LEFT,
  Z: RIGHT,
  7: RIGHT,
  N: RIGHT,
  K: ABOVE,
  Y: ABOVE,
  KN: RIGHT,
  C: RIGHT,
  D: RIGHT,
  X: LEFT,
  B: RIGHT,
  BT: LEFT,
  6: RIGHT,
  E: { dx: -14, dy: -6 },
  I: ABOVE,
  S: ABOVE,
  H: RIGHT,
  5: RIGHT,
  4: RIGHT,
  U: LEFT,
  F: RIGHT,
  2: RIGHT,
  V: RIGHT,
  3: RIGHT,
  SK: LEFT,
  A: LEFT,
  R: ABOVE,
  L: ABOVE,
  AR: RIGHT,
  W: LEFT,
  P: RIGHT,
  J: LEFT,
  1: LEFT,
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
  /** @type {string[]} */
  let hintPath = [];
  let heightRatio = 0.56;
  let maxHeightPx = 600;
  let segmentMs = SEGMENT_MS;

  function resize() {
    const parentW = mount.clientWidth || LOGICAL_W;
    const maxH = Math.min(window.innerHeight * heightRatio, maxHeightPx);
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
      c.shadowColor = "rgba(255, 200, 60, 0.85)";
      c.shadowBlur = width * 3.2;
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
    const total = newSegs * segmentMs;
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
    const hole = toScreen(404, 36);
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
    const morsePos = toScreen(62, 40);
    const codePos = toScreen(288, 40);
    ctx.fillText("MORSE", morsePos.x, morsePos.y);
    ctx.fillText("CODE", codePos.x, codePos.y);

    const ant = toScreen(220, 40);
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

    // Ghost hint trace for the next expected character
    if (hintPath.length) {
      let prev = "root";
      for (const id of hintPath) {
        const a = LAYOUT[prev];
        const b = LAYOUT[id];
        prev = id;
        if (!a || !b) continue;
        const pts = elbowPath(a, b).map((p) => toScreen(p.x, p.y));
        strokePolyline(ctx, pts, {
          color: "rgba(140, 220, 255, 0.75)",
          width: Math.max(1.4, 2 * s),
          dashOffset: 0.0001,
        });
      }
      const last = LAYOUT[hintPath[hintPath.length - 1]];
      if (last) {
        const p = toScreen(last.x, last.y);
        ctx.strokeStyle = "rgba(140, 220, 255, 0.85)";
        ctx.lineWidth = Math.max(1.2, 1.5 * s);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10 * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Nodes + LEDs + labels
    // Dah (rect) → red LED; Dit (circle) → green LED
    ctx.font = `700 ${Math.round(11 * s)}px "IBM Plex Sans", sans-serif`;
    ctx.textBaseline = "middle";

    const chain = activeEdgeChain(litPath);
    const { drawnCount, partial } = segmentProgress(anim);
    // Only light a node once its inbound trace has mostly drawn in
    const litReady = new Set(litPath.slice(0, drawnCount));
    if (partial >= 0.88 && drawnCount < litPath.length) {
      litReady.add(litPath[drawnCount]);
    }

    for (const node of nodes) {
      const pos = LAYOUT[node.id];
      if (!pos) continue;
      const p = toScreen(pos.x, pos.y);
      const on = litReady.has(node.id);
      const isDah = node.kind === "dash";
      const isStub = node.shape === "stub";
      const kind = isDah ? "red" : "green";
      const isCurrent = node.id === current && on;

      if (on) {
        drawGlow(
          ctx,
          p.x,
          p.y,
          kind,
          (isCurrent ? 16 : isStub ? 9 : 13) * s * (0.92 + pulse * 0.08),
          pulse
        );
      }

      // Dah pads = red LEDs; dit pads = green LEDs (dim when idle, bright when lit)
      ctx.lineWidth = Math.max(1.35, 1.6 * s);
      if (isDah) {
        ctx.strokeStyle = on ? "#ff8a78" : "#e05544";
        ctx.fillStyle = on ? "#6e1410" : "#6a2018";
      } else {
        ctx.strokeStyle = on ? "#78ffaa" : "#3dcc6e";
        ctx.fillStyle = on ? "#0c4824" : "#1a5a32";
      }

      if (isStub) {
        ctx.beginPath();
        if (isDah) {
          drawRoundedRect(ctx, p.x - 4.5 * s, p.y - 3 * s, 9 * s, 6 * s, 1.5 * s);
        } else {
          ctx.arc(p.x, p.y, 3.4 * s, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        continue;
      }

      if (node.shape === "rect") {
        const rw = 15 * s;
        const rh = 10 * s;
        drawRoundedRect(ctx, p.x - rw / 2, p.y - rh / 2, rw, rh, 2.2 * s);
        ctx.fill();
        ctx.stroke();
        // LED lens
        ctx.fillStyle = on
          ? "rgba(255, 130, 100, 0.9)"
          : "rgba(255, 90, 70, 0.7)";
        drawRoundedRect(
          ctx,
          p.x - rw * 0.3,
          p.y - rh * 0.24,
          rw * 0.6,
          rh * 0.48,
          s
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.6 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // LED lens
        ctx.beginPath();
        ctx.fillStyle = on
          ? "rgba(120, 255, 160, 0.95)"
          : "rgba(70, 220, 120, 0.75)";
        ctx.arc(p.x, p.y, 3 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      const off = LABEL_OFFSET[node.id] || RIGHT;
      const label = node.id === "0" ? "Ø" : node.label || "";
      ctx.font =
        label.length > 1
          ? `700 ${Math.round(8.5 * s)}px "IBM Plex Sans", sans-serif`
          : `700 ${Math.round(11 * s)}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle = on ? "#fff4c2" : GOLD;
      ctx.textAlign = off.dx < 0 ? "end" : off.dx === 0 ? "center" : "start";
      ctx.fillText(label, p.x + off.dx * s, p.y + off.dy * s);
    }

    // Animated gold traces drawn ON TOP so they read clearly as gold (not green-tinted by LED glow)
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
      // Wide warm underglow
      strokePolyline(ctx, pts, {
        color: "rgba(255, 180, 40, 0.55)",
        width: Math.max(2.4, 3.4 * s),
        glow: true,
      });
      // Bright gold body
      strokePolyline(ctx, pts, {
        color: GOLD_LIT,
        width: Math.max(1.6, 2.15 * s),
        glow: true,
        dashOffset: complete ? flow : 0,
      });
      // Hot core
      strokePolyline(ctx, pts, {
        color: GOLD_CORE,
        width: Math.max(0.9, 1.1 * s),
      });
    }

    // Stem antenna → root (re-draw lit so it stays gold above LEDs)
    if (stemActive) {
      strokePolyline(
        ctx,
        [
          { x: ant.x, y: ant.y + 12 * s },
          { x: root.x, y: root.y },
        ],
        {
          color: "rgba(255, 180, 40, 0.55)",
          width: Math.max(2.2, 3.1 * s),
          glow: true,
        }
      );
      strokePolyline(
        ctx,
        [
          { x: ant.x, y: ant.y + 12 * s },
          { x: root.x, y: root.y },
        ],
        {
          color: GOLD_LIT,
          width: Math.max(1.5, 2 * s),
          glow: true,
          dashOffset: flow,
        }
      );
    }

    const sp = toScreen(220, 515);
    drawSpeaker(ctx, sp.x, sp.y, 28 * s);

    if (errorFlash > 0) errorFlash -= 1;
  }

  function animComplete(now) {
    if (!litPath.length) return true;
    const newSegs = Math.max(0, litPath.length - traceAnim.fromCount);
    if (newSegs === 0) return true;
    return now - traceAnim.startedAt >= newSegs * segmentMs;
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

  /** @param {string[]} pathIds */
  function setHint(pathIds) {
    hintPath = pathIds ? pathIds.slice() : [];
    paint();
  }

  /** Duration of each trace segment's draw-in animation. */
  function setSegmentMs(ms) {
    segmentMs = Math.max(1, ms);
  }

  /** Fraction of the viewport height the card may occupy, capped at `maxPx`. */
  function setHeightRatio(ratio, maxPx = 600) {
    heightRatio = ratio;
    maxHeightPx = maxPx;
    resize();
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
    setHint,
    setHeightRatio,
    setSegmentMs,
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

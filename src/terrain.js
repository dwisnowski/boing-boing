export function buildTerrain(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Outward normal (toward sky). Points are authored left→right.
    segments.push({
      a,
      b,
      nx: dy / len,
      ny: -dx / len,
      len,
    });
  }
  return {
    points,
    segments,
    startX: points[0].x,
    endX: points[points.length - 1].x,
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

export function sampleTerrainY(terrain, x) {
  const { points } = terrain;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return points[points.length - 1].y;
}

export function sampleTerrainNormal(terrain, x) {
  for (const seg of terrain.segments) {
    if (x >= seg.a.x && x <= seg.b.x) {
      return { nx: seg.nx, ny: seg.ny };
    }
  }
  const last = terrain.segments[terrain.segments.length - 1];
  return { nx: last.nx, ny: last.ny };
}

/** Closest point on terrain polyline to a world point. */
export function closestOnTerrain(terrain, px, py) {
  let best = null;
  for (const seg of terrain.segments) {
    const { a, b } = seg;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = clamp(((px - a.x) * abx + (py - a.y) * aby) / (seg.len * seg.len), 0, 1);
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const dist = Math.hypot(px - cx, py - cy);
    if (!best || dist < best.dist) {
      best = { x: cx, y: cy, dist, nx: seg.nx, ny: seg.ny, t, seg };
    }
  }
  return best;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Build a downhill mountain from control humps. */
export function generateMountain({
  length = 4200,
  startY = 90,
  drop = 980,
  bumpiness = 1,
  seed = 1,
}) {
  const rand = mulberry32(seed);
  const points = [{ x: 0, y: startY }];
  let x = 0;
  let y = startY;
  const targetEnd = startY + drop;

  while (x < length) {
    const step = 90 + rand() * 70;
    x = Math.min(length, x + step);
    const progress = x / length;
    const baseline = startY + drop * (progress * progress * 0.55 + progress * 0.45);
    const bump =
      Math.sin(progress * 14 + seed) * 28 * bumpiness +
      Math.sin(progress * 37) * 16 * bumpiness +
      (rand() - 0.5) * 42 * bumpiness;
    y = baseline + bump;
    // Keep generally descending
    const prev = points[points.length - 1];
    if (y < prev.y - 8) y = prev.y - 8;
    points.push({ x, y });
  }

  points[points.length - 1].y = Math.max(points[points.length - 1].y, targetEnd);
  // Flat finish runway
  const finishY = points[points.length - 1].y;
  points.push({ x: length + 280, y: finishY + 8 });
  points.push({ x: length + 520, y: finishY + 10 });

  return buildTerrain(points);
}

function mulberry32(a) {
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

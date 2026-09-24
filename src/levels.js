import { generateMountain, sampleTerrainY } from "./terrain.js";

/** Long downhill stages (~5.5× the original lengths) with matching drop. */
export const LEVELS = [
  {
    id: "warm-up-ridge",
    name: "Warm-Up Ridge",
    blurb: "Learn to stick the landing.",
    seed: 11,
    length: 12100,
    drop: 8140,
    bumpiness: 0.45,
    chipHeights: [140, 190, 130, 240, 160, 210, 150, 260, 180, 220],
  },
  {
    id: "jagged-pass",
    name: "Jagged Pass",
    blurb: "Bumpy spines — bounce or bust.",
    seed: 27,
    length: 15950,
    drop: 11275,
    bumpiness: 1.05,
    chipHeights: [160, 230, 170, 280, 190, 250, 200, 300, 180, 270, 220],
  },
  {
    id: "skyhook-trail",
    name: "Skyhook Trail",
    blurb: "Hangtime heaven for microchip hunters.",
    seed: 44,
    length: 18150,
    drop: 13200,
    bumpiness: 0.95,
    chipHeights: [200, 300, 230, 340, 210, 280, 250, 360, 220, 310, 240, 330],
  },
  {
    id: "crumble-canyon",
    name: "Crumble Canyon",
    blurb: "Brutal drops. Pack armor.",
    seed: 63,
    length: 19800,
    drop: 15125,
    bumpiness: 1.25,
    chipHeights: [170, 240, 190, 300, 200, 260, 210, 320, 180, 280, 230, 340],
  },
  {
    id: "finale-spine",
    name: "Finale Spine",
    blurb: "The mountain's last laugh.",
    seed: 99,
    length: 22000,
    drop: 17600,
    bumpiness: 1.35,
    chipHeights: [200, 320, 240, 360, 220, 300, 260, 380, 210, 340, 250, 370],
  },
];

export function createLevel(levelDef) {
  const terrain = generateMountain({
    length: levelDef.length,
    drop: levelDef.drop,
    bumpiness: levelDef.bumpiness,
    seed: levelDef.seed,
    startY: 80,
  });

  const heights = levelDef.chipHeights || [100, 130, 100, 160];
  const chips = heights.map((height, i) => {
    const t = 0.06 + (i / Math.max(1, heights.length - 1)) * 0.88;
    const x = levelDef.length * t;
    const y = sampleTerrainY(terrain, x) - height;
    return { id: `c${levelDef.seed}-${i}`, x, y, r: 16, taken: false };
  });

  const finishX = terrain.endX - 180;
  const groundY = terrain.points[0].y;
  // High enough that a 75% first rebound is clearly visible. Near-upright and
  // low spin so the opening drop plants before tumble spin kicks in.
  const dropHeight = 360;

  return {
    def: levelDef,
    terrain,
    chips,
    finishX,
    spawn: {
      x: 60,
      y: groundY - dropHeight,
      groundY,
      dropHeight,
      vx: 70,
      vy: 0,
      angle: -0.12,
      spin: 0,
    },
  };
}

import { generateMountain, sampleTerrainY } from "./terrain.js";

export const LEVELS = [
  {
    id: "warm-up-ridge",
    name: "Warm-Up Ridge",
    blurb: "Learn to stick the landing.",
    seed: 11,
    length: 2200,
    drop: 1480,
    bumpiness: 0.45,
    chipHeights: [140, 190, 130, 240],
  },
  {
    id: "jagged-pass",
    name: "Jagged Pass",
    blurb: "Bumpy spines — bounce or bust.",
    seed: 27,
    length: 2900,
    drop: 2050,
    bumpiness: 1.05,
    chipHeights: [160, 230, 170, 280],
  },
  {
    id: "skyhook-trail",
    name: "Skyhook Trail",
    blurb: "Hangtime heaven for microchip hunters.",
    seed: 44,
    length: 3300,
    drop: 2400,
    bumpiness: 0.95,
    chipHeights: [200, 300, 230, 340],
  },
  {
    id: "crumble-canyon",
    name: "Crumble Canyon",
    blurb: "Brutal drops. Pack armor.",
    seed: 63,
    length: 3600,
    drop: 2750,
    bumpiness: 1.25,
    chipHeights: [170, 240, 190, 300],
  },
  {
    id: "finale-spine",
    name: "Finale Spine",
    blurb: "The mountain's last laugh.",
    seed: 99,
    length: 4000,
    drop: 3200,
    bumpiness: 1.35,
    chipHeights: [200, 320, 240, 360],
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

  const chips = (levelDef.chipHeights || [100, 130, 100, 160]).map((height, i) => {
    const t = 0.2 + (i / 4) * 0.65;
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

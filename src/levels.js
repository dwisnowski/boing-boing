import { generateMountain, sampleTerrainY } from "./terrain.js";

export const LEVELS = [
  {
    id: "warm-up-ridge",
    name: "Warm-Up Ridge",
    blurb: "Learn to stick the landing.",
    seed: 11,
    length: 2800,
    drop: 620,
    bumpiness: 0.55,
    chipHeights: [90, 120, 80, 150],
  },
  {
    id: "jagged-pass",
    name: "Jagged Pass",
    blurb: "Bumpy spines — bounce or bust.",
    seed: 27,
    length: 3800,
    drop: 880,
    bumpiness: 1.15,
    chipHeights: [100, 160, 110, 180],
  },
  {
    id: "skyhook-trail",
    name: "Skyhook Trail",
    blurb: "Hangtime heaven for microchip hunters.",
    seed: 44,
    length: 4200,
    drop: 960,
    bumpiness: 1.05,
    chipHeights: [150, 200, 170, 230],
  },
  {
    id: "crumble-canyon",
    name: "Crumble Canyon",
    blurb: "Brutal drops. Pack armor.",
    seed: 63,
    length: 4600,
    drop: 1100,
    bumpiness: 1.35,
    chipHeights: [110, 150, 130, 190],
  },
  {
    id: "finale-spine",
    name: "Finale Spine",
    blurb: "The mountain's last laugh.",
    seed: 99,
    length: 5200,
    drop: 1250,
    bumpiness: 1.45,
    chipHeights: [140, 210, 160, 240],
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

  return {
    def: levelDef,
    terrain,
    chips,
    finishX,
    spawn: {
      x: 60,
      y: terrain.points[0].y - 70,
      vx: 160,
      vy: 20,
      angle: -0.5,
      spin: 2.4,
    },
  };
}

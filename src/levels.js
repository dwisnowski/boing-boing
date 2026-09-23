import { generateMountain, sampleTerrainY } from "./terrain.js";

export const LEVELS = [
  {
    id: "warm-up-ridge",
    name: "Warm-Up Ridge",
    blurb: "Learn to stick the landing.",
    seed: 11,
    length: 2400,
    drop: 1180,
    bumpiness: 0.5,
    chipHeights: [120, 160, 110, 200],
  },
  {
    id: "jagged-pass",
    name: "Jagged Pass",
    blurb: "Bumpy spines — bounce or bust.",
    seed: 27,
    length: 3200,
    drop: 1680,
    bumpiness: 1.1,
    chipHeights: [140, 200, 150, 240],
  },
  {
    id: "skyhook-trail",
    name: "Skyhook Trail",
    blurb: "Hangtime heaven for microchip hunters.",
    seed: 44,
    length: 3600,
    drop: 1920,
    bumpiness: 1.0,
    chipHeights: [180, 260, 200, 300],
  },
  {
    id: "crumble-canyon",
    name: "Crumble Canyon",
    blurb: "Brutal drops. Pack armor.",
    seed: 63,
    length: 4000,
    drop: 2280,
    bumpiness: 1.3,
    chipHeights: [150, 210, 170, 260],
  },
  {
    id: "finale-spine",
    name: "Finale Spine",
    blurb: "The mountain's last laugh.",
    seed: 99,
    length: 4400,
    drop: 2680,
    bumpiness: 1.4,
    chipHeights: [180, 280, 210, 320],
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
      y: terrain.points[0].y - 90,
      vx: 180,
      vy: 30,
      angle: -0.55,
      spin: 2.2,
    },
  };
}

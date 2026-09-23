import { generateMountain } from "./terrain.js";

export const LEVELS = [
  {
    id: "warm-up-ridge",
    name: "Warm-Up Ridge",
    blurb: "Learn to stick the landing.",
    seed: 11,
    length: 2800,
    drop: 620,
    bumpiness: 0.55,
    chips: makeChipPlan(2800, 620, 11),
  },
  {
    id: "jagged-pass",
    name: "Jagged Pass",
    blurb: "Bumpy spines — bounce or bust.",
    seed: 27,
    length: 3800,
    drop: 880,
    bumpiness: 1.15,
    chips: makeChipPlan(3800, 880, 27),
  },
  {
    id: "skyhook-trail",
    name: "Skyhook Trail",
    blurb: "Hangtime heaven for microchip hunters.",
    seed: 44,
    length: 4200,
    drop: 960,
    bumpiness: 1.05,
    chips: makeChipPlan(4200, 960, 44, true),
  },
  {
    id: "crumble-canyon",
    name: "Crumble Canyon",
    blurb: "Brutal drops. Pack armor.",
    seed: 63,
    length: 4600,
    drop: 1100,
    bumpiness: 1.35,
    chips: makeChipPlan(4600, 1100, 63),
  },
  {
    id: "finale-spine",
    name: "Finale Spine",
    blurb: "The mountain's last laugh.",
    seed: 99,
    length: 5200,
    drop: 1250,
    bumpiness: 1.45,
    chips: makeChipPlan(5200, 1250, 99, true),
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

  const chips = levelDef.chips.map((c) => ({
    ...c,
    taken: false,
  }));

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

function makeChipPlan(length, drop, seed, high = false) {
  const chips = [];
  const count = 4;
  for (let i = 0; i < count; i += 1) {
    const t = 0.18 + (i / count) * 0.7;
    const x = length * t;
    const baseY = 80 + drop * (t * t * 0.55 + t * 0.45);
    const float = high ? 140 + (i % 2) * 50 : 70 + (seed % 5) * 8 + (i % 2) * 35;
    chips.push({
      id: `c${seed}-${i}`,
      x,
      y: baseY - float,
      r: 14,
    });
  }
  return chips;
}

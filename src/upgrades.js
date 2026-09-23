const STORAGE_KEY = "boing-boing-save-v1";

export const UPGRADE_DEFS = [
  {
    id: "stamina",
    name: "Stamina / Armor",
    blurb: "Raises the impact needed before a bad landing sheds a limb.",
    max: 5,
    baseCost: 3,
  },
  {
    id: "spin",
    name: "Spin",
    blurb: "Faster mid-air tumble for snappier flips.",
    max: 5,
    baseCost: 3,
  },
  {
    id: "jump",
    name: "Jump Springs",
    blurb: "Harder foot landings launch you higher and farther.",
    max: 5,
    baseCost: 4,
  },
  {
    id: "explosion",
    name: "Explosion",
    blurb: "Stronger tin-head desperation launch.",
    max: 5,
    baseCost: 4,
  },
];

const DEFAULT_SAVE = {
  chips: 0,
  tournamentIndex: 0,
  upgrades: { stamina: 0, spin: 0, jump: 0, explosion: 0 },
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      upgrades: { ...DEFAULT_SAVE.upgrades, ...(parsed.upgrades || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(save) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function upgradeCost(def, level) {
  return def.baseCost + level * 2;
}

export function statsFromUpgrades(upgrades) {
  const s = upgrades.stamina;
  const sp = upgrades.spin;
  const j = upgrades.jump;
  const e = upgrades.explosion;
  return {
    // Soft scrapes below this impact do not shed appendages
    limbLossThreshold: 110 + s * 28,
    spinRate: 3.4 + sp * 0.55,
    brakeStrength: 10 + sp * 1.2,
    bounce: 1 + j * 0.18,
    explosionPower: 780 + e * 160,
  };
}

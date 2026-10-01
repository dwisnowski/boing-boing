/**
 * Morse Trainer Card — photo-accurate PCB face with LED overlays.
 * Node positions are %-based over the cropped physical card image.
 */

/** LED centers as percentages of the card face (x right, y down). */
export const LED_POSITIONS = {
  // Top dit rail (right of antenna): E — I — S — H
  E: { x: 63.0, y: 29.5 },
  I: { x: 73.5, y: 29.5 },
  S: { x: 83.5, y: 29.5 },
  H: { x: 92.0, y: 29.5 },
  // Dash rail (left of / under antenna): O — M — T
  O: { x: 21.0, y: 43.5 },
  M: { x: 35.5, y: 43.5 },
  T: { x: 51.5, y: 43.5 },
  // Under M
  Q: { x: 20.0, y: 55.5 },
  G: { x: 35.5, y: 55.5 },
  Z: { x: 35.5, y: 67.5 },
  // Under I / S
  U: { x: 73.5, y: 46.0 },
  V: { x: 83.5, y: 46.0 },
  F: { x: 73.5, y: 58.0 },
  // Center spine under T: N → D → B
  N: { x: 52.5, y: 64.5 },
  D: { x: 52.5, y: 78.0 },
  B: { x: 52.5, y: 89.0 },
  // Left of N / D
  Y: { x: 26.5, y: 64.5 },
  K: { x: 42.5, y: 64.5 },
  C: { x: 42.5, y: 76.5 },
  X: { x: 42.5, y: 86.0 },
  // Right spine under E: A → W → J
  A: { x: 63.0, y: 48.5 },
  R: { x: 78.5, y: 48.5 },
  L: { x: 90.5, y: 48.5 },
  W: { x: 63.0, y: 68.5 },
  P: { x: 80.5, y: 68.5 },
  J: { x: 63.0, y: 85.5 },
};

const LETTERS = Object.keys(LED_POSITIONS);

/**
 * @param {HTMLElement} mount
 */
export function createBoard(mount) {
  mount.innerHTML = "";
  mount.classList.add("morse-board");

  const face = document.createElement("div");
  face.className = "morse-card-face";

  const img = document.createElement("img");
  img.src = "./src/assets/morse-card-face.jpg";
  img.alt = "Morse Code Trainer Card";
  img.className = "morse-card-img";
  img.draggable = false;
  face.appendChild(img);

  const ledLayer = document.createElement("div");
  ledLayer.className = "morse-led-layer";
  ledLayer.setAttribute("aria-hidden", "true");

  /** @type {Map<string, HTMLElement>} */
  const leds = new Map();
  for (const id of LETTERS) {
    const pos = LED_POSITIONS[id];
    const el = document.createElement("span");
    el.className = "morse-led-dot";
    el.dataset.node = id;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
    ledLayer.appendChild(el);
    leds.set(id, el);
  }
  face.appendChild(ledLayer);
  mount.appendChild(face);

  /** @type {Set<string>} */
  let lit = new Set();
  /** @type {string | null} */
  let current = null;

  /**
   * @param {string[]} pathIds
   * @param {string | null} currentId
   */
  function setPath(pathIds, currentId = null) {
    lit = new Set(pathIds);
    current = currentId || (pathIds.length ? pathIds[pathIds.length - 1] : null);
    paint();
  }

  function clearPath() {
    lit = new Set();
    current = null;
    paint();
  }

  function flashError() {
    face.classList.add("morse-board-error");
    setTimeout(() => face.classList.remove("morse-board-error"), 280);
  }

  function paint() {
    const order = [...lit];
    for (const [id, el] of leds) {
      const on = lit.has(id);
      el.classList.toggle("is-lit", on);
      el.classList.toggle("is-current", id === current);
      if (!on) {
        el.classList.remove("led-red", "led-green");
        continue;
      }
      const idx = order.indexOf(id);
      // Alternate red / green along the path like the physical card LEDs
      el.classList.toggle("led-green", idx % 2 === 1);
      el.classList.toggle("led-red", idx % 2 === 0);
    }
  }

  return {
    face,
    setPath,
    clearPath,
    flashError,
    LED_POSITIONS,
  };
}

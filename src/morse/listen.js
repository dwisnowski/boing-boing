/**
 * Listen mode: hear and watch a phrase keyed at a chosen speed, timing,
 * fist and cadence, with per-character patterns and a rhythm strip.
 * Also exports the shared listen settings store and settings row.
 */

import { CATEGORIES, DRILLS, tokenize } from "./drills.js";
import { drawRhythmStrip } from "./player.js";
import {
  CADENCES,
  CHAR_SPEEDS,
  DEFAULT_LISTEN_SETTINGS,
  FISTS,
  SPEEDS,
  TIMINGS,
  buildSchedule,
} from "./sender.js";
import { MORSE_CODES, patternFor } from "./tree.js";

const SETTINGS_KEY = "morse.listen.settings";
const LISTEN_CATEGORIES = CATEGORIES.filter((c) => c.id !== "missed");

const isKnown = (token) => Object.prototype.hasOwnProperty.call(MORSE_CODES, token);

/** @returns {import("./sender.js").ListenSettings} */
export function loadListenSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_LISTEN_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_LISTEN_SETTINGS };
  } catch {
    return { ...DEFAULT_LISTEN_SETTINGS };
  }
}

/** @param {import("./sender.js").ListenSettings} settings */
export function saveListenSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function pill(label, pressed, onClick, title) {
  const btn = el("button", "mp-pill", label);
  btn.type = "button";
  btn.setAttribute("aria-pressed", pressed ? "true" : "false");
  if (title) btn.title = title;
  btn.addEventListener("click", (e) => {
    onClick();
    /** @type {HTMLElement} */ (e.currentTarget).blur();
  });
  return btn;
}

function group(label, children, visibleLabel = "") {
  const wrap = el("div", "mp-group");
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", label);
  if (visibleLabel) wrap.appendChild(el("span", "mp-group-label", visibleLabel));
  for (const c of children) wrap.appendChild(c);
  return wrap;
}

/**
 * Render the speed / timing / fist / cadence pills into `container`.
 * @param {HTMLElement} container
 * @param {import("./sender.js").ListenSettings} settings
 * @param {(key: string, value: unknown) => void} onChange
 * @param {HTMLElement[]} [extras] additional groups appended at the end
 */
export function renderListenConfig(container, settings, onChange, extras = []) {
  container.innerHTML = "";
  container.appendChild(
    group(
      "Speed",
      SPEEDS.map((n) => pill(String(n), settings.wpm === n, () => onChange("wpm", n))),
      "wpm"
    )
  );
  container.appendChild(
    group(
      "Timing",
      TIMINGS.map((t) => pill(t.label, settings.timing === t.id, () => onChange("timing", t.id), t.title))
    )
  );
  if (settings.timing === "farnsworth") {
    container.appendChild(
      group(
        "Character speed",
        CHAR_SPEEDS.map((n) =>
          pill(String(n), settings.charWpm === n, () => onChange("charWpm", n), `Characters at ${n} WPM`)
        ),
        "chars at"
      )
    );
  }
  container.appendChild(
    group(
      "Fist",
      FISTS.map((f) => pill(f.label, settings.fist === f.id, () => onChange("fist", f.id), f.title)),
      "fist"
    )
  );
  container.appendChild(
    group(
      "Cadence",
      CADENCES.map((c) => pill(c.label, settings.cadence === c.id, () => onChange("cadence", c.id), c.title)),
      "cadence"
    )
  );
  for (const extra of extras) container.appendChild(extra);
}

/** One-line description of the effective timing, e.g. for a status line. */
export function describeSchedule(schedule, settings) {
  const farnsworth = settings.timing === "farnsworth" && settings.wpm < settings.charWpm;
  const speed = farnsworth ? `${settings.charWpm}/${settings.wpm} wpm farnsworth` : `${settings.wpm} wpm`;
  return `${speed} · ${settings.fist} · ${(schedule.totalMs / 1000).toFixed(1)}s`;
}

/**
 * @param {{
 *   root: HTMLElement,
 *   player: ReturnType<typeof import("./player.js").createPlayer>,
 *   onKeyItNow: (category: string) => void,
 * }} opts
 */
export function createListen(opts) {
  const { root, player } = opts;
  const configEl = /** @type {HTMLElement} */ (root.querySelector(".ml-config"));
  const pickerEl = /** @type {HTMLElement} */ (root.querySelector(".ml-picker"));
  const glossEl = /** @type {HTMLElement} */ (root.querySelector(".ml-gloss"));
  const phraseEl = /** @type {HTMLElement} */ (root.querySelector(".ml-phrase"));
  const stripEl = /** @type {HTMLCanvasElement} */ (root.querySelector(".ml-strip"));
  const infoEl = /** @type {HTMLElement} */ (root.querySelector(".ml-info"));
  const playBtn = /** @type {HTMLButtonElement} */ (root.querySelector(".ml-play"));
  const loopBtn = /** @type {HTMLButtonElement} */ (root.querySelector(".ml-loop"));
  const keyItBtn = /** @type {HTMLButtonElement} */ (root.querySelector(".ml-keyit"));

  let settings = loadListenSettings();
  let active = false;
  let category = "all";
  /** @type {import("./drills.js").Drill[]} */
  let list = DRILLS.slice();
  let index = 0;
  /** @type {import("./sender.js").Schedule | null} */
  let schedule = null;

  function drill() {
    return list[index] || DRILLS[0];
  }

  function words() {
    return tokenize(drill().text, isKnown);
  }

  function setSetting(key, value) {
    settings = { ...settings, [key]: value };
    saveListenSettings(settings);
    renderConfig();
    const wasPlaying = player.isPlaying();
    refresh();
    if (wasPlaying && key !== "loop") play();
  }

  function renderConfig() {
    renderListenConfig(configEl, settings, setSetting);
    loopBtn.setAttribute("aria-pressed", settings.loop ? "true" : "false");
  }

  function renderPicker() {
    pickerEl.innerHTML = "";
    pickerEl.appendChild(
      group(
        "Category",
        LISTEN_CATEGORIES.map((c) =>
          pill(c.label, category === c.id, () => {
            category = c.id;
            list = c.id === "all" ? DRILLS.slice() : DRILLS.filter((d) => d.category === c.id);
            index = 0;
            renderPicker();
            changePhrase();
          })
        )
      )
    );
    const nav = el("div", "mp-group ml-nav");
    nav.appendChild(pill("‹ prev", false, () => step(-1)));
    nav.appendChild(el("span", "mp-group-label ml-count", `${index + 1}/${list.length}`));
    nav.appendChild(pill("next ›", false, () => step(1)));
    nav.appendChild(
      pill("shuffle", false, () => {
        index = Math.floor(Math.random() * list.length);
        renderPicker();
        changePhrase();
      })
    );
    pickerEl.appendChild(nav);
  }

  function step(delta) {
    index = (index + delta + list.length) % list.length;
    renderPicker();
    changePhrase();
  }

  function changePhrase() {
    const wasPlaying = player.isPlaying();
    player.stop();
    refresh();
    if (wasPlaying) play();
  }

  /** Rebuild the phrase display and static strip for the current settings. */
  function refresh() {
    schedule = buildSchedule(words(), settings);
    glossEl.textContent = drill().meaning;
    phraseEl.innerHTML = "";
    schedule.words.forEach((word, wi) => {
      const wordEl = el("span", "ml-word");
      word.forEach((token, ci) => {
        const cell = el("span", "ml-cell");
        cell.dataset.w = String(wi);
        cell.dataset.c = String(ci);
        const ch = el("span", "ml-char", token.replace(/[<>]/g, ""));
        if (token.length > 1) ch.classList.add("ch-prosign");
        cell.appendChild(ch);
        cell.appendChild(el("span", "ml-pattern", patternFor(token).replace(/ /g, "")));
        wordEl.appendChild(cell);
      });
      phraseEl.appendChild(wordEl);
    });
    const original = drill().text;
    const sent = schedule.words.map((w) => w.join("")).join(" ");
    infoEl.textContent =
      describeSchedule(schedule, settings) + (sent !== original ? ` · sent as ${sent.replace(/[<>]/g, "")}` : "");
    drawRhythmStrip(stripEl, schedule, -1);
  }

  function highlight(span) {
    for (const c of phraseEl.querySelectorAll(".ml-cell.is-playing")) c.classList.remove("is-playing");
    if (!span) return;
    const cell = phraseEl.querySelector(`.ml-cell[data-w="${span.wordIndex}"][data-c="${span.charIndex}"]`);
    cell?.classList.add("is-playing");
    for (const c of phraseEl.querySelectorAll(".ml-cell")) {
      const w = Number(c.dataset.w);
      const ci = Number(c.dataset.c);
      c.classList.toggle("is-heard", w < span.wordIndex || (w === span.wordIndex && ci < span.charIndex));
    }
  }

  function play() {
    for (const c of phraseEl.querySelectorAll(".ml-cell")) c.classList.remove("is-heard");
    schedule = player.play(words(), settings, {
      onStart: () => {
        for (const c of phraseEl.querySelectorAll(".ml-cell")) c.classList.remove("is-heard");
      },
      onChar: (span) => highlight(span),
      onFrame: (ms, sched) => drawRhythmStrip(stripEl, sched, ms),
      onDone: () => {
        playBtn.textContent = "Play";
        playBtn.classList.remove("is-active");
        for (const c of phraseEl.querySelectorAll(".ml-cell")) c.classList.remove("is-heard");
        drawRhythmStrip(stripEl, schedule, -1);
      },
      shouldLoop: () => active && settings.loop,
    });
    playBtn.textContent = "Stop";
    playBtn.classList.add("is-active");
  }

  function togglePlay() {
    if (player.isPlaying()) player.stop();
    else play();
  }

  playBtn.addEventListener("click", (e) => {
    togglePlay();
    /** @type {HTMLElement} */ (e.currentTarget).blur();
  });
  loopBtn.addEventListener("click", (e) => {
    setSetting("loop", !settings.loop);
    /** @type {HTMLElement} */ (e.currentTarget).blur();
  });
  keyItBtn.addEventListener("click", () => {
    player.stop();
    opts.onKeyItNow(category);
  });

  function onKey(e) {
    if (!active || e.repeat) return;
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  }
  window.addEventListener("keydown", onKey);

  function activate() {
    active = true;
    root.hidden = false;
    settings = loadListenSettings();
    renderConfig();
    renderPicker();
    requestAnimationFrame(refresh);
  }

  function deactivate() {
    active = false;
    player.stop();
    root.hidden = true;
  }

  function resize() {
    if (active && !player.isPlaying()) drawRhythmStrip(stripEl, schedule, -1);
  }

  return { activate, deactivate, resize };
}

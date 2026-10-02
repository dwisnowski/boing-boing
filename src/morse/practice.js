/**
 * Monkeytype-style send practice: key a target phrase, see each decoded
 * character marked correct / wrong / extra / missed, then review stats.
 */

import { CATEGORIES, DRILLS, tokenize } from "./drills.js";
import { MORSE_CODES, nodeForToken, pathIdsTo, patternFor } from "./tree.js";

const SETTINGS_KEY = "morse.practice.settings";
const MISSED_KEY = "morse.practice.missed";
const PB_KEY = "morse.practice.pb";

const PHRASE_COUNTS = [5, 10, 25];
const TIME_LIMITS = [30, 60, 120];

/**
 * @typedef {{
 *   mode: "phrases" | "time",
 *   phrases: number,
 *   time: number,
 *   category: string,
 *   stopOnError: "off" | "letter" | "word",
 *   indicateTypo: boolean,
 *   errorSound: boolean,
 *   hint: boolean,
 * }} PracticeSettings
 */

/** @type {PracticeSettings} */
const DEFAULT_SETTINGS = {
  mode: "phrases",
  phrases: 10,
  time: 60,
  category: "all",
  stopOnError: "off",
  indicateTypo: true,
  errorSound: true,
  hint: false,
};

/**
 * @typedef {{
 *   target: string[],
 *   typed: string[],
 *   done: boolean,
 *   errored: boolean,
 *   text: string,
 * }} WordState
 */

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const isKnown = (token) => Object.prototype.hasOwnProperty.call(MORSE_CODES, token);

function displayToken(token) {
  return token.replace(/[<>]/g, "");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {{
 *   root: HTMLElement,
 *   setHint: (pathIds: string[]) => void,
 *   flashError: () => void,
 *   errorBeep: () => void,
 * }} opts
 */
export function createPractice(opts) {
  const { root } = opts;
  const configEl = /** @type {HTMLElement} */ (root.querySelector(".mp-config"));
  const liveEl = /** @type {HTMLElement} */ (root.querySelector(".mp-live"));
  const testEl = /** @type {HTMLElement} */ (root.querySelector(".mp-test"));
  const glossEl = /** @type {HTMLElement} */ (root.querySelector(".mp-gloss"));
  const wordsEl = /** @type {HTMLElement} */ (root.querySelector(".mp-words"));
  const nextEl = /** @type {HTMLElement} */ (root.querySelector(".mp-next"));
  const upNextEl = /** @type {HTMLElement} */ (root.querySelector(".mp-upnext"));
  const resultsEl = /** @type {HTMLElement} */ (root.querySelector(".mp-results"));
  const statsEl = /** @type {HTMLElement} */ (root.querySelector(".mp-stats"));
  const chartEl = /** @type {HTMLCanvasElement} */ (root.querySelector(".mp-chart"));
  const missesEl = /** @type {HTMLElement} */ (root.querySelector(".mp-misses"));
  const restartBtn = /** @type {HTMLElement} */ (root.querySelector(".mp-restart"));

  /** @type {PracticeSettings} */
  let settings = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS);
  /** @type {Record<string, number>} */
  let missedWords = loadJson(MISSED_KEY, {});
  /** @type {Record<string, number>} */
  let personalBests = loadJson(PB_KEY, {});

  /** @type {"ready" | "running" | "done"} */
  let state = "ready";
  let active = false;
  let usingMissedFallback = false;

  /** @type {import("./drills.js").Drill[]} */
  let queue = [];
  let phraseIndex = 0;
  /** @type {WordState[]} */
  let words = [];
  let wordIndex = 0;

  let startedAt = 0;
  let endedAt = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let ticker = null;
  let stats = freshStats();

  function freshStats() {
    return {
      correct: 0,
      incorrect: 0,
      extra: 0,
      missed: 0,
      rejected: 0,
      spaces: 0,
      /** @type {{ wpm: number, raw: number, errors: number }[]} */
      samples: [],
      /** @type {Record<number, number>} */
      errorsBySecond: {},
      /** @type {Record<string, number>} */
      charMisses: {},
    };
  }

  // —— Config ——

  function setSetting(key, value) {
    settings = { ...settings, [key]: value };
    saveJson(SETTINGS_KEY, settings);
    renderConfig();
    if (key === "hint" || key === "indicateTypo") {
      renderWords();
      updateHint();
    } else if (key !== "errorSound") {
      restart();
    }
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

  function group(label, children) {
    const wrap = el("div", "mp-group");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", label);
    for (const c of children) wrap.appendChild(c);
    return wrap;
  }

  function renderConfig() {
    configEl.innerHTML = "";
    configEl.appendChild(
      group("Test mode", [
        pill("phrases", settings.mode === "phrases", () => setSetting("mode", "phrases")),
        pill("time", settings.mode === "time", () => setSetting("mode", "time")),
      ])
    );
    configEl.appendChild(
      settings.mode === "phrases"
        ? group(
            "Phrase count",
            PHRASE_COUNTS.map((n) =>
              pill(String(n), settings.phrases === n, () => setSetting("phrases", n))
            )
          )
        : group(
            "Time limit",
            TIME_LIMITS.map((n) =>
              pill(`${n}s`, settings.time === n, () => setSetting("time", n))
            )
          )
    );
    configEl.appendChild(
      group(
        "Category",
        CATEGORIES.map((c) =>
          pill(c.label, settings.category === c.id, () => setSetting("category", c.id))
        )
      )
    );
    configEl.appendChild(
      group("Stop on error", [
        el("span", "mp-group-label", "stop on error"),
        ...["off", "letter", "word"].map((v) =>
          pill(v, settings.stopOnError === v, () => setSetting("stopOnError", v))
        ),
      ])
    );
    configEl.appendChild(
      group("Feedback", [
        pill("typo", settings.indicateTypo, () => setSetting("indicateTypo", !settings.indicateTypo), "Show the keyed character under a mistake"),
        pill("sound", settings.errorSound, () => setSetting("errorSound", !settings.errorSound), "Buzz on errors"),
        pill("hint", settings.hint, () => setSetting("hint", !settings.hint), "Show the pattern and card path for the next character"),
      ])
    );
  }

  // —— Phrase queue ——

  function buildPool() {
    usingMissedFallback = false;
    if (settings.category === "missed") {
      const missed = Object.entries(missedWords)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 40)
        .map(([word]) => {
          const known = DRILLS.find((d) => d.text === word);
          return {
            text: word,
            meaning: known ? known.meaning : "Previously missed",
            category: known ? known.category : "abbrev",
          };
        });
      if (missed.length) return missed;
      usingMissedFallback = true;
      return DRILLS.slice();
    }
    if (settings.category === "all") return DRILLS.slice();
    return DRILLS.filter((d) => d.category === settings.category);
  }

  function buildQueue() {
    const pool = buildPool();
    const count = settings.mode === "phrases" ? settings.phrases : Math.max(30, pool.length);
    const out = [];
    while (out.length < count) out.push(...shuffle(pool));
    return out.slice(0, count);
  }

  function loadPhrase(index) {
    phraseIndex = index;
    if (phraseIndex >= queue.length) queue.push(...shuffle(buildPool()));
    const drill = queue[phraseIndex];
    words = tokenize(drill.text, isKnown).map((target) => ({
      target,
      typed: [],
      done: false,
      errored: false,
      text: target.join(""),
    }));
    wordIndex = 0;
    renderWords();
    updateHint();
  }

  // —— Run lifecycle ——

  function restart() {
    stopTicker();
    state = "ready";
    stats = freshStats();
    startedAt = 0;
    endedAt = 0;
    queue = buildQueue();
    root.classList.remove("is-running", "is-done");
    resultsEl.hidden = true;
    testEl.hidden = false;
    loadPhrase(0);
    renderLive();
  }

  function start() {
    if (state !== "ready") return;
    state = "running";
    startedAt = performance.now();
    root.classList.add("is-running");
    ticker = setInterval(tick, 1000);
    renderLive();
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function elapsedMs() {
    if (!startedAt) return 0;
    return (endedAt || performance.now()) - startedAt;
  }

  function wpmFor(chars, ms) {
    if (ms <= 0) return 0;
    return chars / 5 / (ms / 60000);
  }

  function correctChars() {
    return stats.correct + stats.spaces;
  }

  function rawChars() {
    return stats.correct + stats.incorrect + stats.extra + stats.spaces;
  }

  function tick() {
    if (state !== "running") return;
    const ms = elapsedMs();
    const second = stats.samples.length + 1;
    stats.samples.push({
      wpm: wpmFor(correctChars(), second * 1000),
      raw: wpmFor(rawChars(), second * 1000),
      errors: stats.errorsBySecond[second - 1] || 0,
    });
    if (settings.mode === "time" && ms >= settings.time * 1000) {
      finish();
      return;
    }
    renderLive();
  }

  function finish() {
    if (state !== "running") return;
    endedAt = performance.now();
    if (settings.mode === "time") endedAt = Math.min(endedAt, startedAt + settings.time * 1000);
    state = "done";
    stopTicker();
    const lastSecond = Math.ceil(elapsedMs() / 1000);
    while (stats.samples.length < lastSecond) {
      const second = stats.samples.length + 1;
      const ms = Math.min(second * 1000, elapsedMs());
      stats.samples.push({
        wpm: wpmFor(correctChars(), ms),
        raw: wpmFor(rawChars(), ms),
        errors: stats.errorsBySecond[second - 1] || 0,
      });
    }
    saveJson(MISSED_KEY, missedWords);
    opts.setHint([]);
    root.classList.remove("is-running");
    root.classList.add("is-done");
    testEl.hidden = true;
    resultsEl.hidden = false;
    renderResults();
    renderLive();
  }

  // —— Input from the trainer ——

  function markError(expected) {
    const second = Math.floor(elapsedMs() / 1000);
    stats.errorsBySecond[second] = (stats.errorsBySecond[second] || 0) + 1;
    if (expected) stats.charMisses[expected] = (stats.charMisses[expected] || 0) + 1;
    if (settings.errorSound) opts.errorBeep();
  }

  function handleKeyDown() {
    if (!active) return;
    if (state === "ready") start();
  }

  /**
   * @param {string} token
   * @returns {boolean} false to reject the character
   */
  function handleCommit(token) {
    if (!active || state === "done") return true;
    if (state === "ready") start();
    const word = words[wordIndex];
    if (!word) return true;
    const pos = word.typed.length;
    const expected = word.target[pos];

    if (settings.stopOnError === "letter" && token !== expected) {
      stats.rejected += 1;
      word.errored = true;
      markError(expected);
      renderWords();
      return false;
    }

    word.typed.push(token);
    if (expected == null) {
      stats.extra += 1;
      word.errored = true;
      markError(null);
    } else if (token === expected) {
      stats.correct += 1;
    } else {
      stats.incorrect += 1;
      word.errored = true;
      markError(expected);
    }

    const complete = word.typed.length === word.target.length;
    const clean = complete && word.typed.every((t, i) => t === word.target[i]);
    if (clean) advanceWord();
    else {
      renderWords();
      updateHint();
    }
    renderLive();
    return true;
  }

  function handleWordGap() {
    if (!active || state !== "running") return;
    const word = words[wordIndex];
    if (!word || word.typed.length === 0) return;

    const clean =
      word.typed.length === word.target.length &&
      word.typed.every((t, i) => t === word.target[i]);
    if (settings.stopOnError === "word" && !clean) {
      word.typed = [];
      word.errored = true;
      markError(null);
      opts.flashError();
      renderWords();
      updateHint();
      return;
    }
    advanceWord();
    renderLive();
  }

  function advanceWord() {
    const word = words[wordIndex];
    for (let i = word.typed.length; i < word.target.length; i++) {
      stats.missed += 1;
      word.errored = true;
      stats.charMisses[word.target[i]] = (stats.charMisses[word.target[i]] || 0) + 1;
    }
    word.done = true;
    recordWordResult(word);
    wordIndex += 1;
    if (wordIndex >= words.length) {
      if (!word.errored) stats.spaces += 1;
      const nextIndex = phraseIndex + 1;
      if (settings.mode === "phrases" && nextIndex >= queue.length) {
        finish();
        return;
      }
      loadPhrase(nextIndex);
      return;
    }
    if (!word.errored) stats.spaces += 1;
    renderWords();
    updateHint();
  }

  function recordWordResult(word) {
    const key = word.target.join("");
    if (word.errored) {
      missedWords[key] = (missedWords[key] || 0) + 1;
    } else if (missedWords[key]) {
      missedWords[key] -= 1;
      if (missedWords[key] <= 0) delete missedWords[key];
    }
  }

  // —— Rendering ——

  function expectedToken() {
    const word = words[wordIndex];
    if (!word) return null;
    return word.target[word.typed.length] ?? null;
  }

  function updateHint() {
    const token = expectedToken();
    if (!settings.hint || !token || state === "done") {
      opts.setHint([]);
      nextEl.textContent = "";
      nextEl.hidden = true;
      return;
    }
    const node = nodeForToken(token);
    opts.setHint(node ? pathIdsTo(node) : []);
    nextEl.hidden = false;
    nextEl.textContent = `${displayToken(token)}  ${patternFor(token)}`;
  }

  function charSpan(target, typed, status) {
    const span = el("span", `ch ch-${status}`, displayToken(target));
    if (target.length > 1) span.classList.add("ch-prosign");
    if (status === "wrong" && settings.indicateTypo && typed) {
      span.appendChild(el("span", "ch-typo", displayToken(typed)));
    }
    return span;
  }

  function renderWords() {
    const drill = queue[phraseIndex];
    glossEl.textContent = drill
      ? usingMissedFallback
        ? `${drill.meaning} · no missed words yet, drilling all`
        : drill.meaning
      : "";
    wordsEl.innerHTML = "";
    words.forEach((word, wi) => {
      const wordEl = el("span", "mp-word");
      if (wi === wordIndex && state !== "done") wordEl.classList.add("is-active");
      if (word.done && word.errored) wordEl.classList.add("is-errored");
      word.target.forEach((target, i) => {
        if (wi === wordIndex && i === word.typed.length) wordEl.appendChild(el("span", "mp-caret"));
        const typed = word.typed[i];
        let status = "pending";
        if (typed != null) status = typed === target ? "correct" : "wrong";
        else if (word.done) status = "missed";
        wordEl.appendChild(charSpan(target, typed, status));
      });
      for (let i = word.target.length; i < word.typed.length; i++) {
        const extra = el("span", "ch ch-extra", displayToken(word.typed[i]));
        if (word.typed[i].length > 1) extra.classList.add("ch-prosign");
        wordEl.appendChild(extra);
      }
      if (wi === wordIndex && word.typed.length >= word.target.length) {
        wordEl.appendChild(el("span", "mp-caret"));
      }
      wordsEl.appendChild(wordEl);
    });

    const upcoming = queue[phraseIndex + 1];
    const showUpNext = upcoming && (settings.mode === "time" || phraseIndex + 1 < queue.length);
    upNextEl.textContent = showUpNext ? `next: ${upcoming.text.replace(/[<>]/g, "")}` : "";
  }

  function renderLive() {
    if (state === "done") {
      liveEl.textContent = "";
      return;
    }
    const progress =
      settings.mode === "time"
        ? `${Math.max(0, Math.ceil(settings.time - elapsedMs() / 1000))}s`
        : `${Math.min(phraseIndex + 1, queue.length)}/${queue.length}`;
    const wpm = state === "running" ? Math.round(wpmFor(correctChars(), elapsedMs())) : 0;
    liveEl.textContent =
      state === "ready" ? `${progress} · key to start` : `${progress} · ${wpm} wpm`;
  }

  function pbKey() {
    const amount = settings.mode === "time" ? `${settings.time}s` : settings.phrases;
    return `${settings.mode}-${amount}-${settings.category}`;
  }

  function stat(label, value, big = false, title = "") {
    const cell = el("div", big ? "mp-stat mp-stat-big" : "mp-stat");
    if (title) cell.title = title;
    cell.appendChild(el("span", "mp-stat-label", label));
    cell.appendChild(el("span", "mp-stat-value", value));
    return cell;
  }

  function renderResults() {
    const ms = elapsedMs();
    const wpm = wpmFor(correctChars(), ms);
    const raw = wpmFor(rawChars(), ms);
    const attempts = stats.correct + stats.incorrect + stats.extra + stats.rejected;
    const acc = attempts ? (stats.correct / attempts) * 100 : 0;

    const key = pbKey();
    const prevBest = personalBests[key] || 0;
    const isPb = wpm > prevBest && stats.correct > 0;
    if (isPb) {
      personalBests = { ...personalBests, [key]: Math.round(wpm * 10) / 10 };
      saveJson(PB_KEY, personalBests);
    }

    statsEl.innerHTML = "";
    statsEl.appendChild(stat("wpm", wpm.toFixed(1), true));
    statsEl.appendChild(stat("acc", `${Math.round(acc)}%`, true));
    statsEl.appendChild(stat("raw", raw.toFixed(1)));
    statsEl.appendChild(
      stat(
        "characters",
        `${stats.correct}/${stats.incorrect + stats.rejected}/${stats.extra}/${stats.missed}`,
        false,
        "correct / incorrect / extra / missed"
      )
    );
    statsEl.appendChild(stat("time", `${Math.round(ms / 1000)}s`));
    statsEl.appendChild(
      stat("pb", isPb ? `${wpm.toFixed(1)} new!` : prevBest ? prevBest.toFixed(1) : "—")
    );

    missesEl.innerHTML = "";
    const misses = Object.entries(stats.charMisses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (misses.length) {
      missesEl.appendChild(el("p", "mp-misses-title", "missed characters"));
      const list = el("ul", "mp-miss-list");
      for (const [token, count] of misses) {
        const item = el("li", "mp-miss");
        const ch = el("span", "mp-miss-char", displayToken(token));
        if (token.length > 1) ch.classList.add("ch-prosign");
        item.appendChild(ch);
        item.appendChild(el("span", "mp-miss-pattern", patternFor(token)));
        item.appendChild(el("span", "mp-miss-count", `×${count}`));
        list.appendChild(item);
      }
      missesEl.appendChild(list);
    }

    requestAnimationFrame(drawChart);
  }

  function drawChart() {
    const ctx = chartEl.getContext("2d");
    if (!ctx) return;
    const cssW = chartEl.clientWidth || 300;
    const cssH = chartEl.clientHeight || 120;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    chartEl.width = Math.floor(cssW * dpr);
    chartEl.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const samples = stats.samples;
    if (!samples.length) return;
    const padL = 26;
    const padR = 8;
    const padT = 8;
    const padB = 18;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;
    const maxY = Math.max(10, ...samples.map((s) => Math.max(s.wpm, s.raw))) * 1.15;
    const xFor = (i) => padL + (samples.length === 1 ? w / 2 : (i / (samples.length - 1)) * w);
    const yFor = (v) => padT + h - (v / maxY) * h;

    ctx.font = '10px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = "rgba(214, 199, 161, 0.6)";
    ctx.strokeStyle = "rgba(214, 199, 161, 0.15)";
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const frac of [0, 0.5, 1]) {
      const v = (maxY / 1.15) * frac;
      const y = yFor(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + w, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), padL - 4, y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("1s", xFor(0), padT + h + 4);
    if (samples.length > 1) ctx.fillText(`${samples.length}s`, xFor(samples.length - 1), padT + h + 4);

    const line = (key, color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.beginPath();
      samples.forEach((s, i) => {
        const x = xFor(i);
        const y = yFor(s[key]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    line("raw", "rgba(214, 199, 161, 0.4)", 1.5);
    line("wpm", "#ffd45a", 2.2);

    ctx.strokeStyle = "#ff5a4a";
    ctx.lineWidth = 1.8;
    samples.forEach((s, i) => {
      if (!s.errors) return;
      const x = xFor(i);
      const y = yFor(s.wpm);
      const r = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    });
  }

  // —— Wiring ——

  restartBtn.addEventListener("click", (e) => {
    restart();
    /** @type {HTMLElement} */ (e.currentTarget).blur();
  });

  function onKey(e) {
    if (!active) return;
    if ((e.key === "Tab" || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      restart();
    }
  }
  window.addEventListener("keydown", onKey);

  function activate() {
    active = true;
    root.hidden = false;
    renderConfig();
    restart();
  }

  function deactivate() {
    active = false;
    stopTicker();
    if (state === "running") state = "ready";
    opts.setHint([]);
    root.hidden = true;
  }

  function resize() {
    if (state === "done") drawChart();
  }

  renderConfig();

  return {
    activate,
    deactivate,
    restart,
    resize,
    handleKeyDown,
    handleCommit,
    handleWordGap,
    isActive: () => active,
  };
}

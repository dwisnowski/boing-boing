/**
 * Morse Trainer Card Pro emulator — keying, LEDs, decode, record/playback.
 */

import { createMorseAudio } from "./audio.js";
import { createBoard } from "./board.js";
import { createDecoder } from "./decoder.js";
import {
  BRANCH_DASH,
  BRANCH_DOT,
  MORSE_ROOT,
  pathIdsTo,
  step,
} from "./tree.js";

/**
 * @param {{
 *   boardMount: HTMLElement,
 *   messageEl: HTMLElement,
 *   statusEl?: HTMLElement | null,
 *   paddleBtn: HTMLElement,
 *   ditBtn?: HTMLElement | null,
 *   dahBtn?: HTMLElement | null,
 *   muteBtn: HTMLElement,
 *   recordBtn: HTMLElement,
 *   playBtn: HTMLElement,
 *   clearBtn: HTMLElement,
 *   onKeyDown?: () => void,
 *   onCommit?: (token: string) => boolean,
 *   onWordGap?: () => void,
 * }} els
 */
export function createTrainer(els) {
  const audio = createMorseAudio();
  const board = createBoard(els.boardMount);

  let current = MORSE_ROOT;
  /** @type {string[]} */
  let path = [];
  let message = "";
  let active = false;
  /** @type {"free" | "practice" | "listen"} */
  let mode = "free";
  let externalPlayback = false;
  let recording = false;
  let playing = false;
  let elementBusy = false;
  /** @type {{ t: number, type: "down"|"up" }[]} */
  let recordBuffer = [];
  let recordStartedAt = 0;
  /** @type {ReturnType<typeof setTimeout>[]} */
  let playbackTimers = [];

  const decoder = createDecoder({
    onElement(branch) {
      if (playing) return;
      applyBranch(branch);
    },
    onLetterGap() {
      if (playing) return;
      commitLetter();
    },
    onWordGap() {
      if (playing) return;
      if (!message.endsWith(" ") && message.length > 0) {
        message += " ";
        renderMessage();
      }
      setStatus("Word gap");
      els.onWordGap?.();
    },
  });

  function applyBranch(branch) {
    const next = step(current, branch);
    if (!next) {
      board.flashError();
      current = MORSE_ROOT;
      path = [];
      board.clearPath();
      setStatus("Invalid path — reset");
      return false;
    }
    current = next;
    path = pathIdsTo(next);
    board.setPath(path, next.id);
    setStatus(next.label ? `${next.label} · ${pathSymbol()}` : pathSymbol());
    return true;
  }

  function pathSymbol() {
    let node = MORSE_ROOT;
    const symbols = [];
    for (const id of path) {
      if (node.dash && node.dash.id === id) {
        symbols.push("−");
        node = node.dash;
      } else if (node.dot && node.dot.id === id) {
        symbols.push("·");
        node = node.dot;
      }
    }
    return symbols.join(" ");
  }

  function commitLetter() {
    if (current !== MORSE_ROOT && current.letter) {
      const accepted = els.onCommit ? els.onCommit(current.letter) !== false : true;
      if (accepted) {
        message += current.letter;
        renderMessage();
        setStatus(`Decoded ${current.label}`);
      } else {
        board.flashError();
        setStatus(`${current.label} rejected — key the expected character`);
      }
    } else if (current !== MORSE_ROOT) {
      setStatus("No letter at this node");
    }
    // Hold the lit gold path briefly so the completed letter is visible
    const holdMs = 380;
    current = MORSE_ROOT;
    path = [];
    window.setTimeout(() => {
      if (path.length === 0 && current === MORSE_ROOT) {
        board.clearPath();
      }
    }, holdMs);
  }

  function renderMessage() {
    els.messageEl.textContent = message || "—";
  }

  function setStatus(text) {
    if (els.statusEl) els.statusEl.textContent = text;
  }

  function setRecording(on) {
    recording = on;
    els.recordBtn.classList.toggle("is-active", recording);
    els.recordBtn.setAttribute("aria-pressed", recording ? "true" : "false");
    els.recordBtn.textContent = recording ? "Recording…" : "Record";
    if (recording) {
      recordBuffer = [];
      recordStartedAt = performance.now();
      setStatus("Recording");
    } else {
      setStatus(
        recordBuffer.length
          ? `Recorded ${recordBuffer.length} events`
          : "Record stopped"
      );
    }
  }

  function stopPlayback() {
    for (const t of playbackTimers) clearTimeout(t);
    playbackTimers = [];
    if (playing) {
      playing = false;
      audio.stopTone();
      decoder.reset();
      current = MORSE_ROOT;
      path = [];
      board.clearPath();
      els.playBtn.classList.remove("is-active");
      els.playBtn.textContent = "Play";
    }
  }

  function playRecording() {
    if (playing) {
      stopPlayback();
      setStatus("Playback stopped");
      return;
    }
    if (!recordBuffer.length) {
      setStatus("Nothing recorded");
      return;
    }

    stopPlayback();
    decoder.forceCommitLetter();
    current = MORSE_ROOT;
    path = [];
    board.clearPath();

    playing = true;
    els.playBtn.classList.add("is-active");
    els.playBtn.textContent = "Stop";
    setStatus("Playing back…");

    const events = recordBuffer.slice();
    const t0 = events[0].t;
    const threshold = decoder.getTiming().ditThresholdMs;
    let lastDown = null;

    for (const ev of events) {
      const delay = Math.max(0, ev.t - t0);
      if (ev.type === "down") {
        lastDown = ev;
        playbackTimers.push(
          setTimeout(() => {
            if (!playing) return;
            audio.startTone();
          }, delay)
        );
      } else if (ev.type === "up" && lastDown) {
        const durationMs = ev.t - lastDown.t;
        const branch =
          durationMs < threshold ? BRANCH_DOT : BRANCH_DASH;
        playbackTimers.push(
          setTimeout(() => {
            if (!playing) return;
            audio.stopTone();
            applyBranch(branch);
          }, delay)
        );
        lastDown = null;
      }
    }

    const last = events[events.length - 1];
    const endDelay =
      Math.max(0, last.t - t0) + decoder.getTiming().letterGapMs + 40;
    playbackTimers.push(
      setTimeout(() => {
        if (!playing) return;
        commitLetter();
        playing = false;
        els.playBtn.classList.remove("is-active");
        els.playBtn.textContent = "Play";
        setStatus("Playback done");
      }, endDelay)
    );
  }

  function onKeyDown() {
    if (!active || playing || externalPlayback) return;
    if (decoder.isKeyDown()) return;
    audio.ensureContext();
    audio.startTone();
    decoder.keyDown();
    els.onKeyDown?.();
    if (recording) {
      recordBuffer.push({
        t: performance.now() - recordStartedAt,
        type: "down",
      });
    }
    els.paddleBtn.classList.add("is-down");
  }

  function onKeyUp() {
    if (!active || playing || externalPlayback) return;
    if (!decoder.isKeyDown()) return;
    audio.stopTone();
    decoder.keyUp();
    if (recording) {
      recordBuffer.push({
        t: performance.now() - recordStartedAt,
        type: "up",
      });
    }
    els.paddleBtn.classList.remove("is-down");
  }

  /**
   * Instant dit/dah (secondary input) — plays a short/long beep and advances the path.
   * @param {"dash"|"dot"} branch
   */
  function sendElement(branch) {
    if (!active || playing || externalPlayback || decoder.isKeyDown() || elementBusy) return;
    const timing = decoder.getTiming();
    const durationMs =
      branch === BRANCH_DOT
        ? Math.max(55, timing.unitMs)
        : Math.max(180, Math.round(timing.ditThresholdMs + timing.unitMs));

    elementBusy = true;
    try {
      audio.ensureContext();
      decoder.clearTimers();
      audio.startTone();
      els.onKeyDown?.();
      const beepStarted = performance.now();
      if (recording) {
        recordBuffer.push({
          t: beepStarted - recordStartedAt,
          type: "down",
        });
      }

      window.setTimeout(() => {
        try {
          audio.stopTone();
          const now = performance.now();
          if (recording) {
            recordBuffer.push({
              t: now - recordStartedAt,
              type: "up",
            });
          }
          applyBranch(branch);
          decoder.armGaps();
        } finally {
          elementBusy = false;
        }
      }, durationMs);
    } catch {
      elementBusy = false;
    }
  }

  function toggleMute() {
    const next = !audio.isMuted();
    audio.setMuted(next);
    els.muteBtn.classList.toggle("is-active", next);
    els.muteBtn.setAttribute("aria-pressed", next ? "true" : "false");
    els.muteBtn.textContent = next ? "Silent" : "Mute";
    setStatus(next ? "Silent LED mode" : "Tone on");
  }

  function clearAll() {
    stopPlayback();
    decoder.reset();
    audio.stopTone();
    current = MORSE_ROOT;
    path = [];
    message = "";
    recordBuffer = [];
    recording = false;
    els.recordBtn.classList.remove("is-active");
    els.recordBtn.textContent = "Record";
    els.recordBtn.setAttribute("aria-pressed", "false");
    board.clearPath();
    renderMessage();
    setStatus("Cleared");
  }

  function bindPointer(el) {
    const down = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      onKeyDown();
    };
    const up = (e) => {
      e.preventDefault();
      onKeyUp();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
  }

  bindPointer(els.paddleBtn);

  if (els.ditBtn) {
    els.ditBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendElement(BRANCH_DOT);
    });
  }
  if (els.dahBtn) {
    els.dahBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendElement(BRANCH_DASH);
    });
  }

  els.muteBtn.addEventListener("click", () => toggleMute());
  els.recordBtn.addEventListener("click", () => {
    if (playing) return;
    setRecording(!recording);
  });
  els.playBtn.addEventListener("click", () => playRecording());
  els.clearBtn.addEventListener("click", () => clearAll());

  function onKeyBoardDown(e) {
    if (!active) return;
    if (mode === "listen") {
      if (e.repeat) return;
      if (e.key === "Escape") {
        e.preventDefault();
        location.hash = "#/";
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      }
      return;
    }
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      if (!e.repeat) onKeyDown();
      return;
    }
    if (e.repeat) return;
    if (e.key === "Escape") {
      e.preventDefault();
      location.hash = "#/";
      return;
    }
    if (e.key === "." || e.key === ">") {
      e.preventDefault();
      sendElement(BRANCH_DOT);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      sendElement(BRANCH_DASH);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMute();
    } else if (mode === "free" && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      if (!playing) setRecording(!recording);
    } else if (mode === "free" && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      playRecording();
    }
  }

  function onKeyBoardUp(e) {
    if (!active || mode === "listen") return;
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      onKeyUp();
    }
  }

  window.addEventListener("keydown", onKeyBoardDown);
  window.addEventListener("keyup", onKeyBoardUp);

  function activate() {
    active = true;
    audio.ensureContext();
    renderMessage();
    setStatus("Hold Key or tap Dit / Dah");
    board.resize?.();
  }

  function deactivate() {
    active = false;
    stopPlayback();
    if (decoder.isKeyDown()) {
      audio.stopTone();
      decoder.keyUp();
      els.paddleBtn.classList.remove("is-down");
    }
    decoder.reset();
    audio.stopTone();
    els.paddleBtn.classList.remove("is-down");
  }

  function destroy() {
    deactivate();
    window.removeEventListener("keydown", onKeyBoardDown);
    window.removeEventListener("keyup", onKeyBoardUp);
    board.destroy?.();
    audio.dispose();
  }

  function resize() {
    board.resize?.();
  }

  const MODE_HEIGHT = { free: 0.56, practice: 0.44, listen: 0.42 };
  const MODE_STATUS = {
    free: "Hold Key or tap Dit / Dah",
    practice: "Key the highlighted phrase",
    listen: "Press Play to hear and watch the phrase",
  };

  /** @param {"free" | "practice" | "listen"} next */
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    stopPlayback();
    if (recording) setRecording(false);
    releaseKey();
    decoder.reset();
    current = MORSE_ROOT;
    path = [];
    message = "";
    board.clearPath();
    board.setHint([]);
    board.setHeightRatio(MODE_HEIGHT[mode]);
    renderMessage();
    setStatus(MODE_STATUS[mode]);
  }

  function releaseKey() {
    if (decoder.isKeyDown()) {
      audio.stopTone();
      decoder.keyUp();
    }
    els.paddleBtn.classList.remove("is-down");
  }

  /** Block live keying while the phrase player owns the tone and the card. */
  function setExternalPlayback(on) {
    if (on && !externalPlayback) {
      releaseKey();
      decoder.reset();
      current = MORSE_ROOT;
      path = [];
    }
    externalPlayback = on;
  }

  renderMessage();

  return {
    activate,
    deactivate,
    destroy,
    clearAll,
    resize,
    setMode,
    setExternalPlayback,
    setHint: (pathIds) => board.setHint(pathIds),
    flashError: () => board.flashError(),
    errorBeep: () => audio.beep(220, 140),
    toneOn: () => {
      audio.ensureContext();
      audio.startTone();
    },
    toneOff: () => audio.stopTone(),
    showPath: (ids, currentId) => board.setPath(ids, currentId),
    clearPath: () => board.clearPath(),
    setSegmentMs: (ms) => board.setSegmentMs(ms),
  };
}

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
    setStatus(next.letter ? `${next.letter} · ${pathSymbol()}` : pathSymbol());
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
      message += current.letter;
      renderMessage();
      setStatus(`Decoded ${current.letter}`);
    } else if (current !== MORSE_ROOT) {
      setStatus("No letter at this node");
    }
    current = MORSE_ROOT;
    path = [];
    board.clearPath();
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
    if (!active || playing) return;
    if (decoder.isKeyDown()) return;
    audio.ensureContext();
    audio.startTone();
    decoder.keyDown();
    if (recording) {
      recordBuffer.push({
        t: performance.now() - recordStartedAt,
        type: "down",
      });
    }
    els.paddleBtn.classList.add("is-down");
  }

  function onKeyUp() {
    if (!active || playing) return;
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
    if (!active || playing || decoder.isKeyDown()) return;
    audio.ensureContext();
    const timing = decoder.getTiming();
    const durationMs =
      branch === BRANCH_DOT
        ? Math.max(50, timing.unitMs)
        : Math.max(160, timing.unitMs * 3);

    // Cancel pending letter gap, then treat as a completed element.
    decoder.clearTimers();
    audio.startTone();
    const beepStarted = performance.now();
    if (recording) {
      recordBuffer.push({
        t: beepStarted - recordStartedAt,
        type: "down",
      });
    }

    window.setTimeout(() => {
      audio.stopTone();
      if (recording) {
        recordBuffer.push({
          t: performance.now() - recordStartedAt,
          type: "up",
        });
      }
      applyBranch(branch);
      // Re-arm letter/word gaps via a synthetic pending element
      decoder.keyDown(performance.now() - durationMs);
      decoder.keyUp(performance.now());
    }, durationMs);
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
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      if (!e.repeat) onKeyDown();
      return;
    }
    if (e.repeat) return;
    if (e.key === "." || e.key === ">") {
      e.preventDefault();
      sendElement(BRANCH_DOT);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      sendElement(BRANCH_DASH);
    } else if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      if (!playing) setRecording(!recording);
    } else if (e.key === "p" || e.key === "P") {
      e.preventDefault();
      playRecording();
    }
  }

  function onKeyBoardUp(e) {
    if (!active) return;
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
    setStatus("Hold Space or Key to send");
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
    audio.dispose();
  }

  renderMessage();

  return {
    activate,
    deactivate,
    destroy,
    clearAll,
  };
}

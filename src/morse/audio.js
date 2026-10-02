/** Web Audio CW tone for Morse keying. */

const TONE_HZ = 750;

export function createMorseAudio() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {OscillatorNode | null} */
  let osc = null;
  /** @type {GainNode | null} */
  let gain = null;
  let muted = false;
  let sounding = false;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function startTone() {
    if (sounding) return;
    sounding = true;
    if (muted) return;
    const audio = ensureContext();
    if (!audio) return;

    osc = audio.createOscillator();
    gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = TONE_HZ;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(audio.destination);
    const now = audio.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    osc.start(now);
  }

  function stopTone() {
    if (!sounding) return;
    sounding = false;
    if (!osc || !gain || !ctx) {
      osc = null;
      gain = null;
      return;
    }
    const audio = ctx;
    const o = osc;
    const g = gain;
    osc = null;
    gain = null;
    const now = audio.currentTime;
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      o.stop(now + 0.03);
    } catch {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (muted) {
      // Silence immediately but keep sounding flag if key still held
      if (osc && gain && ctx) {
        const audio = ctx;
        const o = osc;
        const g = gain;
        osc = null;
        gain = null;
        const now = audio.currentTime;
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
          o.stop(now + 0.02);
        } catch {
          /* ignore */
        }
      }
    } else if (sounding) {
      sounding = false;
      startTone();
    }
  }

  /** Short one-shot tone, independent of the keyed CW tone. */
  function beep(freqHz = 220, ms = 140) {
    if (muted) return;
    const audio = ensureContext();
    if (!audio) return;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "square";
    o.frequency.value = freqHz;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audio.destination);
    const now = audio.currentTime;
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    g.gain.setValueAtTime(0.08, now + ms / 1000 - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    o.start(now);
    o.stop(now + ms / 1000 + 0.02);
  }

  function isMuted() {
    return muted;
  }

  function isSounding() {
    return sounding;
  }

  function dispose() {
    stopTone();
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
    }
  }

  return {
    startTone,
    stopTone,
    beep,
    setMuted,
    isMuted,
    isSounding,
    dispose,
    ensureContext,
  };
}

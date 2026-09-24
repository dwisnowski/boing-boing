export function createInput(canvas) {
  const state = {
    hold: false,
    holdPressed: false,
    correct: false,
    boost: false,
    boostPressed: false,
  };

  function setHold(value) {
    if (value && !state.hold) state.holdPressed = true;
    state.hold = value;
  }

  function setBoost(value) {
    if (value && !state.boost) state.boostPressed = true;
    state.boost = value;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      setHold(true);
    } else if (event.code === "KeyA" || event.code === "ArrowLeft") {
      event.preventDefault();
      state.correct = true;
    } else if (
      event.code === "KeyW" ||
      event.code === "ArrowUp" ||
      event.code === "KeyE" ||
      event.code === "KeyD"
    ) {
      event.preventDefault();
      setBoost(true);
    }
  }

  function onKeyUp(event) {
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      setHold(false);
    } else if (event.code === "KeyA" || event.code === "ArrowLeft") {
      event.preventDefault();
      state.correct = false;
    } else if (
      event.code === "KeyW" ||
      event.code === "ArrowUp" ||
      event.code === "KeyE" ||
      event.code === "KeyD"
    ) {
      event.preventDefault();
      setBoost(false);
    }
  }

  function onPointerDown(event) {
    if (event.target === canvas || canvas.contains(event.target)) {
      event.preventDefault();
      // Primary click/touch still braces spin; right / two-finger = boost pump.
      if (event.button === 2 || event.buttons === 2) {
        setBoost(true);
      } else {
        setHold(true);
      }
    }
  }

  function onPointerUp(event) {
    if (event.button === 2) setBoost(false);
    else setHold(false);
  }

  function onContextMenu(event) {
    if (event.target === canvas || canvas.contains(event.target)) {
      event.preventDefault();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("blur", () => {
    setHold(false);
    setBoost(false);
    state.correct = false;
  });
  canvas.addEventListener("contextmenu", onContextMenu);

  return {
    get holding() {
      return state.hold;
    },
    get correcting() {
      return state.correct;
    },
    get boosting() {
      return state.boost;
    },
    consumePress() {
      const pressed = state.holdPressed;
      state.holdPressed = false;
      return pressed;
    },
    consumeBoostPress() {
      const pressed = state.boostPressed;
      state.boostPressed = false;
      return pressed;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

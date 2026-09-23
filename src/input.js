export function createInput(canvas) {
  const state = {
    hold: false,
    holdPressed: false,
  };

  function setHold(value) {
    if (value && !state.hold) state.holdPressed = true;
    state.hold = value;
  }

  function onKeyDown(event) {
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      setHold(true);
    }
  }

  function onKeyUp(event) {
    if (event.code === "Space" || event.code === "ArrowDown" || event.code === "KeyS") {
      event.preventDefault();
      setHold(false);
    }
  }

  function onPointerDown(event) {
    if (event.target === canvas || canvas.contains(event.target)) {
      event.preventDefault();
      setHold(true);
    }
  }

  function onPointerUp() {
    setHold(false);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("blur", onPointerUp);

  return {
    get holding() {
      return state.hold;
    },
    consumePress() {
      const pressed = state.holdPressed;
      state.holdPressed = false;
      return pressed;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
    },
  };
}

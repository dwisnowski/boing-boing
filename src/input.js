const KEY_MAP = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  KeyA: "left",
  KeyD: "right",
  KeyW: "jump",
  Space: "jump",
  Enter: "start",
};

export function createInput() {
  const down = new Set();

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    down.add(action);
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    down.delete(action);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    isDown(action) {
      return down.has(action);
    },
    consume(action) {
      if (!down.has(action)) return false;
      down.delete(action);
      return true;
    },
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}

import { createInput } from "./input.js";
import { createGame } from "./game.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");

const input = createInput();
const ui = {
  setPlaying(playing) {
    overlay.hidden = playing;
  },
  setStatus(text) {
    statusEl.textContent = text;
  },
};

const game = createGame(canvas, input, ui);

function tryStart() {
  game.start();
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "Space") {
    tryStart();
  }
});

canvas.addEventListener("pointerdown", tryStart);
overlay.hidden = false;

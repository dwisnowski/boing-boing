import { createInput } from "./input.js";
import { createRace, LEVELS } from "./game.js";
import {
  loadSave,
  writeSave,
  UPGRADE_DEFS,
  upgradeCost,
} from "./upgrades.js";

const canvas = document.getElementById("game");
const chipCountEl = document.getElementById("chip-count");
const hud = document.getElementById("hud");
const hudLevel = document.getElementById("hud-level");
const hudTime = document.getElementById("hud-time");
const hudHint = document.getElementById("hud-hint");
const integrityFill = document.getElementById("integrity-fill");

const screenTitle = document.getElementById("screen-title");
const screenShop = document.getElementById("screen-shop");
const screenResults = document.getElementById("screen-results");
const resultsTitle = document.getElementById("results-title");
const resultsCopy = document.getElementById("results-copy");
const shopList = document.getElementById("shop-list");
const shopChips = document.getElementById("shop-chips");

const btnTournament = document.getElementById("btn-tournament");
const btnQuick = document.getElementById("btn-quick");
const btnShop = document.getElementById("btn-shop");
const btnShopBack = document.getElementById("btn-shop-back");
const btnNext = document.getElementById("btn-next");
const btnRetry = document.getElementById("btn-retry");
const btnResultsMenu = document.getElementById("btn-results-menu");

const input = createInput(canvas);
let save = loadSave();
let race = null;
let mode = "menu"; // menu | race | shop | results
let activeLevelIndex = 0;
let lastResult = null;

refreshChips();
showScreen("title");
drawIdlePreview();

btnTournament.addEventListener("click", () => {
  activeLevelIndex = Math.min(save.tournamentIndex, LEVELS.length - 1);
  startRace(activeLevelIndex, "tournament");
});

btnQuick.addEventListener("click", () => {
  activeLevelIndex = Math.floor(Math.random() * LEVELS.length);
  startRace(activeLevelIndex, "quick");
});

btnShop.addEventListener("click", () => openShop());
btnShopBack.addEventListener("click", () => showScreen("title"));

btnNext.addEventListener("click", () => {
  if (mode !== "results") return;
  if (lastResult?.mode === "tournament" && lastResult.won) {
    const next = Math.min(activeLevelIndex + 1, LEVELS.length - 1);
    if (activeLevelIndex >= LEVELS.length - 1) {
      showScreen("title");
      return;
    }
    activeLevelIndex = next;
    startRace(activeLevelIndex, "tournament");
    return;
  }
  openShop();
});

btnRetry.addEventListener("click", () => {
  if (mode !== "results" || !lastResult) return;
  startRace(activeLevelIndex, lastResult.mode);
});

btnResultsMenu.addEventListener("click", () => {
  if (race) race.stop();
  lastResult = null;
  showScreen("title");
});

function startRace(levelIndex, raceMode) {
  if (race) race.stop();
  mode = "race";
  showScreen(null);
  hud.hidden = false;

  race = createRace({
    canvas,
    input,
    levelIndex,
    save,
    onHud: updateHud,
    onFinish: (result) => handleFinish(result, raceMode),
  });
  race.start();
}

function handleFinish(result, raceMode) {
  mode = "results";
  hud.hidden = true;
  if (race) race.stop();

  save.chips += result.chips;
  if (raceMode === "tournament" && result.won) {
    save.tournamentIndex = Math.max(
      save.tournamentIndex,
      Math.min(activeLevelIndex + 1, LEVELS.length - 1)
    );
  }
  writeSave(save);
  refreshChips();

  lastResult = { ...result, mode: raceMode };
  resultsTitle.textContent = result.won ? "Finished!" : "Wrecked!";
  resultsCopy.textContent = result.won
    ? `Time ${result.time.toFixed(2)}s · +${result.chips} chips · ${result.detail}`
    : `${result.detail} · salvaged ${result.chips} chip${result.chips === 1 ? "" : "s"} · ${result.time.toFixed(2)}s`;

  if (result.won) {
    btnNext.hidden = false;
    btnNext.textContent =
      raceMode === "tournament" && activeLevelIndex < LEVELS.length - 1
        ? "Next mountain"
        : "Upgrades";
    btnRetry.textContent = "Retry";
    btnResultsMenu.textContent = "Menu";
  } else {
    // Did not reach the finish — only try again or quit
    btnNext.hidden = true;
    btnRetry.textContent = "Try Again";
    btnResultsMenu.textContent = "Quit";
  }

  showScreen("results");
}

function updateHud({ levelName, time, integrity, hint }) {
  hudLevel.textContent = levelName;
  hudTime.textContent = `${time.toFixed(2)}s`;
  integrityFill.style.transform = `scaleX(${Math.max(0, Math.min(1, integrity))})`;
  hudHint.textContent = hint;
}

function openShop() {
  mode = "shop";
  if (race) race.stop();
  hud.hidden = true;
  renderShop();
  showScreen("shop");
}

function renderShop() {
  shopChips.textContent = `You have ${save.chips} microchip${save.chips === 1 ? "" : "s"}.`;
  shopList.innerHTML = "";
  for (const def of UPGRADE_DEFS) {
    const level = save.upgrades[def.id] || 0;
    const cost = upgradeCost(def, level);
    const maxed = level >= def.max;
    const item = document.createElement("div");
    item.className = "shop-item";
    item.innerHTML = `
      <h3>${def.name}</h3>
      <span class="lvl">Lv ${level}/${def.max}</span>
      <p>${def.blurb}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = maxed ? "Maxed" : `Buy (${cost})`;
    btn.disabled = maxed || save.chips < cost;
    btn.addEventListener("click", () => {
      if (maxed || save.chips < cost) return;
      save.chips -= cost;
      save.upgrades[def.id] = level + 1;
      writeSave(save);
      refreshChips();
      renderShop();
    });
    item.appendChild(btn);
    shopList.appendChild(item);
  }
}

function showScreen(name) {
  screenTitle.hidden = name !== "title";
  screenShop.hidden = name !== "shop";
  screenResults.hidden = name !== "results";
  if (name === "title") {
    mode = "menu";
    hud.hidden = true;
    drawIdlePreview();
  }
}

function refreshChips() {
  chipCountEl.textContent = `${save.chips} chip${save.chips === 1 ? "" : "s"}`;
}

function drawIdlePreview() {
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#163038");
  g.addColorStop(1, "#2a4a32");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative slope
  ctx.fillStyle = "#2f5538";
  ctx.beginPath();
  ctx.moveTo(0, 160);
  for (let x = 0; x <= canvas.width; x += 20) {
    ctx.lineTo(x, 160 + x * 0.28 + Math.sin(x * 0.03) * 18);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6fbf7e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 160);
  for (let x = 0; x <= canvas.width; x += 20) {
    ctx.lineTo(x, 160 + x * 0.28 + Math.sin(x * 0.03) * 18);
  }
  ctx.stroke();

  // Idle robot
  ctx.save();
  ctx.translate(180, 210);
  ctx.rotate(-0.4);
  ctx.fillStyle = "#d94c28";
  ctx.fillRect(-17, -14, 34, 34);
  ctx.fillStyle = "#cfd8dc";
  ctx.fillRect(-12, -28, 24, 16);
  ctx.fillStyle = "#6fd6b6";
  ctx.fillRect(-14, 20, 12, 6);
  ctx.fillRect(2, 20, 12, 6);
  ctx.restore();
}

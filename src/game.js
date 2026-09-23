import { createLevel, LEVELS } from "./levels.js";
import { createRobot, updateRobot } from "./robot.js";
import { statsFromUpgrades } from "./upgrades.js";
import { createCamera, updateCamera, drawFrame } from "./render.js";

export function createRace({ canvas, input, levelIndex, save, onHud, onFinish }) {
  const levelDef = LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  const level = createLevel(levelDef);
  const stats = statsFromUpgrades(save.upgrades);
  let robot = createRobot(level.spawn, stats);
  const camera = createCamera();
  const ctx = canvas.getContext("2d");

  let running = false;
  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let chipsCollected = 0;
  let resultSent = false;

  function start() {
    running = true;
    last = performance.now();
    onHud?.({
      levelName: levelDef.name,
      time: 0,
      integrity: robot.integrity / robot.maxIntegrity,
      hint: "Hold to stabilize spin · release to tumble",
    });
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 1 / 25);
    last = now;
    elapsed += dt;

    const holding = input.holding;
    updateRobot(robot, level.terrain, holding, dt);
    collectChips(robot, level.chips);
    updateCamera(camera, robot, canvas, level.terrain);
    drawFrame(ctx, camera, level, robot, holding, elapsed);

    onHud?.({
      levelName: levelDef.name,
      time: elapsed,
      integrity: Math.max(0, robot.integrity / robot.maxIntegrity),
      hint: robot.headMode
        ? "Tin head! Slam the torso to launch"
        : holding
          ? "Stabilizing… (momentum bleeding)"
          : "Hold to stabilize spin · release to tumble",
    });

    checkEnd();
    raf = requestAnimationFrame(frame);
  }

  function collectChips(bot, chips) {
    for (const chip of chips) {
      if (chip.taken) continue;
      if (Math.hypot(bot.x - chip.x, bot.y - chip.y) < chip.r + 24) {
        chip.taken = true;
        chipsCollected += 1;
        bot.message = "+1 microchip";
        bot.messageTimer = 0.8;
      }
    }
  }

  function checkEnd() {
    if (resultSent) return;

    if (robot.x >= level.finishX && robot.alive) {
      resultSent = true;
      const bonus = computeBonus(robot, chipsCollected);
      finish({
        won: true,
        time: elapsed,
        chips: chipsCollected + bonus.chips,
        detail: bonus.detail,
      });
      return;
    }

    if (!robot.alive) {
      resultSent = true;
      finish({
        won: false,
        time: elapsed,
        chips: chipsCollected,
        detail: robot.message || "Robot destroyed",
      });
    }
  }

  function computeBonus(bot, baseChips) {
    let extra = 0;
    const bits = [];
    if (bot.bounceCount >= 3) {
      extra += 1;
      bits.push("bounce bonus");
    }
    if (bot.flipAcc >= 8) {
      extra += 1;
      bits.push("spin bonus");
    }
    if (bot.maxHeight < level.spawn.y - 180) {
      extra += 1;
      bits.push("height bonus");
    }
    if (baseChips >= 3) {
      bits.push("chip hunter");
    }
    return {
      chips: extra,
      detail: bits.length ? bits.join(" · ") : "Clean run",
    };
  }

  function finish(result) {
    onFinish?.(result);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function retry() {
    stop();
    robot = createRobot(level.spawn, stats);
    chipsCollected = 0;
    resultSent = false;
    elapsed = 0;
    for (const chip of level.chips) chip.taken = false;
    camera.x = 0;
    camera.y = 0;
    start();
  }

  // Kickoff kick visual: brief delay then start already moving from spawn
  return {
    start,
    stop,
    retry,
    get levelDef() {
      return levelDef;
    },
  };
}

export { LEVELS };

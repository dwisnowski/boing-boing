import { createPlayer, updatePlayer, drawPlayer } from "./player.js";

const WORLD = {
  width: 3200,
  height: 540,
  groundY: 460,
};

const PLATFORMS = [
  { x: 0, y: WORLD.groundY, width: WORLD.width, height: 80 },
  { x: 420, y: 360, width: 160, height: 24 },
  { x: 720, y: 300, width: 140, height: 24 },
  { x: 980, y: 250, width: 180, height: 24 },
  { x: 1280, y: 320, width: 120, height: 24 },
  { x: 1560, y: 280, width: 200, height: 24 },
  { x: 1900, y: 340, width: 150, height: 24 },
  { x: 2200, y: 260, width: 170, height: 24 },
  { x: 2550, y: 310, width: 190, height: 24 },
  { x: 2850, y: 230, width: 160, height: 24 },
];

const SPAWN = { x: 80, y: WORLD.groundY - 48 };

export function createGame(canvas, input, ui) {
  const ctx = canvas.getContext("2d");
  const camera = { x: 0, y: 0 };
  const stars = createStars(90);

  let player = createPlayer(SPAWN);
  let running = false;
  let lastTime = 0;
  let rafId = 0;

  function start() {
    if (running) return;
    running = true;
    player = createPlayer(SPAWN);
    ui.setPlaying(true);
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 20);
    lastTime = now;

    updatePlayer(player, input, PLATFORMS, dt);
    clampPlayerToWorld(player);
    camera.x = clamp(
      player.x + player.width / 2 - canvas.width / 2,
      0,
      WORLD.width - canvas.width
    );

    draw(ctx, canvas, camera, stars, player);
    ui.setStatus(`x ${Math.round(player.x)} · keep exploring →`);

    if (player.x + player.width >= WORLD.width - 40) {
      ui.setStatus("You reached the end of the demo world!");
    }

    rafId = requestAnimationFrame(frame);
  }

  function destroy() {
    cancelAnimationFrame(rafId);
  }

  // Draw an idle title-scene frame immediately.
  draw(ctx, canvas, camera, stars, player);

  return { start, destroy, get running() { return running; } };
}

function clampPlayerToWorld(player) {
  player.x = clamp(player.x, 0, WORLD.width - player.width);
  if (player.y > WORLD.height + 200) {
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    player.vx = 0;
    player.vy = 0;
  }
}

function createStars(count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * WORLD.width,
      y: Math.random() * (WORLD.groundY - 40),
      size: Math.random() * 2 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}

function draw(ctx, canvas, camera, stars, player) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#0a2430");
  sky.addColorStop(0.55, "#143844");
  sky.addColorStop(1, "#1f4d4a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const t = performance.now() / 1000;
  for (const star of stars) {
    const sx = star.x - camera.x * 0.35;
    if (sx < -4 || sx > canvas.width + 4) continue;
    const alpha = 0.45 + 0.55 * Math.abs(Math.sin(t + star.twinkle));
    ctx.fillStyle = `rgba(242, 230, 201, ${alpha})`;
    ctx.fillRect(sx, star.y, star.size, star.size);
  }

  // Parallax hills
  drawHill(ctx, camera.x * 0.2, 390, "#0f3a40", canvas.width);
  drawHill(ctx, camera.x * 0.45, 420, "#125058", canvas.width);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (const platform of PLATFORMS) {
    drawPlatform(ctx, platform);
  }

  drawPlayer(ctx, player);

  // Finish marker
  ctx.fillStyle = "#7fd6c2";
  ctx.fillRect(WORLD.width - 36, WORLD.groundY - 120, 10, 120);
  ctx.fillStyle = "#e36a2e";
  ctx.beginPath();
  ctx.moveTo(WORLD.width - 26, WORLD.groundY - 120);
  ctx.lineTo(WORLD.width - 26 + 48, WORLD.groundY - 104);
  ctx.lineTo(WORLD.width - 26, WORLD.groundY - 88);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Vignette
  const vig = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.2,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.75
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHill(ctx, scrollX, baseY, color, width) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 80);
  for (let x = 0; x <= width; x += 40) {
    const wx = x + (scrollX % 240);
    const y = baseY + Math.sin(wx * 0.01) * 28;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, 540);
  ctx.lineTo(0, 540);
  ctx.closePath();
  ctx.fill();
}

function drawPlatform(ctx, platform) {
  const isGround = platform.y >= WORLD.groundY;
  ctx.fillStyle = isGround ? "#2f6b4f" : "#3d7f5c";
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  ctx.fillStyle = isGround ? "#4f9a68" : "#62b07a";
  ctx.fillRect(platform.x, platform.y, platform.width, 6);
  if (isGround) {
    ctx.fillStyle = "#1d4334";
    ctx.fillRect(platform.x, platform.y + 18, platform.width, platform.height - 18);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

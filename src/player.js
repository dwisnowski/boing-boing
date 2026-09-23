const GRAVITY = 2200;
const MOVE_SPEED = 280;
const JUMP_VELOCITY = -720;

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    width: 36,
    height: 48,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
  };
}

export function updatePlayer(player, input, platforms, dt) {
  const left = input.isDown("left");
  const right = input.isDown("right");

  player.vx = 0;
  if (left) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  }
  if (right) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  }

  if (input.consume("jump") && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }

  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  player.onGround = false;
  for (const platform of platforms) {
    resolvePlatformCollision(player, platform);
  }
}

function resolvePlatformCollision(player, platform) {
  const px = player.x;
  const py = player.y;
  const pw = player.width;
  const ph = player.height;

  const overlapping =
    px < platform.x + platform.width &&
    px + pw > platform.x &&
    py < platform.y + platform.height &&
    py + ph > platform.y;

  if (!overlapping) return;

  const overlapLeft = px + pw - platform.x;
  const overlapRight = platform.x + platform.width - px;
  const overlapTop = py + ph - platform.y;
  const overlapBottom = platform.y + platform.height - py;
  const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (minOverlap === overlapTop && player.vy >= 0) {
    player.y = platform.y - ph;
    player.vy = 0;
    player.onGround = true;
  } else if (minOverlap === overlapBottom && player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  } else if (minOverlap === overlapLeft) {
    player.x = platform.x - pw;
    player.vx = 0;
  } else if (minOverlap === overlapRight) {
    player.x = platform.x + platform.width;
    player.vx = 0;
  }
}

export function drawPlayer(ctx, player) {
  const { x, y, width, height, facing } = player;

  ctx.fillStyle = "#e36a2e";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#f2e6c9";
  const eyeX = facing > 0 ? x + width - 12 : x + 4;
  ctx.fillRect(eyeX, y + 12, 8, 8);

  ctx.fillStyle = "#7fd6c2";
  ctx.fillRect(x + 6, y + height - 10, width - 12, 6);
}

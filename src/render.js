export function drawFrame(ctx, camera, level, robot, controls, elapsed) {
  const holding = typeof controls === "boolean" ? controls : !!controls?.holding;
  const correcting = typeof controls === "object" && !!controls?.correcting;
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  drawSky(ctx, width, height, camera);
  drawMountains(ctx, camera, width, height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  drawTerrain(ctx, level.terrain, level.finishX);
  drawChips(ctx, level.chips, elapsed);
  drawRobot(ctx, robot);
  drawVfx(ctx, robot);

  ctx.restore();

  if (holding) {
    ctx.fillStyle = "rgba(111, 214, 182, 0.12)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(111, 214, 182, 0.65)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, width - 20, height - 20);
  } else if (correcting) {
    ctx.fillStyle = "rgba(96, 165, 250, 0.1)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(96, 165, 250, 0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, width - 20, height - 20);
  }

  if (robot.boostPending && robot.boostArmed > 0) {
    const pulse = 0.35 + 0.65 * Math.min(1, robot.boostArmed / 0.22);
    ctx.save();
    ctx.strokeStyle = `rgba(240, 196, 58, ${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.font = "700 16px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(240, 196, 58, ${pulse})`;
    ctx.fillText("BOOST ARMED", width / 2, height - 28);
    ctx.restore();
  }

  if (robot.message && robot.messageTimer > 0) {
    ctx.save();
    ctx.font = "700 22px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(robot.message, width / 2 + 2, 86);
    ctx.fillStyle = "#efe6d4";
    ctx.fillText(robot.message, width / 2, 84);
    ctx.restore();
  }
}

function drawSky(ctx, width, height, camera) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#163038");
  g.addColorStop(0.55, "#1c3f3a");
  g.addColorStop(1, "#2a4a32");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(239, 230, 212, 0.55)";
  for (let i = 0; i < 40; i += 1) {
    const x = ((i * 97 + camera.x * 0.15) % width + width) % width;
    const y = (i * 53) % (height * 0.55);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMountains(ctx, camera, width, height) {
  ctx.fillStyle = "#1a3338";
  drawParallaxRidge(ctx, camera.x * 0.2, height * 0.55, width, 70);
  ctx.fillStyle = "#224248";
  drawParallaxRidge(ctx, camera.x * 0.35, height * 0.62, width, 55);
}

function drawParallaxRidge(ctx, scroll, base, width, amp) {
  ctx.beginPath();
  ctx.moveTo(0, base + 120);
  for (let x = 0; x <= width; x += 24) {
    const y = base + Math.sin((x + scroll) * 0.01) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, 600);
  ctx.lineTo(0, 600);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, terrain, finishX) {
  const pts = terrain.points;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x + 40, last.y + 500);
  ctx.lineTo(pts[0].x - 40, pts[0].y + 500);
  ctx.closePath();

  const soil = ctx.createLinearGradient(0, terrain.minY, 0, terrain.maxY + 200);
  soil.addColorStop(0, "#3d6b48");
  soil.addColorStop(0.4, "#2f5538");
  soil.addColorStop(1, "#1d3324");
  ctx.fillStyle = soil;
  ctx.fill();

  ctx.strokeStyle = "#6fbf7e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();

  // Finish banner
  const finY = pts[pts.length - 2].y;
  ctx.fillStyle = "#9eb4bd";
  ctx.fillRect(finishX, finY - 110, 8, 110);
  ctx.fillStyle = "#e2552d";
  ctx.beginPath();
  ctx.moveTo(finishX + 8, finY - 110);
  ctx.lineTo(finishX + 70, finY - 92);
  ctx.lineTo(finishX + 8, finY - 74);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efe6d4";
  ctx.font = "700 14px 'IBM Plex Sans', sans-serif";
  ctx.fillText("FINISH", finishX + 14, finY - 118);
}

function drawChips(ctx, chips, elapsed) {
  for (const chip of chips) {
    if (chip.taken) continue;
    const bob = Math.sin(elapsed * 4 + chip.x * 0.01) * 5;
    ctx.save();
    ctx.translate(chip.x, chip.y + bob);
    ctx.rotate(elapsed * 2);
    ctx.fillStyle = "#f0c43a";
    ctx.strokeStyle = "#fff3b0";
    ctx.lineWidth = 2;
    hexPath(ctx, chip.r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function hexPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawRobot(ctx, robot) {
  ctx.save();
  ctx.translate(robot.x, robot.y);
  ctx.rotate(robot.angle);

  const limbsGone =
    !robot.leftArm && !robot.rightArm && !robot.leftLeg && !robot.rightLeg;

  if (robot.headLaunched || (limbsGone && robot.headMode)) {
    // Tin head
    ctx.fillStyle = "#9eb4bd";
    ctx.fillRect(-11, -11, 22, 22);
    ctx.fillStyle = "#6fd6b6";
    ctx.fillRect(-6, -4, 5, 5);
    ctx.fillRect(2, -4, 5, 5);
    ctx.fillStyle = "#e2552d";
    ctx.fillRect(-5, 4, 10, 3);
    ctx.restore();
    return;
  }

  const hw = robot.width / 2;
  const hh = robot.height / 2;

  // Torso
  ctx.fillStyle = "#d94c28";
  ctx.fillRect(-hw, -hh * 0.55, robot.width, robot.height * 0.7);

  // Head
  ctx.fillStyle = "#cfd8dc";
  ctx.fillRect(-12, -hh - 4, 24, 18);
  ctx.fillStyle = "#6fd6b6";
  ctx.fillRect(-7, -hh + 2, 5, 5);
  ctx.fillRect(2, -hh + 2, 5, 5);

  ctx.fillStyle = "#b33d22";
  if (robot.leftArm) ctx.fillRect(-hw - 12, -8, 12, 8);
  if (robot.rightArm) ctx.fillRect(hw, -8, 12, 8);

  if (robot.leftLeg) {
    ctx.fillStyle = "#9eb4bd";
    ctx.fillRect(-hw * 0.7, hh * 0.35, 10, 18);
    ctx.fillStyle = "#6fd6b6";
    ctx.fillRect(-hw * 0.85, hh - 4, 16, 7);
  }
  if (robot.rightLeg) {
    ctx.fillStyle = "#9eb4bd";
    ctx.fillRect(hw * 0.7 - 10, hh * 0.35, 10, 18);
    ctx.fillStyle = "#6fd6b6";
    ctx.fillRect(hw * 0.85 - 16, hh - 4, 16, 7);
  }

  ctx.restore();
}

function drawVfx(ctx, robot) {
  for (const p of robot.sparks) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
  for (const d of robot.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    ctx.globalAlpha = Math.min(1, d.life);
    ctx.fillStyle = d.kind === "torso" ? "#e2552d" : "#9eb4bd";
    ctx.fillRect(-6, -3, 12, 6);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(camera, robot, canvas, terrain) {
  // Keep the robot centered in the viewport
  const targetX = robot.x - canvas.width * 0.5;
  const targetY = robot.y - canvas.height * 0.5;
  camera.x += (targetX - camera.x) * 0.18;
  camera.y += (targetY - camera.y) * 0.18;
  // Soft bounds so the camera can still track airborne hangtime above the ridge
  const pad = 320;
  camera.x = Math.max(-pad, camera.x);
  camera.y = Math.max(terrain.minY - canvas.height * 0.55, Math.min(camera.y, terrain.maxY - canvas.height * 0.2));
}

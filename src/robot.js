import { closestOnTerrain, sampleTerrainY } from "./terrain.js";

const GRAVITY = 1650;
const AIR_DRAG = 0.06;

export function createRobot(spawn, stats) {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: spawn.vx ?? 120,
    vy: spawn.vy ?? 40,
    angle: spawn.angle ?? -0.35,
    spin: spawn.spin ?? 2.2,
    width: 34,
    height: 48,
    integrity: stats.maxIntegrity,
    maxIntegrity: stats.maxIntegrity,
    hasArms: true,
    hasLegs: true,
    headMode: false,
    headLaunched: false,
    alive: true,
    finished: false,
    airborne: true,
    bounceCount: 0,
    flipAcc: 0,
    maxHeight: spawn.y,
    distance: 0,
    sparks: [],
    debris: [],
    message: "",
    messageTimer: 0,
    damageCooldown: 0,
    stats,
  };
}

export function robotContacts(robot) {
  const c = Math.cos(robot.angle);
  const s = Math.sin(robot.angle);
  const hw = robot.width * 0.5;
  const hh = robot.height * 0.5;

  function local(lx, ly) {
    return {
      x: robot.x + lx * c - ly * s,
      y: robot.y + lx * s + ly * c,
    };
  }

  const feet = robot.hasLegs
    ? [local(-hw * 0.55, hh), local(hw * 0.55, hh)]
    : [];
  const body = [
    local(0, hh * 0.15),
    local(-hw * 0.65, 0),
    local(hw * 0.65, 0),
    local(0, -hh * 0.35),
  ];
  if (robot.hasArms) {
    body.push(local(-hw * 1.05, 0), local(hw * 1.05, 0));
  }
  const head = local(0, -hh * 0.9);
  return { feet, body, head };
}

export function updateRobot(robot, terrain, holding, dt) {
  if (!robot.alive || robot.finished) return;

  if (robot.messageTimer > 0) {
    robot.messageTimer -= dt;
    if (robot.messageTimer <= 0) robot.message = "";
  }
  if (robot.damageCooldown > 0) robot.damageCooldown -= dt;

  if (robot.airborne) {
    if (holding) {
      robot.spin *= Math.exp(-robot.stats.brakeStrength * dt);
      robot.vx *= Math.exp(-0.5 * dt);
    } else if (!robot.headMode) {
      const target = robot.stats.spinRate * (robot.hasLegs ? 1 : 1.2);
      if (robot.spin < target) {
        robot.spin += (target - robot.spin) * 2.2 * dt;
      }
    }
  }

  robot.angle += robot.spin * dt;
  robot.flipAcc += Math.abs(robot.spin) * dt;

  robot.vy += GRAVITY * dt;
  robot.vx *= 1 - AIR_DRAG * dt;
  robot.vy *= 1 - AIR_DRAG * 0.3 * dt;

  robot.x += robot.vx * dt;
  robot.y += robot.vy * dt;
  robot.distance = Math.max(robot.distance, robot.x);
  robot.maxHeight = Math.min(robot.maxHeight, robot.y);

  stepParticles(robot, dt);
  resolveTerrain(robot, terrain, holding);

  // Safety: never tunnel completely through the mountain
  const groundY = sampleTerrainY(terrain, robot.x);
  if (robot.y > groundY + 28) {
    robot.y = groundY - 12;
    if (robot.vy > 0) robot.vy *= -0.3;
  }

  if (robot.y > terrain.maxY + 700) {
    killRobot(robot, "Lost to the ravine");
  }
}

function stepParticles(robot, dt) {
  robot.sparks = robot.sparks.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    return p.life > 0;
  });
  robot.debris = robot.debris.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
    p.angle += p.spin * dt;
    return p.life > 0;
  });
}

function resolveTerrain(robot, terrain, holding) {
  if (robot.headLaunched) {
    resolveHeadFlight(robot, terrain);
    return;
  }

  const contacts = robotContacts(robot);
  let bestFoot = null;

  for (const foot of contacts.feet) {
    const hit = closestOnTerrain(terrain, foot.x, foot.y);
    if (!hit) continue;
    // Negative "into" means the point is below the surface (into the mountain).
    const into = (foot.x - hit.x) * hit.nx + (foot.y - hit.y) * hit.ny;
    if (into < 8 && hit.dist < 40) {
      if (!bestFoot || into < bestFoot.into) {
        bestFoot = { ...hit, into, foot };
      }
    }
  }

  let bodyHit = null;
  const bodyPoints = [...contacts.body, contacts.head];
  for (const pt of bodyPoints) {
    const hit = closestOnTerrain(terrain, pt.x, pt.y);
    if (!hit) continue;
    const into = (pt.x - hit.x) * hit.nx + (pt.y - hit.y) * hit.ny;
    if (into < 6 && hit.dist < 36) {
      if (!bodyHit || into < bodyHit.into) bodyHit = { ...hit, into, pt };
    }
  }

  const speed = Math.hypot(robot.vx, robot.vy);

  if (bestFoot && robot.hasLegs) {
    landOnFeet(robot, bestFoot, speed);
  } else if (bodyHit) {
    // Separate out of terrain
    const push = Math.max(0, 6 - bodyHit.into);
    robot.x += bodyHit.nx * push;
    robot.y += bodyHit.ny * push;
    crashIntoTerrain(robot, bodyHit, speed, holding);
  } else {
    robot.airborne = true;
  }
}

function landOnFeet(robot, hit, speed) {
  const footDirX = Math.sin(robot.angle);
  const footDirY = Math.cos(robot.angle);
  const align = footDirX * hit.nx + footDirY * hit.ny;

  // Push center out so feet sit on the surface
  const push = Math.max(0, 8 - hit.into);
  robot.x += hit.nx * push;
  robot.y += hit.ny * push;

  // Kill velocity into the surface before bounce response
  const vn = robot.vx * hit.nx + robot.vy * hit.ny;
  if (vn < 0) {
    robot.vx -= vn * hit.nx;
    robot.vy -= vn * hit.ny;
  }

  const impact = Math.max(speed, -vn);

  if (align > 0.7 && impact > 90) {
    const power = robot.stats.bounce * (0.8 + Math.min(impact / 850, 1.0));
    robot.vx += hit.nx * 90 * power + 300 * power;
    robot.vy += hit.ny * -580 * power - 40;
    robot.spin = robot.stats.spinRate * 0.9;
    robot.bounceCount += 1;
    robot.airborne = true;
    flash(robot, "BOING!", 0.65);
    burstSparks(robot, hit.foot.x, hit.foot.y, "#6fd6b6", 12);
  } else if (align > 0.3) {
    robot.vx = robot.vx * 0.5 + hit.nx * 30 + 40;
    robot.vy = Math.min(0, robot.vy) - 50;
    robot.spin *= 0.35;
    robot.airborne = true;
    if (robot.damageCooldown <= 0) {
      applyDamage(robot, 2 + impact * 0.005, hit.foot.x, hit.foot.y, "Rough landing");
      robot.damageCooldown = 0.4;
    }
  } else {
    crashIntoTerrain(robot, hit, speed, false);
  }
}

function crashIntoTerrain(robot, hit, speed, holding) {
  if (robot.damageCooldown > 0) {
    robot.airborne = true;
    return;
  }

  const dmg = (6 + speed * 0.028) * (holding ? 0.75 : 1);
  applyDamage(robot, dmg, hit.x || robot.x, hit.y || robot.y, "Crash!");
  robot.damageCooldown = 0.45;

  const vn = robot.vx * (hit.nx || 0) + robot.vy * (hit.ny || -1);
  if (vn < 0 && hit.nx != null) {
    robot.vx -= 1.15 * vn * hit.nx;
    robot.vy -= 1.15 * vn * hit.ny;
  }
  robot.vx *= 0.65;
  robot.vy = Math.min(robot.vy, 80) - 70;
  robot.spin = (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 2.5);
  robot.airborne = true;

  if (robot.headMode && !robot.headLaunched && speed > 260) {
    const footDirX = Math.sin(robot.angle);
    const footDirY = Math.cos(robot.angle);
    const align = hit.nx != null ? footDirX * hit.nx + footDirY * hit.ny : 0;
    // Slam roughly face/torso-first into slope
    if (align < 0.2) launchHead(robot);
  }
}

function applyDamage(robot, amount, x, y, reason) {
  if (robot.headLaunched) return;
  robot.integrity -= amount;
  burstSparks(robot, x, y, "#e2552d", 8);

  if (robot.integrity <= robot.maxIntegrity * 0.55 && robot.hasArms) {
    robot.hasArms = false;
    shedLimb(robot, "arms");
    flash(robot, "Arms gone!", 1.0);
  }
  if (robot.integrity <= robot.maxIntegrity * 0.22 && robot.hasLegs) {
    robot.hasLegs = false;
    robot.headMode = true;
    shedLimb(robot, "legs");
    flash(robot, "Tin head ready — slam to launch!", 1.5);
  }
  if (robot.integrity <= 0 && !robot.headLaunched) {
    if (robot.headMode) launchHead(robot);
    else killRobot(robot, reason || "Totaled");
  }
}

function launchHead(robot) {
  robot.headLaunched = true;
  robot.hasArms = false;
  robot.hasLegs = false;
  const power = robot.stats.explosionPower;
  robot.vx = Math.max(robot.vx, 80) + power * 0.5;
  robot.vy = -power * 0.3;
  robot.spin = 9;
  robot.width = 22;
  robot.height = 22;
  robot.integrity = Math.max(robot.integrity, 20);
  burstSparks(robot, robot.x, robot.y, "#f0c43a", 28);
  shedLimb(robot, "torso");
  flash(robot, "KABOOM — go tin head!", 1.3);
}

function resolveHeadFlight(robot, terrain) {
  const hit = closestOnTerrain(terrain, robot.x, robot.y);
  if (!hit || hit.dist >= 12) return;

  const into = (robot.x - hit.x) * hit.nx + (robot.y - hit.y) * hit.ny;
  if (into >= 8) return;

  const vn = robot.vx * hit.nx + robot.vy * hit.ny;
  if (vn < 0) {
    robot.vx -= 1.35 * vn * hit.nx;
    robot.vy -= 1.35 * vn * hit.ny;
    robot.vx = robot.vx * 0.9 + 40;
  }
  robot.x = hit.x + hit.nx * 12;
  robot.y = hit.y + hit.ny * 12;
  robot.integrity -= 1.5;
  if (robot.integrity <= -50) killRobot(robot, "Head smashed");
}

function killRobot(robot, reason) {
  robot.alive = false;
  robot.message = reason;
  robot.messageTimer = 2;
  burstSparks(robot, robot.x, robot.y, "#ff5d5d", 22);
}

function shedLimb(robot, kind) {
  const n = kind === "torso" ? 7 : 3;
  for (let i = 0; i < n; i += 1) {
    robot.debris.push({
      x: robot.x,
      y: robot.y,
      vx: (Math.random() - 0.5) * 340,
      vy: -180 - Math.random() * 260,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      life: 1.1 + Math.random(),
      kind,
    });
  }
}

function burstSparks(robot, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    robot.sparks.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 280,
      vy: (Math.random() - 0.85) * 280,
      life: 0.25 + Math.random() * 0.45,
      color,
    });
  }
}

function flash(robot, text, duration) {
  robot.message = text;
  robot.messageTimer = duration;
}

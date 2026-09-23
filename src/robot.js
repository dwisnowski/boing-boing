import { closestOnTerrain, sampleTerrainY } from "./terrain.js";

const GRAVITY = 1180;
const AIR_DRAG = 0.045;
/** Nominal mass for the fake impact-energy launch equation. */
const HEAD_MASS = 1;
/** Converts absorbed impact energy into outbound launch speed. */
const HEAD_ENERGY_SCALE = 2.35;

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
    // Discrete appendages lost in order: arm → arm → leg → leg
    leftArm: true,
    rightArm: true,
    leftLeg: true,
    rightLeg: true,
    headMode: false,
    headLaunched: false,
    headFlight: false,
    alive: true,
    finished: false,
    airborne: true,
    bounceCount: 0,
    flipAcc: 0,
    maxHeight: spawn.y,
    distance: 0,
    badLandings: 0,
    sparks: [],
    debris: [],
    message: "",
    messageTimer: 0,
    damageCooldown: 0,
    stats,
  };
}

export function armCount(robot) {
  return (robot.leftArm ? 1 : 0) + (robot.rightArm ? 1 : 0);
}

export function legCount(robot) {
  return (robot.leftLeg ? 1 : 0) + (robot.rightLeg ? 1 : 0);
}

export function appendageCount(robot) {
  return armCount(robot) + legCount(robot);
}

export function hasLegs(robot) {
  return legCount(robot) > 0;
}

export function hasArms(robot) {
  return armCount(robot) > 0;
}

/** Integrity for HUD: full limbs → torso-only → flying head. */
export function integrityRatio(robot) {
  if (robot.headLaunched) return 0.08;
  return Math.max(0.12, appendageCount(robot) / 4);
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

  const feet = [];
  if (robot.leftLeg) feet.push(local(-hw * 0.55, hh));
  if (robot.rightLeg) feet.push(local(hw * 0.55, hh));

  const body = [
    local(0, hh * 0.15),
    local(-hw * 0.65, 0),
    local(hw * 0.65, 0),
    local(0, -hh * 0.35),
  ];
  if (robot.leftArm) body.push(local(-hw * 1.05, 0));
  if (robot.rightArm) body.push(local(hw * 1.05, 0));
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
    } else if (!robot.headMode && !robot.headLaunched) {
      const target = robot.stats.spinRate * (hasLegs(robot) ? 1 : 1.2);
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
    if (robot.headFlight) {
      // Head buried in the slope counts as a landing
      robot.y = groundY - 10;
      robot.vx = 0;
      robot.vy = 0;
      robot.spin = 0;
      robot.headFlight = false;
      killRobot(robot, "Head down — run over");
      return;
    }
    robot.y = groundY - 12;
    if (robot.vy > 0) robot.vy *= -0.3;
  }

  if (robot.y > terrain.maxY + 700) {
    killRobot(robot, robot.headFlight ? "Head lost to the ravine" : "Lost to the ravine");
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
  if (robot.headFlight) {
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

  if (bestFoot && hasLegs(robot)) {
    landOnFeet(robot, bestFoot, speed);
  } else if (bodyHit) {
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
  const legFactor = legCount(robot) === 1 ? 0.72 : 1;

  // Clean feet-down landing → energetic spring bounce down the mountain
  if (align > 0.7 && impact > 90) {
    const power = robot.stats.bounce * (0.95 + Math.min(impact / 720, 1.15)) * legFactor;
    robot.vx += hit.nx * 120 * power + 380 * power;
    robot.vy += hit.ny * -820 * power - 110;
    robot.spin = robot.stats.spinRate * 0.9;
    robot.bounceCount += 1;
    robot.airborne = true;
    flash(robot, legCount(robot) === 1 ? "BOING…?" : "BOING!", 0.65);
    burstSparks(robot, hit.foot.x, hit.foot.y, "#6fd6b6", 12);
    return;
  }

  // Not planted correctly — lose an appendage (or launch head if stripped)
  if (align > 0.3) {
    const impactVel = { vx: robot.vx, vy: robot.vy };
    robot.vx = robot.vx * 0.5 + hit.nx * 30 + 40;
    robot.vy = Math.min(0, robot.vy) - 50;
    robot.spin *= 0.35;
    robot.airborne = true;
    if (robot.damageCooldown <= 0) {
      onBadLanding(robot, hit.foot.x, hit.foot.y, impact, hit, impactVel);
      robot.damageCooldown = 0.45;
    }
    return;
  }

  crashIntoTerrain(robot, hit, speed, false);
}

function crashIntoTerrain(robot, hit, speed, holding) {
  if (robot.damageCooldown > 0) {
    robot.airborne = true;
    return;
  }

  robot.damageCooldown = 0.45;

  // Snapshot impact velocity before bounce response (needed for head launch angle)
  const impactVx = robot.vx;
  const impactVy = robot.vy;
  const vn = impactVx * (hit.nx || 0) + impactVy * (hit.ny || -1);
  const impact = Math.max(speed, vn < 0 ? -vn : speed * 0.5);

  // Limbless torso: next solid hit rockets the head using pre-bounce impact state
  if (appendageCount(robot) === 0 && !robot.headLaunched) {
    onBadLanding(robot, hit.x || robot.x, hit.y || robot.y, impact, hit, {
      vx: impactVx,
      vy: impactVy,
    });
    return;
  }

  if (vn < 0 && hit.nx != null) {
    robot.vx -= 1.15 * vn * hit.nx;
    robot.vy -= 1.15 * vn * hit.ny;
  }
  robot.vx *= 0.65 * (holding ? 0.9 : 1);
  robot.vy = Math.min(robot.vy, 80) - 70;
  robot.spin = (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 2.5);
  robot.airborne = true;

  onBadLanding(robot, hit.x || robot.x, hit.y || robot.y, impact, hit, {
    vx: impactVx,
    vy: impactVy,
  });
}

/**
 * Bad landings strip appendages in order: arm, arm, leg, leg.
 * Once all are gone, the next ground hit rockets the head free.
 */
function onBadLanding(robot, x, y, impact, hit = null, impactVel = null) {
  if (robot.headLaunched || !robot.alive) return;

    // Soft bumps under the stamina threshold scrape but do not shed limbs
  const threshold = robot.stats.limbLossThreshold ?? 70;
  if (impact < threshold && appendageCount(robot) > 0) {
    burstSparks(robot, x, y, "#e2552d", 5);
    flash(robot, "Scrape", 0.35);
    return;
  }

  if (appendageCount(robot) === 0) {
    launchHead(robot, hit, impactVel);
    return;
  }

  robot.badLandings += 1;
  const lost = shedNextAppendage(robot);
  burstSparks(robot, x, y, "#e2552d", 10);
  // Brief invulnerability so one tumble does not strip every limb at once
  robot.damageCooldown = Math.max(robot.damageCooldown, 0.85);
  if (lost) {
    flash(robot, lost.message, 1.1);
    if (appendageCount(robot) === 0) {
      robot.headMode = true;
      flash(robot, "No limbs left — next hit launches the head!", 1.6);
    }
  }
}

function shedNextAppendage(robot) {
  if (robot.leftArm) {
    robot.leftArm = false;
    shedLimb(robot, "arm");
    return { kind: "arm", message: "Left arm gone!" };
  }
  if (robot.rightArm) {
    robot.rightArm = false;
    shedLimb(robot, "arm");
    return { kind: "arm", message: "Right arm gone!" };
  }
  if (robot.leftLeg) {
    robot.leftLeg = false;
    shedLimb(robot, "leg");
    return { kind: "leg", message: "Left leg gone!" };
  }
  if (robot.rightLeg) {
    robot.rightLeg = false;
    robot.headMode = true;
    shedLimb(robot, "leg");
    return { kind: "leg", message: "Right leg gone!" };
  }
  return null;
}

/**
 * Fake negative impact energy:
 *   E_impact = ½ m |v_into|²
 *   E_launch = -(-E_impact) * explosionScale   (absorb impact, invert to launch)
 *   |v_launch| = √(2 E_launch / m)
 * Launch angle matches the impact velocity angle, opposite direction.
 */
function launchHead(robot, hit, impactVel = null) {
  const nx = hit?.nx ?? 0;
  const ny = hit?.ny ?? -1;

  const ivx = impactVel?.vx ?? robot.vx;
  const ivy = impactVel?.vy ?? robot.vy;
  const speed = Math.hypot(ivx, ivy) || 1;
  // Launch angle matches velocity angle at impact, opposite direction
  const impactAngle = Math.atan2(ivy, ivx);
  const launchAngle = impactAngle + Math.PI;

  // Fake negative impact energy from speed into the surface
  const vn = ivx * nx + ivy * ny;
  const impactSpeed = vn < 0 ? Math.max(-vn, speed * 0.55) : speed;
  const impactEnergy = 0.5 * HEAD_MASS * impactSpeed * impactSpeed;
  const negativeImpactEnergy = -impactEnergy;
  const launchEnergy =
    -negativeImpactEnergy * HEAD_ENERGY_SCALE * (robot.stats.explosionPower / 780);
  const launchSpeed = Math.sqrt(Math.max(0, (2 * launchEnergy) / HEAD_MASS));

  robot.headLaunched = true;
  robot.headFlight = true;
  robot.headMode = true;
  robot.leftArm = false;
  robot.rightArm = false;
  robot.leftLeg = false;
  robot.rightLeg = false;
  robot.vx = Math.cos(launchAngle) * launchSpeed;
  robot.vy = Math.sin(launchAngle) * launchSpeed;
  robot.spin = 9 + Math.sign(launchSpeed) * 2;
  robot.angle = launchAngle;
  robot.width = 22;
  robot.height = 22;
  robot.airborne = true;
  // Clear the contact and give a short fuse so launch isn't cancelled by the same hit
  if (hit?.nx != null) {
    robot.x += hit.nx * 18;
    robot.y += hit.ny * 18;
  }
  robot.x += Math.cos(launchAngle) * 10;
  robot.y += Math.sin(launchAngle) * 10;
  robot.damageCooldown = 0.4;

  burstSparks(robot, robot.x, robot.y, "#f0c43a", 28);
  shedLimb(robot, "torso");
  flash(robot, "KABOOM — head away!", 1.3);
}

/** Head follows gravity until it hits the ground; first landing ends the run. */
function resolveHeadFlight(robot, terrain) {
  // Brief fuse so launch contact does not instantly end the session
  if (robot.damageCooldown > 0) return;

  const hit = closestOnTerrain(terrain, robot.x, robot.y);
  if (!hit || hit.dist >= 14) return;

  const into = (robot.x - hit.x) * hit.nx + (robot.y - hit.y) * hit.ny;
  if (into >= 10) return;

  robot.x = hit.x + hit.nx * 12;
  robot.y = hit.y + hit.ny * 12;
  robot.vx = 0;
  robot.vy = 0;
  robot.spin = 0;
  robot.headFlight = false;
  killRobot(robot, "Head down — run over");
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

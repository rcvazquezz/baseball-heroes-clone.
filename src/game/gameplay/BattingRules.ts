import Phaser from 'phaser'
import {
  BAT_EDGE_FOUL_THRESHOLD,
  BAT_WIDTH,
  HIT_VX_DOUBLE,
  HIT_VX_FOUL,
  HIT_VX_SINGLE,
  HIT_VX_TRIPLE,
  HIT_VY_DOUBLE,
  HIT_VY_FOUL,
  HIT_VY_HR,
  HIT_VY_SINGLE,
  HIT_VY_TRIPLE,
  PERFECT_WINDOW_END_MS,
  PERFECT_WINDOW_START_MS,
  PLATE_X,
  SOLID_EARLY_MS,
  SOLID_LATE_MS,
  STRIKE_HALF_W_BOT,
  STRIKE_HALF_W_TOP,
  STRIKE_ZONE_BOT,
  STRIKE_ZONE_TOP,
} from '../constants/GameConfig'
import type { FairHitKind, SwingTimingClass } from '../types/gameTypes'

export function isPointInStrikeZone(px: number, py: number): boolean {
  if (py < STRIKE_ZONE_TOP || py > STRIKE_ZONE_BOT) {
    return false
  }
  const u = (py - STRIKE_ZONE_TOP) / (STRIKE_ZONE_BOT - STRIKE_ZONE_TOP)
  const half = STRIKE_HALF_W_TOP + (STRIKE_HALF_W_BOT - STRIKE_HALF_W_TOP) * u
  return Math.abs(px - PLATE_X) <= half - 2
}

export function pickRandomOutsideStrikeTarget(): { x: number; y: number } {
  for (let attempt = 0; attempt < 20; attempt++) {
    const y = Phaser.Math.FloatBetween(STRIKE_ZONE_TOP - 42, STRIKE_ZONE_BOT + 38)
    const x = Phaser.Math.FloatBetween(PLATE_X - 120, PLATE_X + 120)
    if (!isPointInStrikeZone(x, y)) {
      return { x, y }
    }
  }
  return { x: PLATE_X + 75, y: STRIKE_ZONE_TOP - 20 }
}

export function pickRandomStrikeTarget(): { x: number; y: number; inZone: boolean } {
  if (Phaser.Math.FloatBetween(0, 1) < 0.3) {
    const o = pickRandomOutsideStrikeTarget()
    return { x: o.x, y: o.y, inZone: false }
  }
  const y = Phaser.Math.FloatBetween(STRIKE_ZONE_TOP + 6, STRIKE_ZONE_BOT - 4)
  const u = Phaser.Math.Clamp(
    (y - STRIKE_ZONE_TOP) / (STRIKE_ZONE_BOT - STRIKE_ZONE_TOP),
    0,
    1,
  )
  const half = STRIKE_HALF_W_TOP + (STRIKE_HALF_W_BOT - STRIKE_HALF_W_TOP) * u
  const margin = 4
  return {
    x: Phaser.Math.FloatBetween(PLATE_X - half + margin, PLATE_X + half - margin),
    y,
    inZone: true,
  }
}

export function resolveSwingTimingClass(
  now: number,
  swingAttackStartTime: number,
): SwingTimingClass {
  const elapsed = now - swingAttackStartTime
  if (elapsed < SOLID_EARLY_MS) {
    return 'muy_pronto'
  }
  if (elapsed < PERFECT_WINDOW_START_MS) {
    return 'pronto'
  }
  if (elapsed <= PERFECT_WINDOW_END_MS) {
    return 'perfect'
  }
  if (elapsed <= SOLID_LATE_MS) {
    return 'tardo'
  }
  return 'muy_tardo'
}

export function resolveFairHitKind(timingClass: SwingTimingClass): FairHitKind {
  const r = Phaser.Math.FloatBetween(0, 1)
  if (timingClass === 'perfect') {
    if (r < 0.36) {
      return 'HR'
    }
    if (r < 0.54) {
      return 'TRIPLE'
    }
    if (r < 0.8) {
      return 'DOUBLE'
    }
    return 'SINGLE'
  }
  if (r < 0.44) {
    return 'SINGLE'
  }
  if (r < 0.78) {
    return 'DOUBLE'
  }
  return 'TRIPLE'
}

export function edgeContactFromBallBat(ballX: number, batX: number): boolean {
  const batHalf = BAT_WIDTH * 0.5
  const batEdgeNorm = Math.abs(ballX - batX) / batHalf
  return batEdgeNorm >= BAT_EDGE_FOUL_THRESHOLD
}

export function advanceRunnersForFairKind(
  runners: [boolean, boolean, boolean],
  kind: FairHitKind,
): { runners: [boolean, boolean, boolean]; scored: number } {
  let [b1, b2, b3] = runners
  let scored = 0

  if (kind === 'HR') {
    scored = (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0) + 1
    return { runners: [false, false, false], scored }
  }

  if (kind === 'TRIPLE') {
    scored = (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0)
    return { runners: [false, false, true], scored }
  }

  if (kind === 'DOUBLE') {
    if (b3) {
      scored++
    }
    if (b2) {
      scored++
    }
    const newThird = b1
    return { runners: [false, true, newThird], scored }
  }

  if (b3) {
    scored++
  }
  const newThird = b2
  const newSecond = b1
  return { runners: [true, newSecond, newThird], scored }
}

export function applyFlyOutVelocity(ballBody: Phaser.Physics.Arcade.Body): void {
  const dir = Phaser.Math.FloatBetween(0, 1) < 0.5 ? -1 : 1
  ballBody.setVelocity(
    dir * Phaser.Math.FloatBetween(140, 240),
    Phaser.Math.FloatBetween(-400, -560),
  )
}

export function applyFoulVelocity(
  ballBody: Phaser.Physics.Arcade.Body,
  ballX: number,
  batX: number,
  timingClass: SwingTimingClass,
  edgeContact: boolean,
): void {
  let vx: number
  if (edgeContact) {
    const sign = Math.sign(ballX - batX) || (timingClass === 'muy_tardo' ? 1 : -1)
    vx = sign * HIT_VX_FOUL * Phaser.Math.FloatBetween(0.88, 1.05)
  } else if (timingClass === 'muy_pronto') {
    vx = -HIT_VX_FOUL * Phaser.Math.FloatBetween(0.9, 1.12)
  } else {
    vx = HIT_VX_FOUL * Phaser.Math.FloatBetween(0.9, 1.12)
  }
  const vy = Phaser.Math.FloatBetween(HIT_VY_FOUL - 70, HIT_VY_FOUL + 50)
  ballBody.setVelocity(vx, vy)
}

export function applyFairHitVelocity(
  ballBody: Phaser.Physics.Arcade.Body,
  kind: FairHitKind,
  timingClass: SwingTimingClass,
  speedMultiplier = 1,
): void {
  const m = speedMultiplier
  const pull = timingClass === 'pronto'
  const oppo = timingClass === 'tardo'
  const dirX = pull ? -1 : oppo ? 1 : Phaser.Math.FloatBetween(0, 1) < 0.5 ? -1 : 1

  switch (kind) {
    case 'HR':
      ballBody.setVelocity(
        Phaser.Math.FloatBetween(-28, 28) * m,
        HIT_VY_HR * m,
      )
      break
    case 'TRIPLE':
      ballBody.setVelocity(dirX * HIT_VX_TRIPLE * m, HIT_VY_TRIPLE * m)
      break
    case 'DOUBLE':
      ballBody.setVelocity(dirX * HIT_VX_DOUBLE * m, HIT_VY_DOUBLE * m)
      break
    default:
      ballBody.setVelocity(dirX * HIT_VX_SINGLE * m, HIT_VY_SINGLE * m)
      break
  }
}

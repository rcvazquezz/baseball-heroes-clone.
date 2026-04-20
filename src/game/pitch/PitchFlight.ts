import Phaser from 'phaser'
import {
  BALL_RADIUS,
  BALL_SCALE_FAR,
  BALL_SCALE_NEAR,
  GAME_HEIGHT,
  GAME_WIDTH,
  PITCHER_X,
  PITCHER_Y,
} from '../constants/GameConfig'

export function syncBallBodyRadius(
  ball: Phaser.GameObjects.Arc,
  body: Phaser.Physics.Arcade.Body,
): void {
  body.setCircle(BALL_RADIUS * ball.scaleX)
}

export function updateBallApproachScale(
  ball: Phaser.GameObjects.Arc,
  body: Phaser.Physics.Arcade.Body,
  opts: {
    ballInPlay: boolean
    pitchReleased: boolean
    pitchTargetX: number
    pitchTargetY: number
    pitchReleaseTime: number
    currentPitchSpeed: number
    timeNow: number
  },
): void {
  if (!opts.ballInPlay || !opts.pitchReleased) {
    return
  }
  const vx = opts.pitchTargetX - PITCHER_X
  const vy = opts.pitchTargetY - PITCHER_Y
  const totalLen = Math.hypot(vx, vy) || 1
  const elapsed = (opts.timeNow - opts.pitchReleaseTime) / 1000
  const s = elapsed * opts.currentPitchSpeed
  const t = Phaser.Math.Clamp(s / totalLen, 0, 1)
  const scale = Phaser.Math.Linear(BALL_SCALE_FAR, BALL_SCALE_NEAR, t)
  ball.setScale(scale)
  syncBallBodyRadius(ball, body)
}

export function applyPitchCurveMotion(
  ball: Phaser.GameObjects.Arc,
  body: Phaser.Physics.Arcade.Body,
  opts: {
    pitchReleased: boolean
    pitchTargetX: number
    pitchTargetY: number
    pitchReleaseTime: number
    currentPitchSpeed: number
    pitchCurveAmp: number
    pitchCurveWaves: number
    pitchCurvePhase: number
    timeNow: number
  },
): void {
  if (!opts.pitchReleased) {
    return
  }
  const dx = opts.pitchTargetX - PITCHER_X
  const dy = opts.pitchTargetY - PITCHER_Y
  const totalLen = Math.hypot(dx, dy) || 1
  const ux = dx / totalLen
  const uy = dy / totalLen
  const px = -uy
  const py = ux
  const elapsed = (opts.timeNow - opts.pitchReleaseTime) / 1000
  const s = elapsed * opts.currentPitchSpeed
  const lateral =
    opts.pitchCurveAmp *
    Math.sin((s / totalLen) * Math.PI * opts.pitchCurveWaves + opts.pitchCurvePhase)
  const x = PITCHER_X + ux * s + px * lateral
  const y = PITCHER_Y + uy * s + py * lateral
  ball.setPosition(x, y)
  body.setVelocity(0, 0)
}

export function isBallOutOfBounds(ball: Phaser.GameObjects.Arc): boolean {
  const margin = 48
  return (
    ball.y < -margin ||
    ball.y > GAME_HEIGHT + margin ||
    ball.x < -margin ||
    ball.x > GAME_WIDTH + margin
  )
}

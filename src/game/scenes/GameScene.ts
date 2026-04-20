import Phaser from 'phaser'
import {
  BALL_PITCH_SPEED,
  BALL_RADIUS,
  BALL_SCALE_FAR,
  BAT_ANCHOR_Y,
  BAT_HEIGHT,
  BAT_WIDTH,
  GAME_WIDTH,
  PITCH_SPEED_PER_LEVEL,
  PITCHER_ELLIPSE_H,
  PITCHER_ELLIPSE_W,
  PITCHER_FILL_DEFAULT,
  PITCHER_STROKE_DEFAULT,
  PITCHER_X,
  PITCHER_Y,
  PLATE_X,
  PLATE_Y,
  BALL_FILL,
  BALL_STROKE,
  BAT_FILL,
  BAT_GOLD_TINT,
  BAT_STROKE,
  SWING_ATTACK_MS,
  XP_PER_FAIR,
  XP_PER_HR,
} from '../constants/GameConfig'
import { BattedBallCamera } from '../camera/BattedBallCamera'
import { FieldView } from '../field/FieldView'
import {
  advanceRunnersForFairKind,
  applyFairHitVelocity,
  applyFlyOutVelocity,
  applyFoulVelocity,
  edgeContactFromBallBat,
  pickRandomStrikeTarget,
  resolveFairHitKind,
  resolveSwingTimingClass,
} from '../gameplay/BattingRules'
import { HUDManager } from '../managers/HUDManager'
import { JuiceManager } from '../managers/JuiceManager'
import { ScoreManager } from '../managers/ScoreManager'
import {
  applyPitchCurveMotion,
  isBallOutOfBounds,
  syncBallBodyRadius,
  updateBallApproachScale,
} from '../pitch/PitchFlight'
import { PitcherAnimator } from '../pitch/PitcherAnimator'
import type { FairHitKind, PlayBannerKind } from '../types/gameTypes'

/** Orquesta: input, física, reglas y managers (puntuación, HUD, campo, efectos). */
export class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc
  private bat!: Phaser.GameObjects.Rectangle
  private batGlow!: Phaser.GameObjects.Rectangle
  private pitcherMound!: Phaser.GameObjects.Ellipse
  private spaceKey!: Phaser.Input.Keyboard.Key
  private goldenSwingKey!: Phaser.Input.Keyboard.Key

  private scoreManager!: ScoreManager
  private hud!: HUDManager
  private juice!: JuiceManager
  private field!: FieldView
  private pitcherAnimator!: PitcherAnimator
  private battedBallCamera!: BattedBallCamera
  private readonly pitcherPrepTweenTarget = { progress: 0 }

  private currentPitchSpeed = BALL_PITCH_SPEED
  private pitchTargetX = PLATE_X
  private pitchTargetY = PLATE_Y
  private pitchTargetInZone = true
  private swingAttemptedThisPitch = false
  private runners: [boolean, boolean, boolean] = [false, false, false]
  private awaitingBattedResolution = false
  private battedBallStartTime = 0
  private playEndScheduled = false
  private lastBannerKind: PlayBannerKind | null = null
  private goldenSwingActive = false
  private isSwinging = false
  private isSwingAnimating = false
  private ballInPlay = true
  private swingAttackStartTime = 0
  private pitchReleaseTime = 0
  private pitchReleased = false
  private pitchCurveAmp = 42
  private pitchCurveWaves = 2.6
  private pitchCurvePhase = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.scoreManager = new ScoreManager({
      onChanged: () => this.hud.syncFromScore(),
      onInningOver: () => this.handleInningOverFromScore(),
      onLevelUp: () => {
        this.currentPitchSpeed += PITCH_SPEED_PER_LEVEL
        this.juice.showLevelUpToast()
      },
    })

    this.hud = new HUDManager(
      this,
      () => this.scoreManager,
      () => this.goldenSwingActive,
    )

    this.field = new FieldView(this)
    this.field.create()

    this.pitcherMound = this.add.ellipse(
      PITCHER_X,
      PITCHER_Y,
      PITCHER_ELLIPSE_W,
      PITCHER_ELLIPSE_H,
      PITCHER_FILL_DEFAULT,
      1,
    )
    this.pitcherMound.setStrokeStyle(2, PITCHER_STROKE_DEFAULT, 0.95)
    this.pitcherMound.setDepth(8)

    this.ball = this.add.circle(PITCHER_X, PITCHER_Y, BALL_RADIUS, BALL_FILL, 1)
    this.ball.setStrokeStyle(2, BALL_STROKE, 1)
    this.ball.setDepth(20)
    this.ball.setScale(BALL_SCALE_FAR)

    this.bat = this.add.rectangle(
      GAME_WIDTH / 2,
      BAT_ANCHOR_Y,
      BAT_WIDTH,
      BAT_HEIGHT,
      BAT_FILL,
      1,
    )
    this.bat.setStrokeStyle(2, BAT_STROKE, 1)
    this.bat.setOrigin(0.5, 1)
    this.bat.setDepth(21)

    this.batGlow = this.add.rectangle(
      GAME_WIDTH / 2,
      BAT_ANCHOR_Y,
      BAT_WIDTH + 14,
      BAT_HEIGHT + 8,
      BAT_GOLD_TINT,
      0.42,
    )
    this.batGlow.setStrokeStyle(0)
    this.batGlow.setOrigin(0.5, 1)
    this.batGlow.setDepth(20)
    this.batGlow.setVisible(false)

    this.physics.add.existing(this.ball, false)
    this.physics.add.existing(this.bat, true)
    const ballBody = this.getBallBody()
    ballBody.setCircle(BALL_RADIUS * BALL_SCALE_FAR)
    ballBody.setAllowGravity(false)
    ballBody.setCollideWorldBounds(false)
    this.getBatBody().updateFromGameObject()
    this.getBallBody().setVelocity(0, 0)

    this.juice = new JuiceManager(this)
    this.juice.ensureHrSparkTexture()
    this.juice.ensureBatContactSparkTexture()
    this.juice.ensureBallTrailTexture()
    this.juice.createPitchTargetMarker()
    this.juice.createBallTrailEmitter(this.ball)
    this.juice.createGoldenMegaBattedEmitter(this.ball)
    this.battedBallCamera = new BattedBallCamera(this, () => this.juice.playHomeRunCameraShake())

    this.pitcherAnimator = new PitcherAnimator(this, this.pitcherMound, this.pitcherPrepTweenTarget)

    this.hud.createAll()

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.goldenSwingKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)

    this.physics.add.overlap(this.ball, this.bat, () => {
      this.handleBallBatOverlap()
    })

    this.battedBallCamera.setupWorldBounds()
    this.pitcherAnimator.windup(() => {
      this.startBallFlight()
    })
    this.hud.refreshMiniDiamond(this.runners)
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.swingBat()
    }
    if (Phaser.Input.Keyboard.JustDown(this.goldenSwingKey)) {
      this.tryActivateGoldenSwing()
    }
    if (this.goldenSwingActive) {
      this.batGlow.setPosition(this.bat.x, this.bat.y)
      this.batGlow.setAngle(this.bat.angle)
    }
    if (this.ballInPlay && this.pitchReleased) {
      applyPitchCurveMotion(this.ball, this.getBallBody(), {
        pitchReleased: this.pitchReleased,
        pitchTargetX: this.pitchTargetX,
        pitchTargetY: this.pitchTargetY,
        pitchReleaseTime: this.pitchReleaseTime,
        currentPitchSpeed: this.currentPitchSpeed,
        pitchCurveAmp: this.pitchCurveAmp,
        pitchCurveWaves: this.pitchCurveWaves,
        pitchCurvePhase: this.pitchCurvePhase,
        timeNow: this.time.now,
      })
    }
    if (this.ballInPlay && isBallOutOfBounds(this.ball)) {
      this.handleDeadPitchResolution()
    } else if (
      this.awaitingBattedResolution &&
      !this.playEndScheduled &&
      (isBallOutOfBounds(this.ball) || this.time.now - this.battedBallStartTime > 5200)
    ) {
      this.scheduleBattedPlayResolution()
    }
    this.getBatBody().updateFromGameObject()
    updateBallApproachScale(this.ball, this.getBallBody(), {
      ballInPlay: this.ballInPlay,
      pitchReleased: this.pitchReleased,
      pitchTargetX: this.pitchTargetX,
      pitchTargetY: this.pitchTargetY,
      pitchReleaseTime: this.pitchReleaseTime,
      currentPitchSpeed: this.currentPitchSpeed,
      timeNow: this.time.now,
    })
  }

  private swingBat(): void {
    if (this.isSwingAnimating) {
      return
    }
    this.swingAttemptedThisPitch = true
    this.isSwingAnimating = true
    this.isSwinging = true
    this.swingAttackStartTime = this.time.now
    this.tweens.add({
      targets: this.bat,
      angle: -78,
      duration: SWING_ATTACK_MS,
      ease: Phaser.Math.Easing.Quadratic.Out,
      onComplete: () => {
        this.isSwinging = false
        this.tweens.add({
          targets: this.bat,
          angle: 0,
          duration: 200,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => {
            this.isSwingAnimating = false
          },
        })
      },
    })
  }

  private tryActivateGoldenSwing(): void {
    if (this.hud.getPowerMeter() < 1 || this.goldenSwingActive) {
      return
    }
    this.hud.resetPowerMeter()
    this.goldenSwingActive = true
    this.setBatGoldenGlow(true)
  }

  private setBatGoldenGlow(on: boolean): void {
    this.batGlow.setVisible(on)
    if (on) {
      this.batGlow.setPosition(this.bat.x, this.bat.y)
      this.batGlow.setAngle(this.bat.angle)
    }
  }

  private handleBallBatOverlap(): void {
    if (!this.isSwinging || !this.ballInPlay) {
      return
    }
    this.ballInPlay = false
    this.awaitingBattedResolution = true
    this.playEndScheduled = false
    this.battedBallStartTime = this.time.now

    const timingClass = resolveSwingTimingClass(this.time.now, this.swingAttackStartTime)
    const impactX = this.ball.x
    const impactY = this.ball.y
    const ballBody = this.getBallBody()
    this.ball.y -= 10
    const edgeContact = edgeContactFromBallBat(this.ball.x, this.bat.x)

    const badTiming = timingClass === 'muy_pronto' || timingClass === 'muy_tardo'
    if (badTiming && edgeContact && Phaser.Math.FloatBetween(0, 1) < 0.6) {
      this.lastBannerKind = Phaser.Math.FloatBetween(0, 1) < 0.5 ? 'FLY_OUT' : 'OUT'
      this.juice.hidePitchTargetMarker()
      this.juice.stopBallTrail()
      applyFlyOutVelocity(ballBody)
      this.scoreManager.resetAtBat()
      this.scoreManager.registerOut()
      return
    }

    const isFoul = badTiming || edgeContact
    if (isFoul) {
      this.lastBannerKind = 'FOUL'
      this.juice.hidePitchTargetMarker()
      this.juice.stopBallTrail()
      applyFoulVelocity(ballBody, this.ball.x, this.bat.x, timingClass, edgeContact)
      this.scoreManager.registerStrikeOnFoul()
      return
    }

    this.scoreManager.resetAtBat()
    this.hud.addPowerFromTiming(timingClass)

    let fairKind: FairHitKind
    let isMegaHit = false
    if (this.goldenSwingActive) {
      this.goldenSwingActive = false
      this.setBatGoldenGlow(false)
      fairKind = 'HR'
      this.lastBannerKind = 'MEGA_HR'
      isMegaHit = true
    } else {
      fairKind = resolveFairHitKind(timingClass)
      this.lastBannerKind = fairKind
    }

    this.juice.hidePitchTargetMarker()
    this.juice.stopBallTrail()
    this.juice.spawnBatContactParticles(impactX, impactY, fairKind, isMegaHit)

    const applyHit = (): void => {
      applyFairHitVelocity(ballBody, fairKind, timingClass, isMegaHit ? 2 : 1)
      this.juice.showImpactForFairHit(impactX, impactY, fairKind, timingClass, isMegaHit)
      this.onFairHitOutcome(fairKind)
      if (isMegaHit) {
        this.juice.startGoldenMegaBattedTrail()
      }
    }

    if (timingClass === 'perfect' && !isMegaHit) {
      this.juice.playPerfectHitJuice(impactX, impactY, applyHit)
    } else {
      applyHit()
    }
  }

  private handleDeadPitchResolution(): void {
    this.ballInPlay = false
    const swung = this.swingAttemptedThisPitch
    this.swingAttemptedThisPitch = false
    if (!swung) {
      if (this.pitchTargetInZone) {
        this.scoreManager.registerStrike()
        this.resetBall()
      } else {
        this.registerBallFromDeadPitch()
      }
    } else {
      this.scoreManager.registerStrike()
      this.resetBall()
    }
  }

  private handleInningOverFromScore(): void {
    this.runners = [false, false, false]
    this.hud.refreshMiniDiamond(this.runners)
    this.juice.showBigCenterPlayResult('INNING_OVER')
  }

  private registerBallFromDeadPitch(): void {
    const walk = this.scoreManager.registerBall()
    if (walk) {
      this.executeWalk()
    } else {
      this.juice.showBolBannerThenResetPitch(() => this.resetBall())
    }
  }

  private executeWalk(): void {
    const { runners: next, scored } = advanceRunnersForFairKind(this.runners, 'SINGLE')
    this.runners = next
    this.scoreManager.addRuns(scored)
    this.hud.refreshMiniDiamond(this.runners)
    this.juice.showBigCenterPlayResult('WALK')
    this.time.delayedCall(1380, () => this.resetBall())
  }

  private awardXpForFairHit(kind: FairHitKind): void {
    let xp = XP_PER_FAIR
    if (kind === 'HR') {
      xp += XP_PER_HR
    }
    if (this.lastBannerKind === 'MEGA_HR') {
      xp += 18
    }
    this.scoreManager.addXp(xp)
  }

  private onFairHitOutcome(kind: FairHitKind): void {
    const { runners: next, scored } = advanceRunnersForFairKind(this.runners, kind)
    this.runners = next
    this.scoreManager.addRuns(scored)
    this.hud.refreshMiniDiamond(this.runners)
    if (kind === 'HR' || kind === 'TRIPLE' || kind === 'DOUBLE') {
      this.battedBallCamera.activate(this.ball, kind)
    }
    if (kind === 'HR') {
      this.field.playCrowdOvacion()
    }
    this.awardXpForFairHit(kind)
  }

  private scheduleBattedPlayResolution(): void {
    if (this.playEndScheduled || !this.awaitingBattedResolution) {
      return
    }
    this.playEndScheduled = true
    this.getBallBody().setVelocity(0, 0)
    const kind = this.lastBannerKind
    if (kind !== null) {
      this.juice.showBigCenterPlayResult(kind)
    }
    this.time.delayedCall(1380, () => {
      this.awaitingBattedResolution = false
      this.playEndScheduled = false
      this.lastBannerKind = null
      this.resetBall()
    })
  }

  private resetBall(): void {
    this.battedBallCamera.restore()
    this.awaitingBattedResolution = false
    this.playEndScheduled = false
    this.lastBannerKind = null
    this.ball.setPosition(PITCHER_X, PITCHER_Y)
    this.ball.setScale(BALL_SCALE_FAR)
    this.ballInPlay = true
    syncBallBodyRadius(this.ball, this.getBallBody())
    this.getBallBody().setVelocity(0, 0)
    this.pitchTargetX = PLATE_X
    this.pitchTargetY = PLATE_Y
    this.pitchReleased = false
    this.juice.hidePitchTargetMarker()
    this.juice.stopBallTrail()
    this.juice.stopGoldenMegaBattedTrail()
    this.pitcherAnimator.windup(() => this.startBallFlight())
  }

  private startBallFlight(): void {
    const t = pickRandomStrikeTarget()
    this.pitchTargetX = t.x
    this.pitchTargetY = t.y
    this.pitchTargetInZone = t.inZone
    this.swingAttemptedThisPitch = false
    this.pitchReleased = true
    this.pitchReleaseTime = this.time.now
    this.pitchCurveAmp = Phaser.Math.FloatBetween(32, 58)
    this.pitchCurveWaves = Phaser.Math.FloatBetween(2.1, 3.2)
    this.pitchCurvePhase = Phaser.Math.FloatBetween(0, Math.PI * 2)
    this.ball.setPosition(PITCHER_X, PITCHER_Y)
    this.getBallBody().setVelocity(0, 0)
    syncBallBodyRadius(this.ball, this.getBallBody())
    this.juice.showPitchTargetMarker(this.pitchTargetX, this.pitchTargetY)
    this.juice.startBallTrail()
  }

  private getBallBody(): Phaser.Physics.Arcade.Body {
    const body = this.ball.body
    if (!body || !(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('La pelota no tiene cuerpo arcade')
    }
    return body
  }

  private getBatBody(): Phaser.Physics.Arcade.StaticBody {
    const body = this.bat.body
    if (!body || !(body instanceof Phaser.Physics.Arcade.StaticBody)) {
      throw new Error('El bate no tiene cuerpo estático arcade')
    }
    return body
  }
}

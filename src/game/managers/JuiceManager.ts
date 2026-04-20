import Phaser from 'phaser'
import {
  BAT_CONTACT_SPARK_KEY,
  BALL_TRAIL_TEXTURE_KEY,
  GAME_HEIGHT,
  GAME_WIDTH,
  HR_SHAKE_DURATION_MS,
  HR_SHAKE_INTENSITY,
  HR_SPARK_TEXTURE_KEY,
  PERFECT_HIT_STOP_MS,
  PLATE_X,
  PLATE_Y,
} from '../constants/GameConfig'
import type { FairHitKind, PlayBannerKind, SwingTimingClass } from '../types/gameTypes'

function bannerTextForKind(kind: PlayBannerKind): string {
  switch (kind) {
    case 'HR':
      return '¡HOME RUN!'
    case 'MEGA_HR':
      return '¡MEGA HOME RUN!'
    case 'INNING_OVER':
      return 'INNING OVER'
    case 'WALK':
      return '¡BASE POR BOLAS!'
    case 'FLY_OUT':
      return '¡FLY OUT!'
    case 'OUT':
      return '¡OUT!'
    case 'TRIPLE':
      return '¡TRIPLE!'
    case 'DOUBLE':
      return '¡DOBLE!'
    case 'SINGLE':
      return '¡SINGLE!'
    default:
      return 'FOUL'
  }
}

/**
 * Efectos de impacto, partículas, banners y hit-stop.
 */
export class JuiceManager {
  pitchTargetMarker!: Phaser.GameObjects.Arc
  ballTrailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  goldenMegaBattedEmitter!: Phaser.GameObjects.Particles.ParticleEmitter

  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  ensureHrSparkTexture(): void {
    if (this.scene.textures.exists(HR_SPARK_TEXTURE_KEY)) {
      return
    }
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(6, 6, 6)
    g.fillStyle(0xfff8c8, 0.75)
    g.fillCircle(6, 6, 3)
    g.generateTexture(HR_SPARK_TEXTURE_KEY, 12, 12)
    g.destroy()
  }

  ensureBatContactSparkTexture(): void {
    if (this.scene.textures.exists(BAT_CONTACT_SPARK_KEY)) {
      return
    }
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 0.95)
    g.fillCircle(5, 5, 5)
    g.fillStyle(0xffe2a0, 0.55)
    g.fillCircle(5, 5, 2.5)
    g.generateTexture(BAT_CONTACT_SPARK_KEY, 10, 10)
    g.destroy()
  }

  ensureBallTrailTexture(): void {
    if (this.scene.textures.exists(BALL_TRAIL_TEXTURE_KEY)) {
      return
    }
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 0.92)
    g.fillCircle(4, 4, 3)
    g.generateTexture(BALL_TRAIL_TEXTURE_KEY, 8, 8)
    g.destroy()
  }

  createPitchTargetMarker(): void {
    this.pitchTargetMarker = this.scene.add.circle(PLATE_X, PLATE_Y, 9, 0x000000, 0)
    this.pitchTargetMarker.setStrokeStyle(2, 0xfff2d0, 0.42)
    this.pitchTargetMarker.setDepth(15)
    this.pitchTargetMarker.setVisible(false)
  }

  createBallTrailEmitter(ball: Phaser.GameObjects.Arc): void {
    this.ensureBallTrailTexture()
    const emitter = this.scene.add.particles(0, 0, BALL_TRAIL_TEXTURE_KEY, {
      follow: ball,
      frequency: 38,
      lifespan: 200,
      quantity: 1,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.55, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xf2e6d8, 0xffe8a8],
      emitting: false,
    })
    this.ballTrailEmitter = emitter as Phaser.GameObjects.Particles.ParticleEmitter
    this.ballTrailEmitter.setDepth(18)
    this.ballTrailEmitter.stop()
  }

  createGoldenMegaBattedEmitter(ball: Phaser.GameObjects.Arc): void {
    this.ensureBatContactSparkTexture()
    const emitter = this.scene.add.particles(0, 0, BAT_CONTACT_SPARK_KEY, {
      follow: ball,
      frequency: 62,
      lifespan: 400,
      quantity: 1,
      scale: { start: 1.15, end: 0 },
      alpha: { start: 0.82, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xfff8e0, 0xffdd55, 0xffc400, 0xffeeaa, 0xffe066],
      speed: { min: 0, max: 12 },
      angle: { min: 0, max: 360 },
      rotate: { min: -40, max: 40 },
      emitting: false,
    })
    this.goldenMegaBattedEmitter = emitter as Phaser.GameObjects.Particles.ParticleEmitter
    this.goldenMegaBattedEmitter.setDepth(19)
    this.goldenMegaBattedEmitter.stop()
  }

  showPitchTargetMarker(x: number, y: number): void {
    this.pitchTargetMarker.setPosition(x, y)
    this.pitchTargetMarker.setVisible(true)
  }

  hidePitchTargetMarker(): void {
    this.pitchTargetMarker.setVisible(false)
  }

  startBallTrail(): void {
    this.ballTrailEmitter.start()
  }

  stopBallTrail(): void {
    this.ballTrailEmitter.stop()
  }

  startGoldenMegaBattedTrail(): void {
    this.goldenMegaBattedEmitter.start()
  }

  stopGoldenMegaBattedTrail(): void {
    this.goldenMegaBattedEmitter.stop()
  }

  playHomeRunCameraShake(): void {
    this.scene.cameras.main.shake(HR_SHAKE_DURATION_MS, HR_SHAKE_INTENSITY)
  }

  showBigCenterPlayResult(kind: PlayBannerKind): void {
    const text = bannerTextForKind(kind)
    const foul = kind === 'FOUL'
    const mega = kind === 'MEGA_HR'
    const inningEnd = kind === 'INNING_OVER'
    const walk = kind === 'WALK'
    const airOut = kind === 'FLY_OUT' || kind === 'OUT'
    const label = this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36, text, {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: foul
          ? '56px'
          : mega
            ? '58px'
            : inningEnd
              ? '52px'
              : walk
                ? '48px'
                : airOut
                  ? '54px'
                  : '62px',
        color: foul
          ? '#d8dee9'
          : mega
            ? '#ffe566'
            : inningEnd
              ? '#d4c9b0'
              : walk
                ? '#a8e6cf'
                : airOut
                  ? '#c8d8f0'
                  : '#ffe6a8',
        stroke: foul
          ? '#1a1a22'
          : mega
            ? '#4a3200'
            : inningEnd
              ? '#2a2218'
              : walk
                ? '#0d2820'
                : airOut
                  ? '#182030'
                  : '#3a2200',
        strokeThickness: foul ? 8 : mega ? 11 : inningEnd ? 9 : walk ? 9 : airOut ? 9 : 10,
      })
      .setOrigin(0.5)
      .setDepth(240)
      .setAlpha(0)
      .setScale(0.45)
    label.setScrollFactor(0, 0)

    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      scale: foul ? 1 : inningEnd ? 1.02 : walk ? 1.03 : airOut ? 1.04 : 1.05,
      duration: 200,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          scale: foul ? 1.08 : 1.12,
          duration: 700,
          delay: 220,
          ease: Phaser.Math.Easing.Cubic.In,
          onComplete: () => {
            label.destroy()
          },
        })
      },
    })
  }

  showBolBannerThenResetPitch(onComplete: () => void): void {
    const label = this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 32, '¡BOLA!', {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: '52px',
        color: '#b8f0e8',
        stroke: '#0d2824',
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(242)
      .setAlpha(0)
      .setScale(0.42)
    label.setScrollFactor(0, 0)

    this.scene.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1.02,
      duration: 180,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          alpha: 0,
          scale: 1.08,
          duration: 420,
          delay: 280,
          ease: Phaser.Math.Easing.Cubic.In,
          onComplete: () => {
            label.destroy()
            onComplete()
          },
        })
      },
    })
  }

  showLevelUpToast(): void {
    const t = this.scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, 'LEVEL UP', {
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#ffeaa7',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(260)
      .setAlpha(0)
      .setScale(0.65)

    this.scene.tweens.add({
      targets: t,
      alpha: 1,
      scale: 1,
      duration: 170,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.scene.time.delayedCall(420, () => {
          this.scene.tweens.add({
            targets: t,
            alpha: 0,
            y: t.y - 28,
            scale: 1.12,
            duration: 380,
            ease: Phaser.Math.Easing.Cubic.In,
            onComplete: () => {
              t.destroy()
            },
          })
        })
      },
    })
  }

  spawnBatContactParticles(
    x: number,
    y: number,
    kind: FairHitKind,
    goldenMega = false,
  ): void {
    this.ensureBatContactSparkTexture()

    if (goldenMega) {
      const burst = (count: number, smin: number, smax: number, life: number, sc: number): void => {
        const emitter = this.scene.add.particles(x, y, BAT_CONTACT_SPARK_KEY, {
          lifespan: life,
          speed: { min: smin, max: smax },
          angle: { min: 0, max: 360 },
          rotate: { min: -280, max: 280 },
          scale: { start: sc, end: 0 },
          alpha: { start: 1, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          tint: [0xfff8e0, 0xffdd55, 0xffc400, 0xffeeaa, 0xffaa22],
          emitting: false,
        })
        emitter.setDepth(106)
        emitter.explode(count)
        this.scene.time.delayedCall(life + 120, () => emitter.destroy())
      }
      burst(95, 380, 920, 900, 1.35)
      this.scene.time.delayedCall(40, () => {
        burst(55, 120, 520, 720, 0.85)
      })
      return
    }

    const isHr = kind === 'HR'
    const count = isHr ? 52 : 20
    const lifespan = isHr
      ? { min: 780, max: 1100 }
      : { min: 240, max: 360 }
    const speed = isHr
      ? { min: 340, max: 780 }
      : { min: 90, max: 280 }
    const scaleStart = isHr ? 0.95 : 0.5
    const scaleEnd = isHr ? 0.08 : 0

    const emitter = this.scene.add.particles(x, y, BAT_CONTACT_SPARK_KEY, {
      lifespan,
      speed,
      angle: { min: 0, max: 360 },
      rotate: { min: -220, max: 220 },
      scale: { start: scaleStart, end: scaleEnd },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xfffef5, 0xffe8a8, 0xffcc44, 0xffeecc],
      emitting: false,
    })
    emitter.setDepth(104)
    emitter.explode(count)

    const cleanupMs = (isHr ? 1200 : 420) + 100
    this.scene.time.delayedCall(cleanupMs, () => {
      emitter.destroy()
    })
  }

  spawnMegaGoldenImpactBurst(x: number, y: number): void {
    this.ensureHrSparkTexture()
    const emitter = this.scene.add.particles(x, y, HR_SPARK_TEXTURE_KEY, {
      lifespan: 640,
      speed: { min: 280, max: 720 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffffff, 0xffe8a0, 0xffcc33],
      emitting: false,
    })
    emitter.setDepth(107)
    emitter.explode(48)
    this.scene.time.delayedCall(760, () => emitter.destroy())
  }

  showMegaHomeRunImpactLabel(x: number, y: number): void {
    const label = this.scene.add
      .text(x, y, 'MEGA!', {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: '52px',
        color: '#FFD700',
        stroke: '#3d2200',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(112)
      .setAlpha(0)
      .setScale(0.3)
    label.setShadow(2, 3, '#000000', 8, true, true)

    this.scene.tweens.add({
      targets: label,
      scale: 1.12,
      alpha: 1,
      duration: 220,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          y: y - 72,
          alpha: 0,
          scale: 1.2,
          duration: 720,
          ease: Phaser.Math.Easing.Cubic.Out,
          onComplete: () => label.destroy(),
        })
      },
    })
  }

  spawnHomeRunSparkleBurst(x: number, y: number): void {
    this.ensureHrSparkTexture()

    const burst = (
      count: number,
      speedMin: number,
      speedMax: number,
      lifespan: number,
      scaleStart: number,
    ): void => {
      const emitter = this.scene.add.particles(x, y, HR_SPARK_TEXTURE_KEY, {
        lifespan,
        speed: { min: speedMin, max: speedMax },
        angle: { min: 0, max: 360 },
        scale: { start: scaleStart, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        tint: [0xffffee, 0xffeeaa, 0xffdd66],
        emitting: false,
      })
      emitter.setDepth(105)
      emitter.explode(count)
      this.scene.time.delayedCall(lifespan + 80, () => {
        emitter.destroy()
      })
    }

    burst(28, 220, 480, 520, 1.15)
    this.scene.time.delayedCall(45, () => {
      burst(14, 80, 260, 420, 0.65)
    })
  }

  showPerfectImpactLabel(x: number, y: number): void {
    const label = this.scene.add
      .text(x, y, '¡PERFECTO!', {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: '52px',
        color: '#FFD700',
        stroke: '#3d2200',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(110)
      .setAlpha(0)
      .setScale(0.35)
    label.setShadow(2, 3, '#000000', 6, true, true)

    this.scene.tweens.add({
      targets: label,
      scale: 1.08,
      alpha: 1,
      duration: 220,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.scene.tweens.add({
          targets: label,
          scale: 1,
          duration: 120,
          ease: Phaser.Math.Easing.Sine.Out,
          onComplete: () => {
            this.scene.tweens.add({
              targets: label,
              y: y - 88,
              alpha: 0,
              scale: 1.06,
              duration: 900,
              ease: Phaser.Math.Easing.Cubic.Out,
              onComplete: () => {
                label.destroy()
              },
            })
          },
        })
      },
    })
  }

  showImpactForFairHit(
    x: number,
    y: number,
    kind: FairHitKind,
    timingClass: SwingTimingClass,
    isMegaHit = false,
  ): void {
    if (isMegaHit) {
      this.spawnHomeRunSparkleBurst(x, y)
      this.spawnMegaGoldenImpactBurst(x, y)
      this.showMegaHomeRunImpactLabel(x, y)
      return
    }
    if (kind === 'HR') {
      this.spawnHomeRunSparkleBurst(x, y)
      this.showPerfectImpactLabel(x, y)
      return
    }
    if (timingClass === 'perfect') {
      this.showPerfectImpactLabel(x, y)
      return
    }

    const [text, color] =
      timingClass === 'pronto' ? (['PRONTO', '#ffb347'] as const) : (['TARDE', '#87ceeb'] as const)
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color,
        stroke: '#0a0a12',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(100)

    this.scene.tweens.add({
      targets: label,
      y: y - 64,
      alpha: 0,
      duration: 820,
      ease: Phaser.Math.Easing.Cubic.Out,
      onComplete: () => {
        label.destroy()
      },
    })
  }

  playPerfectHitJuice(
    impactX: number,
    impactY: number,
    onAfterFreeze: () => void,
  ): void {
    this.scene.physics.world.pause()
    this.scene.tweens.pauseAll()

    const flash = this.scene.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH + 16,
        GAME_HEIGHT + 16,
        0xffffff,
        0.1,
      )
      .setDepth(378)

    const crack = this.scene.add
      .text(impactX, impactY - 12, 'CRACK!', {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: '32px',
        color: '#fffef9',
        stroke: '#1a140a',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(380)
      .setScale(0.42)

    window.setTimeout(() => {
      flash.destroy()
      onAfterFreeze()
      this.scene.physics.world.resume()
      this.scene.tweens.resumeAll()
      this.scene.tweens.add({
        targets: crack,
        scale: 1.18,
        duration: 72,
        ease: Phaser.Math.Easing.Back.Out,
        onComplete: () => {
          this.scene.tweens.add({
            targets: crack,
            y: crack.y - 36,
            alpha: 0,
            scale: 1.28,
            duration: 260,
            ease: Phaser.Math.Easing.Cubic.Out,
            onComplete: () => {
              crack.destroy()
            },
          })
        },
      })
    }, PERFECT_HIT_STOP_MS)
  }
}

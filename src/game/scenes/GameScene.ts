import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../gameDimensions'

const BALL_RADIUS = 10
/** Rapidez del lanzamiento (módulo del vector hacia el home). */
const BALL_PITCH_SPEED = 260
const BAT_WIDTH = 92
const BAT_HEIGHT = 15

/** Perspectiva estilo Baseball Heroes: cámara detrás del home, fondo arriba. */
const PERSP_VANISH_X = 400
const PERSP_VANISH_Y = 158

const PLATE_X = 400
const PLATE_Y = 496

const PITCHER_X = 400
const PITCHER_Y = 152
const PITCHER_ELLIPSE_W = 30
const PITCHER_ELLIPSE_H = 13

/** Escala visual de la pelota (lejos → cerca de la cámara). */
const BALL_SCALE_FAR = 0.36
const BALL_SCALE_NEAR = 1.06

/** Bate anclado cerca del home, ligeramente por debajo de la punta del plato. */
const BAT_ANCHOR_Y = PLATE_Y + 26

/** Zona de strike (mismos valores que `drawField`). */
const STRIKE_ZONE_TOP = PLATE_Y - 58
const STRIKE_ZONE_BOT = PLATE_Y + 6
const STRIKE_HALF_W_TOP = 20
const STRIKE_HALF_W_BOT = 46

/** Duración (ms) de la fase de ataque del swing (coincide con el tween de ida). */
const SWING_ATTACK_MS = 130
/** Ventana de timing “perfecto” dentro de esa fase (estilo Baseball Heroes). */
const PERFECT_WINDOW_START_MS = 48
const PERFECT_WINDOW_END_MS = 82
/** Fuera de esto → foul por timing (MUY PRONTO / MUY TARDE). */
const SOLID_EARLY_MS = 22
const SOLID_LATE_MS = 118
/** Contacto en el borde del bate (normalizado respecto al semi-ancho). */
const BAT_EDGE_FOUL_THRESHOLD = 0.78

const HIT_VY_HR = -720
const HIT_VY_TRIPLE = -560
const HIT_VY_DOUBLE = -480
const HIT_VY_SINGLE = -380
const HIT_VY_FOUL = -260
const HIT_VX_TRIPLE = 320
const HIT_VX_DOUBLE = 260
const HIT_VX_SINGLE = 200
const HIT_VX_FOUL = 640

/** Vibración de cámara en home run (muy breve y sutil). */
const HR_SHAKE_DURATION_MS = 85
const HR_SHAKE_INTENSITY = 0.0035

/** Cámara siguiendo batazo largo / HR. */
const HR_CAMERA_ZOOM = 0.86
const LONG_HIT_CAMERA_ZOOM = 0.92
const HR_CAMERA_ZOOM_IN_MS = 450
const LONG_HIT_CAMERA_ZOOM_IN_MS = 380
const HR_CAMERA_RESTORE_MS = 560
const HR_CAMERA_FOLLOW_LERP_X = 0.12
const HR_CAMERA_FOLLOW_LERP_Y = 0.12
const LONG_HIT_CAMERA_FOLLOW_LERP_X = 0.14
const LONG_HIT_CAMERA_FOLLOW_LERP_Y = 0.14
/** Márgenes del mundo para permitir pan/zoom al seguir la pelota. */
const HR_WORLD_PAD_X = 360
const HR_WORLD_PAD_TOP = 520
const HR_WORLD_PAD_BOTTOM = 220

const XP_PER_FAIR = 10
const XP_PER_HR = 22
const XP_PER_LEVEL = 100
/** Suma a la rapidez del lanzamiento por cada nivel ganado. */
const PITCH_SPEED_PER_LEVEL = 16

const XP_BAR_PAD_X = 52
/** Banda inferior “Old Money”: línea de progreso y etiqueta. */
const XP_LINE_Y = GAME_HEIGHT - 11
const XP_LABEL_Y = GAME_HEIGHT - 30
const XP_HUD_BAND_H = 42

/** Textura generada para destellos del home run. */
const HR_SPARK_TEXTURE_KEY = 'hr_spark'

type SwingTimingClass = 'muy_pronto' | 'pronto' | 'perfect' | 'tardo' | 'muy_tardo'

type FairHitKind = 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE'

type PlayBannerKind = FairHitKind | 'FOUL'

/** Campo de béisbol (vista desde detrás del home con perspectiva). */
export class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc
  private bat!: Phaser.GameObjects.Rectangle
  /** Lanzador en el fondo (elipse para sensación de perspectiva). */
  private pitcherMound!: Phaser.GameObjects.Ellipse
  private spaceKey!: Phaser.Input.Keyboard.Key

  /** Solo true durante la fase activa del swing (ataque), no en el retorno a reposo. */
  private isSwinging = false
  /** Evita iniciar otro swing hasta terminar la animación completa. */
  private isSwingAnimating = false
  /** Evita registrar varios impactos en el mismo solapamiento. */
  private ballInPlay = true
  /** Marca de tiempo al iniciar la fase de ataque (para medir timing). */
  private swingAttackStartTime = 0

  private playerXp = 0
  private playerLevel = 1
  private currentPitchSpeed = BALL_PITCH_SPEED
  private xpBarFill!: Phaser.GameObjects.Rectangle
  private xpHudText!: Phaser.GameObjects.Text

  /** True mientras la cámara sigue un batazo (HR o hit largo). */
  private hrCameraActive = false

  /** Objetivo del lanzamiento actual dentro de la zona de strike. */
  private pitchTargetX = PLATE_X
  private pitchTargetY = PLATE_Y

  /** Bases ocupadas: 1ª, 2ª, 3ª (índice 0 = primera). */
  private runners: [boolean, boolean, boolean] = [false, false, false]
  private runsScored = 0

  private miniDiamondG!: Phaser.GameObjects.Graphics
  private runsHudText!: Phaser.GameObjects.Text

  private awaitingBattedResolution = false
  private battedBallStartTime = 0
  private playEndScheduled = false
  private lastBannerKind: PlayBannerKind | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.drawField()

    this.pitcherMound = this.add.ellipse(
      PITCHER_X,
      PITCHER_Y,
      PITCHER_ELLIPSE_W,
      PITCHER_ELLIPSE_H,
      0xd4b48c,
      1,
    )
    this.pitcherMound.setStrokeStyle(2, 0x8b6914, 0.95)
    this.pitcherMound.setDepth(8)

    this.ball = this.add.circle(PITCHER_X, PITCHER_Y, BALL_RADIUS, 0xf2f2f2, 1)
    this.ball.setStrokeStyle(2, 0xccaa88, 1)
    this.ball.setDepth(20)
    this.ball.setScale(BALL_SCALE_FAR)

    this.bat = this.add.rectangle(
      GAME_WIDTH / 2,
      BAT_ANCHOR_Y,
      BAT_WIDTH,
      BAT_HEIGHT,
      0x4a3224,
      1,
    )
    this.bat.setStrokeStyle(2, 0x2a1a12, 1)
    this.bat.setOrigin(0.5, 1)
    this.bat.setDepth(21)

    this.physics.add.existing(this.ball, false)
    this.physics.add.existing(this.bat, true)

    const ballBody = this.getBallBody()
    ballBody.setCircle(BALL_RADIUS * BALL_SCALE_FAR)
    ballBody.setAllowGravity(false)
    ballBody.setCollideWorldBounds(false)

    const batBody = this.getBatBody()
    batBody.updateFromGameObject()

    this.getBallBody().setVelocity(0, 0)
    this.pitcherWindup(() => {
      this.startBallFlight()
    })

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.createXpHud()
    this.createMiniDiamondHud()

    this.physics.add.overlap(this.ball, this.bat, () => {
      this.handleBallBatOverlap()
    })

    this.setupMainCamera()
    this.ensureHrSparkTexture()
    this.refreshMiniDiamond()
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.swingBat()
    }

    if (this.ballInPlay && this.isBallOutOfBounds()) {
      this.resetBall()
    } else if (
      this.awaitingBattedResolution &&
      !this.playEndScheduled &&
      (this.isBallOutOfBounds() || this.time.now - this.battedBallStartTime > 5200)
    ) {
      this.scheduleBattedPlayResolution()
    }

    this.getBatBody().updateFromGameObject()
    this.updateBallApproachScale()
  }

  /** Animación de swing al pulsar la barra espaciadora. */
  private swingBat(): void {
    if (this.isSwingAnimating) {
      return
    }

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

  private handleBallBatOverlap(): void {
    if (!this.isSwinging || !this.ballInPlay) {
      return
    }
    this.ballInPlay = false
    this.awaitingBattedResolution = true
    this.playEndScheduled = false
    this.battedBallStartTime = this.time.now

    const timingClass = this.resolveSwingTimingClass()
    const impactX = this.ball.x
    const impactY = this.ball.y
    const ballBody = this.getBallBody()

    this.ball.y -= 10

    const batHalf = BAT_WIDTH * 0.5
    const batEdgeNorm = Math.abs(this.ball.x - this.bat.x) / batHalf
    const edgeContact = batEdgeNorm >= BAT_EDGE_FOUL_THRESHOLD

    const foulByTiming =
      timingClass === 'muy_pronto' || timingClass === 'muy_tardo'
    const isFoul = foulByTiming || edgeContact

    if (isFoul) {
      this.lastBannerKind = 'FOUL'
      this.applyFoulVelocity(ballBody, timingClass, edgeContact)
      return
    }

    const fairKind = this.resolveFairHitKind(timingClass)
    this.lastBannerKind = fairKind
    this.applyFairHitVelocity(ballBody, fairKind, timingClass)
    this.showImpactForFairHit(impactX, impactY, fairKind, timingClass)
    this.onFairHitOutcome(fairKind)
  }

  private playHomeRunCameraShake(): void {
    this.cameras.main.shake(HR_SHAKE_DURATION_MS, HR_SHAKE_INTENSITY)
  }

  private setupMainCamera(): void {
    const cam = this.cameras.main
    cam.setBounds(
      -HR_WORLD_PAD_X,
      -HR_WORLD_PAD_TOP,
      GAME_WIDTH + HR_WORLD_PAD_X * 2,
      GAME_HEIGHT + HR_WORLD_PAD_TOP + HR_WORLD_PAD_BOTTOM,
    )
    cam.setZoom(1)
    cam.setScroll(0, 0)
  }

  /** Sigue la pelota con lerp y zoom suave (HR o hit largo). */
  private activateBattedBallCamera(kind: FairHitKind): void {
    const cam = this.cameras.main
    this.tweens.killTweensOf(cam)

    this.hrCameraActive = true
    const isHr = kind === 'HR'
    const lerpX = isHr ? HR_CAMERA_FOLLOW_LERP_X : LONG_HIT_CAMERA_FOLLOW_LERP_X
    const lerpY = isHr ? HR_CAMERA_FOLLOW_LERP_Y : LONG_HIT_CAMERA_FOLLOW_LERP_Y
    cam.startFollow(this.ball, false, lerpX, lerpY)

    const zoom = isHr ? HR_CAMERA_ZOOM : LONG_HIT_CAMERA_ZOOM
    const zoomMs = isHr ? HR_CAMERA_ZOOM_IN_MS : LONG_HIT_CAMERA_ZOOM_IN_MS

    this.tweens.add({
      targets: cam,
      zoom,
      duration: zoomMs,
      ease: Phaser.Math.Easing.Sine.Out,
    })

    if (isHr) {
      this.playHomeRunCameraShake()
    }
  }

  /** Vuelve scroll y zoom al estado inicial de forma suave. */
  private restoreDefaultCamera(): void {
    const cam = this.cameras.main
    cam.stopFollow()
    this.tweens.killTweensOf(cam)

    if (!this.hrCameraActive) {
      cam.setScroll(0, 0)
      cam.setZoom(1)
      return
    }

    this.hrCameraActive = false
    this.tweens.add({
      targets: cam,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      duration: HR_CAMERA_RESTORE_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
    })
  }

  private createXpHud(): void {
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const bandCy = GAME_HEIGHT - XP_HUD_BAND_H / 2

    this.add
      .rectangle(GAME_WIDTH / 2, bandCy, GAME_WIDTH, XP_HUD_BAND_H, 0x050505, 1)
      .setDepth(148)
      .setScrollFactor(0, 0)

    this.add
      .rectangle(GAME_WIDTH / 2, XP_LINE_Y, maxW, 1, 0x0e0e0e, 1)
      .setDepth(149)
      .setScrollFactor(0, 0)

    this.xpBarFill = this.add
      .rectangle(XP_BAR_PAD_X, XP_LINE_Y, 0, 2, 0xd4c9b0, 1)
      .setOrigin(0, 0.5)
      .setDepth(150)
      .setScrollFactor(0, 0)

    this.xpHudText = this.add
      .text(XP_BAR_PAD_X, XP_LABEL_Y, '', {
        font: '300 12px Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
        color: '#8f887c',
      })
      .setOrigin(0, 0.5)
      .setDepth(151)
      .setScrollFactor(0, 0)

    this.refreshXpHud()
  }

  private refreshXpHud(): void {
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const ratio = Phaser.Math.Clamp(this.playerXp / XP_PER_LEVEL, 0, 1)
    this.xpBarFill.width = Math.max(0, ratio * maxW)
    this.xpHudText.setText(
      `Nivel ${this.playerLevel}     ${this.playerXp} / ${XP_PER_LEVEL}`,
    )
  }

  private addXp(amount: number): void {
    this.playerXp += amount
    while (this.playerXp >= XP_PER_LEVEL) {
      this.playerXp -= XP_PER_LEVEL
      this.playerLevel += 1
      this.currentPitchSpeed += PITCH_SPEED_PER_LEVEL
      this.showLevelUpToast()
    }
    this.refreshXpHud()
  }

  private awardXpForFairHit(kind: FairHitKind): void {
    let xp = XP_PER_FAIR
    if (kind === 'HR') {
      xp += XP_PER_HR
    }
    this.addXp(xp)
  }

  private pickRandomStrikeTarget(): { x: number; y: number } {
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
    }
  }

  private resolveSwingTimingClass(): SwingTimingClass {
    const elapsed = this.time.now - this.swingAttackStartTime
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

  private resolveFairHitKind(timingClass: SwingTimingClass): FairHitKind {
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

  private applyFoulVelocity(
    ballBody: Phaser.Physics.Arcade.Body,
    timingClass: SwingTimingClass,
    edgeContact: boolean,
  ): void {
    let vx: number
    if (edgeContact) {
      const sign = Math.sign(this.ball.x - this.bat.x) || (timingClass === 'muy_tardo' ? 1 : -1)
      vx = sign * HIT_VX_FOUL * Phaser.Math.FloatBetween(0.88, 1.05)
    } else if (timingClass === 'muy_pronto') {
      vx = -HIT_VX_FOUL * Phaser.Math.FloatBetween(0.9, 1.12)
    } else {
      vx = HIT_VX_FOUL * Phaser.Math.FloatBetween(0.9, 1.12)
    }
    const vy = Phaser.Math.FloatBetween(HIT_VY_FOUL - 70, HIT_VY_FOUL + 50)
    ballBody.setVelocity(vx, vy)
  }

  private applyFairHitVelocity(
    ballBody: Phaser.Physics.Arcade.Body,
    kind: FairHitKind,
    timingClass: SwingTimingClass,
  ): void {
    const pull = timingClass === 'pronto'
    const oppo = timingClass === 'tardo'
    const dirX = pull ? -1 : oppo ? 1 : Phaser.Math.FloatBetween(0, 1) < 0.5 ? -1 : 1

    switch (kind) {
      case 'HR':
        ballBody.setVelocity(Phaser.Math.FloatBetween(-28, 28), HIT_VY_HR)
        break
      case 'TRIPLE':
        ballBody.setVelocity(dirX * HIT_VX_TRIPLE, HIT_VY_TRIPLE)
        break
      case 'DOUBLE':
        ballBody.setVelocity(dirX * HIT_VX_DOUBLE, HIT_VY_DOUBLE)
        break
      default:
        ballBody.setVelocity(dirX * HIT_VX_SINGLE, HIT_VY_SINGLE)
        break
    }
  }

  private showImpactForFairHit(
    x: number,
    y: number,
    kind: FairHitKind,
    timingClass: SwingTimingClass,
  ): void {
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
    const label = this.add
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

    this.tweens.add({
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

  private onFairHitOutcome(kind: FairHitKind): void {
    const scored = this.advanceRunnersForFairKind(kind)
    this.runsScored += scored
    this.refreshMiniDiamond()
    this.refreshRunsHud()

    if (kind === 'HR' || kind === 'TRIPLE' || kind === 'DOUBLE') {
      this.activateBattedBallCamera(kind)
    }

    this.awardXpForFairHit(kind)
  }

  private advanceRunnersForFairKind(kind: FairHitKind): number {
    let [b1, b2, b3] = this.runners
    let scored = 0

    if (kind === 'HR') {
      scored = (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0) + 1
      this.runners = [false, false, false]
      return scored
    }

    if (kind === 'TRIPLE') {
      scored = (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0)
      this.runners = [false, false, true]
      return scored
    }

    if (kind === 'DOUBLE') {
      if (b3) {
        scored++
      }
      if (b2) {
        scored++
      }
      const newThird = b1
      this.runners = [false, true, newThird]
      return scored
    }

    if (b3) {
      scored++
    }
    const newThird = b2
    const newSecond = b1
    this.runners = [true, newSecond, newThird]
    return scored
  }

  private scheduleBattedPlayResolution(): void {
    if (this.playEndScheduled || !this.awaitingBattedResolution) {
      return
    }
    this.playEndScheduled = true
    this.getBallBody().setVelocity(0, 0)

    const kind = this.lastBannerKind
    if (kind !== null) {
      this.showBigCenterPlayResult(kind)
    }

    this.time.delayedCall(1380, () => {
      this.awaitingBattedResolution = false
      this.playEndScheduled = false
      this.lastBannerKind = null
      this.resetBall()
    })
  }

  private bannerTextForKind(kind: PlayBannerKind): string {
    switch (kind) {
      case 'HR':
        return '¡HOME RUN!'
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

  private showBigCenterPlayResult(kind: PlayBannerKind): void {
    const text = this.bannerTextForKind(kind)
    const foul = kind === 'FOUL'
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 36, text, {
        fontFamily: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
        fontSize: foul ? '56px' : '62px',
        color: foul ? '#d8dee9' : '#ffe6a8',
        stroke: foul ? '#1a1a22' : '#3a2200',
        strokeThickness: foul ? 8 : 10,
      })
      .setOrigin(0.5)
      .setDepth(240)
      .setAlpha(0)
      .setScale(0.45)
    label.setScrollFactor(0, 0)

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: foul ? 1 : 1.05,
      duration: 200,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.tweens.add({
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

  private createMiniDiamondHud(): void {
    const padX = 20
    const padY = 22

    this.runsHudText = this.add
      .text(GAME_WIDTH - padX, padY, 'Runs 0', {
        font: '600 13px system-ui, "Segoe UI", sans-serif',
        color: '#d4c9b0',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    this.miniDiamondG = this.add.graphics()
    this.miniDiamondG.setScrollFactor(0, 0)
    this.miniDiamondG.setDepth(155)
  }

  private refreshRunsHud(): void {
    this.runsHudText.setText(`Runs ${this.runsScored}`)
  }

  private refreshMiniDiamond(): void {
    const g = this.miniDiamondG
    g.clear()

    const ox = GAME_WIDTH - 46
    const oy = 72
    const s = 8

    const drawRhomb = (cx: number, cy: number, filled: boolean, home: boolean) => {
      g.fillStyle(home ? 0xf2f2f2 : filled ? 0xf0cf50 : 0x1e1e24, home ? 0.35 : filled ? 1 : 0.55)
      g.lineStyle(1, home ? 0xffffff : 0xe8e0c8, home ? 0.55 : filled ? 0.9 : 0.3)
      g.beginPath()
      g.moveTo(cx, cy - s)
      g.lineTo(cx + s, cy)
      g.lineTo(cx, cy + s)
      g.lineTo(cx - s, cy)
      g.closePath()
      g.fillPath()
      g.beginPath()
      g.moveTo(cx, cy - s)
      g.lineTo(cx + s, cy)
      g.lineTo(cx, cy + s)
      g.lineTo(cx - s, cy)
      g.closePath()
      g.strokePath()
    }

    const hx = 0
    const hy = 28
    drawRhomb(ox + hx, oy + hy, false, true)
    drawRhomb(ox + hx + 20, oy + hy - 16, this.runners[0], false)
    drawRhomb(ox + hx, oy + hy - 34, this.runners[1], false)
    drawRhomb(ox + hx - 20, oy + hy - 16, this.runners[2], false)
  }

  private showLevelUpToast(): void {
    const t = this.add
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

    this.tweens.add({
      targets: t,
      alpha: 1,
      scale: 1,
      duration: 170,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.time.delayedCall(420, () => {
          this.tweens.add({
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

  private ensureHrSparkTexture(): void {
    if (this.textures.exists(HR_SPARK_TEXTURE_KEY)) {
      return
    }
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(6, 6, 6)
    g.fillStyle(0xfff8c8, 0.75)
    g.fillCircle(6, 6, 3)
    g.generateTexture(HR_SPARK_TEXTURE_KEY, 12, 12)
    g.destroy()
  }

  /** Destellos que explotan desde el punto de impacto (home run). */
  private spawnHomeRunSparkleBurst(x: number, y: number): void {
    this.ensureHrSparkTexture()

    const burst = (
      count: number,
      speedMin: number,
      speedMax: number,
      lifespan: number,
      scaleStart: number,
    ): void => {
      const emitter = this.add.particles(x, y, HR_SPARK_TEXTURE_KEY, {
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
      this.time.delayedCall(lifespan + 80, () => {
        emitter.destroy()
      })
    }

    burst(28, 220, 480, 520, 1.15)
    this.time.delayedCall(45, () => {
      burst(14, 80, 260, 420, 0.65)
    })
  }

  private showPerfectImpactLabel(x: number, y: number): void {
    const label = this.add
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

    this.tweens.add({
      targets: label,
      scale: 1.08,
      alpha: 1,
      duration: 220,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.tweens.add({
          targets: label,
          scale: 1,
          duration: 120,
          ease: Phaser.Math.Easing.Sine.Out,
          onComplete: () => {
            this.tweens.add({
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

  private resetBall(): void {
    this.restoreDefaultCamera()
    this.awaitingBattedResolution = false
    this.playEndScheduled = false
    this.lastBannerKind = null
    this.ball.setPosition(PITCHER_X, PITCHER_Y)
    this.ball.setScale(BALL_SCALE_FAR)
    this.ballInPlay = true
    this.syncBallBodyRadius()
    this.getBallBody().setVelocity(0, 0)
    this.pitchTargetX = PLATE_X
    this.pitchTargetY = PLATE_Y
    this.pitcherWindup(() => {
      this.startBallFlight()
    })
  }

  /**
   * Señal visual antes del lanzamiento: el lanzador crece un poco y se desplaza
   * lateralmente como tomando impulso; al terminar se llama `onRelease` (salida de la bola).
   */
  private pitcherWindup(onRelease: () => void): void {
    const p = this.pitcherMound
    this.tweens.killTweensOf(p)
    p.setPosition(PITCHER_X, PITCHER_Y)
    p.setScale(1)

    this.tweens.chain({
      tweens: [
        {
          targets: p,
          scaleX: 1.12,
          scaleY: 1.18,
          x: PITCHER_X - 5,
          duration: 155,
          ease: Phaser.Math.Easing.Sine.Out,
        },
        {
          targets: p,
          scaleX: 1.06,
          scaleY: 1.1,
          x: PITCHER_X + 6,
          duration: 135,
          ease: Phaser.Math.Easing.Sine.InOut,
        },
        {
          targets: p,
          scaleX: 1,
          scaleY: 1,
          x: PITCHER_X,
          duration: 145,
          ease: Phaser.Math.Easing.Sine.InOut,
          onComplete: () => {
            onRelease()
          },
        },
      ],
    })
  }

  private startBallFlight(): void {
    const t = this.pickRandomStrikeTarget()
    this.pitchTargetX = t.x
    this.pitchTargetY = t.y
    const ballBody = this.getBallBody()
    const dx = this.pitchTargetX - PITCHER_X
    const dy = this.pitchTargetY - PITCHER_Y
    const len = Math.hypot(dx, dy) || 1
    const speed = this.currentPitchSpeed
    ballBody.setVelocity((dx / len) * speed, (dy / len) * speed)
  }

  /**
   * Escala la pelota según su avance de fondo a frente (hacia la cámara)
   * y ajusta el círculo físico para que el contacto coincida con el dibujo.
   */
  private updateBallApproachScale(): void {
    if (!this.ballInPlay) {
      return
    }
    const body = this.getBallBody()
    if (Math.abs(body.velocity.x) + Math.abs(body.velocity.y) < 0.5) {
      return
    }

    const vx = this.pitchTargetX - PITCHER_X
    const vy = this.pitchTargetY - PITCHER_Y
    const lenSq = vx * vx + vy * vy || 1
    const t = Phaser.Math.Clamp(
      ((this.ball.x - PITCHER_X) * vx + (this.ball.y - PITCHER_Y) * vy) / lenSq,
      0,
      1,
    )
    const scale = Phaser.Math.Linear(BALL_SCALE_FAR, BALL_SCALE_NEAR, t)
    this.ball.setScale(scale)
    this.syncBallBodyRadius()
  }

  private syncBallBodyRadius(): void {
    const s = this.ball.scaleX
    this.getBallBody().setCircle(BALL_RADIUS * s)
  }

  private isBallOutOfBounds(): boolean {
    const margin = 48
    return (
      this.ball.y < -margin ||
      this.ball.y > GAME_HEIGHT + margin ||
      this.ball.x < -margin ||
      this.ball.x > GAME_WIDTH + margin
    )
  }

  private drawField(): void {
    const g = this.add.graphics()

    // Cielo / horizonte lejano
    g.fillStyle(0x274a30, 1)
    g.fillRect(0, 0, GAME_WIDTH, 118)
    // Pasto general
    g.fillStyle(0x3a8f47, 1)
    g.fillRect(0, 118, GAME_WIDTH, GAME_HEIGHT - 118)

    // Tierra interior (trapecio en perspectiva)
    const dirtTopY = 198
    const dirtBotY = PLATE_Y + 38
    const dirtHalfWTop = 118
    const dirtHalfWBot = 298
    g.fillStyle(0xc9a06d, 1)
    g.beginPath()
    g.moveTo(PLATE_X - dirtHalfWBot, dirtBotY)
    g.lineTo(PLATE_X + dirtHalfWBot, dirtBotY)
    g.lineTo(PLATE_X + dirtHalfWTop, dirtTopY)
    g.lineTo(PLATE_X - dirtHalfWTop, dirtTopY)
    g.closePath()
    g.fillPath()

    // Sutileza de sombreado en el fondo del diamante
    g.fillStyle(0xb88f5a, 0.35)
    g.beginPath()
    g.moveTo(PLATE_X - dirtHalfWTop * 0.72, dirtTopY + 22)
    g.lineTo(PLATE_X + dirtHalfWTop * 0.72, dirtTopY + 22)
    g.lineTo(PLATE_X + dirtHalfWBot * 0.55, dirtBotY - 28)
    g.lineTo(PLATE_X - dirtHalfWBot * 0.55, dirtBotY - 28)
    g.closePath()
    g.fillPath()

    // Zona de strike en el suelo (referencia de contacto)
    const szTop = STRIKE_ZONE_TOP
    const szBot = STRIKE_ZONE_BOT
    const szHalfTop = STRIKE_HALF_W_TOP
    const szHalfBot = STRIKE_HALF_W_BOT
    g.fillStyle(0xfff6e8, 0.09)
    g.beginPath()
    g.moveTo(PLATE_X - szHalfBot, szBot)
    g.lineTo(PLATE_X + szHalfBot, szBot)
    g.lineTo(PLATE_X + szHalfTop, szTop)
    g.lineTo(PLATE_X - szHalfTop, szTop)
    g.closePath()
    g.fillPath()
    g.lineStyle(1, 0xffffff, 0.18)
    g.beginPath()
    g.moveTo(PLATE_X - szHalfBot, szBot)
    g.lineTo(PLATE_X + szHalfBot, szBot)
    g.lineTo(PLATE_X + szHalfTop, szTop)
    g.lineTo(PLATE_X - szHalfTop, szTop)
    g.closePath()
    g.strokePath()

    // Líneas de foul hacia el punto de fuga
    g.lineStyle(3, 0xf5f5f5, 0.92)
    g.beginPath()
    g.moveTo(PLATE_X - 52, PLATE_Y - 6)
    g.lineTo(PERSP_VANISH_X - 168, PERSP_VANISH_Y + 18)
    g.strokePath()
    g.beginPath()
    g.moveTo(PLATE_X + 52, PLATE_Y - 6)
    g.lineTo(PERSP_VANISH_X + 168, PERSP_VANISH_Y + 18)
    g.strokePath()

    // Aristas del diamante (perspectiva)
    g.lineStyle(2, 0xffffff, 0.88)
    g.beginPath()
    g.moveTo(PLATE_X, PLATE_Y - 8)
    g.lineTo(532, 378)
    g.lineTo(400, 218)
    g.lineTo(268, 378)
    g.closePath()
    g.strokePath()

    this.drawBase(g, 532, 378, 12)
    this.drawBase(g, 400, 218, 12)
    this.drawBase(g, 268, 378, 12)
    this.drawHomePlate(g, PLATE_X, PLATE_Y)

    g.setDepth(0)
  }

  private drawBase(g: Phaser.GameObjects.Graphics, cx: number, cy: number, half: number): void {
    g.fillStyle(0xffffff, 1)
    g.fillRect(cx - half, cy - half, half * 2, half * 2)
  }

  private drawHomePlate(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const w = 16
    const h = 10
    g.fillStyle(0xffffff, 1)
    g.beginPath()
    g.moveTo(x - w, y - h)
    g.lineTo(x + w, y - h)
    g.lineTo(x + w, y)
    g.lineTo(x, y + h * 0.6)
    g.lineTo(x - w, y)
    g.closePath()
    g.fillPath()
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

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
const PITCHER_FILL_DEFAULT = 0xd4b48c
const PITCHER_STROKE_DEFAULT = 0x8b6914
/** Dorado suave durante la señal de “lanzamiento inminente”. */
const PITCHER_FILL_GOLD = 0xe8d9b8
const PITCHER_STROKE_GOLD = 0xc4a85a
/** Tiempo de aviso visual antes de `startBallFlight()`. */
const PITCHER_PREP_MS = 500

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
/** Línea donde el pasto sustituye al cielo (debajo van las gradas). */
const HORIZON_GRASS_Y = 118

/** Banda inferior “Old Money”: línea de progreso y etiqueta. */
const XP_LINE_Y = GAME_HEIGHT - 11
const XP_LABEL_Y = GAME_HEIGHT - 30
const XP_HUD_BAND_H = 42

/** Textura generada para destellos del home run. */
const HR_SPARK_TEXTURE_KEY = 'hr_spark'
/** Partículas blanco/dorado en el contacto bate–pelota (fair). */
const BAT_CONTACT_SPARK_KEY = 'bat_contact_spark'
/** Estela suave detrás de la pelota en vuelo. */
const BALL_TRAIL_TEXTURE_KEY = 'ball_trail_pix'

/** Hit-stop en timing perfecto (ms). */
const PERFECT_HIT_STOP_MS = 50

/** Power meter: llenado por timing sólido (fair, no foul). */
const POWER_METER_PER_PERFECT = 0.2
const POWER_METER_PER_PRONTO_TARDE = 0.1

/** Barra vertical de poder (HUD derecho). */
const POWER_BAR_W = 11
const POWER_BAR_H = 216
const POWER_BAR_X = GAME_WIDTH - 26
const POWER_BAR_CY = GAME_HEIGHT / 2 - 8

type SwingTimingClass = 'muy_pronto' | 'pronto' | 'perfect' | 'tardo' | 'muy_tardo'

type FairHitKind = 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE'

type PlayBannerKind =
  | FairHitKind
  | 'FOUL'
  | 'MEGA_HR'
  | 'INNING_OVER'
  | 'WALK'
  | 'FLY_OUT'
  | 'OUT'

/** Campo de béisbol (vista desde detrás del home con perspectiva). */
export class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc
  private bat!: Phaser.GameObjects.Rectangle
  /** Lanzador en el fondo (elipse para sensación de perspectiva). */
  private pitcherMound!: Phaser.GameObjects.Ellipse
  private spaceKey!: Phaser.Input.Keyboard.Key
  private goldenSwingKey!: Phaser.Input.Keyboard.Key

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
  /** Si el objetivo del lanzamiento cae dentro de la zona de strike (false = lanzamiento malo). */
  private pitchTargetInZone = true
  /** Si el bateador intentó swing en el lanzamiento actual. */
  private swingAttemptedThisPitch = false

  /** Bases ocupadas: 1ª, 2ª, 3ª (índice 0 = primera). */
  private runners: [boolean, boolean, boolean] = [false, false, false]
  private runsScored = 0

  private miniDiamondG!: Phaser.GameObjects.Graphics
  private runsHudText!: Phaser.GameObjects.Text
  private strikeDots: Phaser.GameObjects.Arc[] = []
  private outDots: Phaser.GameObjects.Arc[] = []
  private ballDots: Phaser.GameObjects.Arc[] = []
  private strikes = 0
  private outs = 0
  private balls = 0

  private awaitingBattedResolution = false
  private battedBallStartTime = 0
  private playEndScheduled = false
  private lastBannerKind: PlayBannerKind | null = null

  /** Público en gradas (puntos de color) para animar ovación en HR. */
  private crowdSpectators: { dot: Phaser.GameObjects.Arc; baseX: number; baseY: number }[] =
    []

  /** Objetivo de tween para la fase dorada pre-lanzamiento (permite `killTweensOf`). */
  private readonly pitcherPrepTweenTarget = { progress: 0 }

  /** Indicador en el punto de impacto previsto del lanzamiento. */
  private pitchTargetMarker!: Phaser.GameObjects.Arc
  private ballTrailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter
  /** Estela dorada masiva tras un MEGA HOME RUN (Golden Swing). */
  private goldenMegaBattedEmitter!: Phaser.GameObjects.Particles.ParticleEmitter

  /** 0–1: Golden Swing disponible al llegar a 1 (activar con S). */
  private powerMeter = 0
  private goldenSwingActive = false
  private batGlow!: Phaser.GameObjects.Rectangle
  private powerMeterFill!: Phaser.GameObjects.Rectangle
  /** Marco interior oscuro (referencia para alinear el relleno con el borde inferior). */
  private powerMeterFrameInner!: Phaser.GameObjects.Rectangle
  private powerMeterFrame!: Phaser.GameObjects.Graphics
  private powerMeterShine!: Phaser.GameObjects.Graphics
  private powerMeterReadyTween?: Phaser.Tweens.Tween

  /** Inicio del vuelo del lanzamiento (curva + estela). */
  private pitchReleaseTime = 0
  private pitchReleased = false
  private pitchCurveAmp = 42
  private pitchCurveWaves = 2.6
  private pitchCurvePhase = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.drawField()
    this.createGrandstandAndCrowd()

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

    this.batGlow = this.add.rectangle(
      GAME_WIDTH / 2,
      BAT_ANCHOR_Y,
      BAT_WIDTH + 14,
      BAT_HEIGHT + 8,
      0xffc94a,
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

    const batBody = this.getBatBody()
    batBody.updateFromGameObject()

    this.getBallBody().setVelocity(0, 0)
    this.pitcherWindup(() => {
      this.startBallFlight()
    })

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.goldenSwingKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)

    this.createXpHud()
    this.createPowerMeterHud()
    this.createMiniDiamondHud()
    this.createStrikeOutHud()

    this.physics.add.overlap(this.ball, this.bat, () => {
      this.handleBallBatOverlap()
    })

    this.setupMainCamera()
    this.ensureHrSparkTexture()
    this.ensureBatContactSparkTexture()
    this.ensureBallTrailTexture()
    this.createPitchTargetMarker()
    this.createBallTrailEmitter()
    this.createGoldenMegaBattedEmitter()
    this.refreshMiniDiamond()
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
      this.applyPitchCurveMotion()
    }

    if (this.ballInPlay && this.isBallOutOfBounds()) {
      this.handleDeadPitchResolution()
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

    const badTiming = timingClass === 'muy_pronto' || timingClass === 'muy_tardo'
    if (
      badTiming &&
      edgeContact &&
      Phaser.Math.FloatBetween(0, 1) < 0.6
    ) {
      this.lastBannerKind = Phaser.Math.FloatBetween(0, 1) < 0.5 ? 'FLY_OUT' : 'OUT'
      this.hidePitchTargetMarker()
      this.stopBallTrail()
      this.applyFlyOutVelocity(ballBody)
      this.resetAtBatCount()
      this.registerOut()
      return
    }

    const isFoul = badTiming || edgeContact

    if (isFoul) {
      this.lastBannerKind = 'FOUL'
      this.hidePitchTargetMarker()
      this.stopBallTrail()
      this.applyFoulVelocity(ballBody, timingClass, edgeContact)
      this.registerStrikeOnFoul()
      return
    }

    this.resetAtBatCount()

    this.addPowerMeterFromTiming(timingClass)

    let fairKind: FairHitKind
    let isMegaHit = false

    if (this.goldenSwingActive) {
      this.goldenSwingActive = false
      this.setBatGoldenGlow(false)
      fairKind = 'HR'
      this.lastBannerKind = 'MEGA_HR'
      isMegaHit = true
    } else {
      fairKind = this.resolveFairHitKind(timingClass)
      this.lastBannerKind = fairKind
    }

    this.hidePitchTargetMarker()
    this.stopBallTrail()

    this.spawnBatContactParticles(impactX, impactY, fairKind, isMegaHit)

    const applyHit = (): void => {
      this.applyFairHitVelocity(ballBody, fairKind, timingClass, isMegaHit ? 2 : 1)
      this.showImpactForFairHit(impactX, impactY, fairKind, timingClass, isMegaHit)
      this.onFairHitOutcome(fairKind)
      if (isMegaHit) {
        this.startGoldenMegaBattedTrail()
      }
    }

    if (timingClass === 'perfect' && !isMegaHit) {
      this.playPerfectHitJuice(impactX, impactY, applyHit)
    } else {
      applyHit()
    }
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

  private createPowerMeterHud(): void {
    const x = POWER_BAR_X
    const cy = POWER_BAR_CY
    const halfH = POWER_BAR_H / 2

    this.add
      .rectangle(x, cy, POWER_BAR_W + 6, POWER_BAR_H + 6, 0x080808, 0.92)
      .setDepth(151)
      .setScrollFactor(0, 0)

    this.powerMeterFrameInner = this.add
      .rectangle(x, cy, POWER_BAR_W - 2, POWER_BAR_H - 4, 0x0c0c0c, 1)
      .setDepth(151)
      .setScrollFactor(0, 0)

    this.powerMeterFill = this.add
      .rectangle(x, cy + halfH - 2, POWER_BAR_W - 4, 0, 0xc4a86a, 0.95)
      .setOrigin(0.5, 1)
      .setDepth(152)
      .setScrollFactor(0, 0)

    this.powerMeterFrame = this.add.graphics()
    this.powerMeterFrame.setDepth(153)
    this.powerMeterFrame.setScrollFactor(0, 0)
    this.powerMeterFrame.lineStyle(1, 0xd4bc7a, 0.92)
    this.powerMeterFrame.strokeRect(
      x - POWER_BAR_W / 2 - 1,
      cy - halfH - 1,
      POWER_BAR_W + 2,
      POWER_BAR_H + 2,
    )

    this.powerMeterShine = this.add.graphics()
    this.powerMeterShine.setDepth(154)
    this.powerMeterShine.setScrollFactor(0, 0)

    this.add
      .text(x, cy + halfH + 14, 'POWER', {
        font: '300 9px Palatino, "Palatino Linotype", Georgia, serif',
        color: '#7a7268',
      })
      .setOrigin(0.5, 0)
      .setDepth(152)
      .setScrollFactor(0, 0)

    this.refreshPowerMeterHud()
  }

  private refreshPowerMeterHud(): void {
    const maxFill = POWER_BAR_H - 6
    const clampedPower = Math.min(1, Math.max(0, this.powerMeter))
    const h = Math.min(maxFill, Math.max(0, maxFill * clampedPower))
    this.powerMeterFill.setOrigin(0.5, 1)
    this.powerMeterFill.height = h
    const bottomY = this.powerMeterFrameInner.getBottomCenter().y
    this.powerMeterFill.setY(bottomY)

    const ready = this.powerMeter >= 1 && !this.goldenSwingActive
    this.refreshPowerMeterReadyShine(ready)
  }

  private refreshPowerMeterReadyShine(ready: boolean): void {
    if (this.powerMeterReadyTween) {
      this.powerMeterReadyTween.stop()
      this.powerMeterReadyTween = undefined
    }

    this.powerMeterShine.clear()

    if (!ready) {
      return
    }

    const x = POWER_BAR_X
    const cy = POWER_BAR_CY
    const halfH = POWER_BAR_H / 2

    const drawShine = (alpha: number): void => {
      this.powerMeterShine.clear()
      this.powerMeterShine.fillStyle(0xfff8e8, alpha * 0.22)
      this.powerMeterShine.fillRect(x - 2, cy - halfH + 4, 3, POWER_BAR_H - 10)
      this.powerMeterShine.lineStyle(1, 0xffe8b0, alpha * 0.85)
      this.powerMeterShine.lineBetween(x + POWER_BAR_W / 2 - 3, cy - halfH + 6, x + POWER_BAR_W / 2 - 3, cy + halfH - 6)
    }

    const shineState = { a: 0.4 }
    drawShine(shineState.a)
    this.powerMeterReadyTween = this.tweens.add({
      targets: shineState,
      a: 1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => drawShine(shineState.a),
    })
  }

  private addPowerMeterFromTiming(timingClass: SwingTimingClass): void {
    if (timingClass === 'perfect') {
      this.powerMeter = Math.min(1, this.powerMeter + POWER_METER_PER_PERFECT)
    } else if (timingClass === 'pronto' || timingClass === 'tardo') {
      this.powerMeter = Math.min(1, this.powerMeter + POWER_METER_PER_PRONTO_TARDE)
    }
    this.refreshPowerMeterHud()
  }

  private tryActivateGoldenSwing(): void {
    if (this.powerMeter < 1 || this.goldenSwingActive) {
      return
    }
    this.powerMeter = 0
    this.goldenSwingActive = true
    this.refreshPowerMeterHud()
    this.setBatGoldenGlow(true)
  }

  private setBatGoldenGlow(on: boolean): void {
    this.batGlow.setVisible(on)
    if (on) {
      this.batGlow.setPosition(this.bat.x, this.bat.y)
      this.batGlow.setAngle(this.bat.angle)
    }
  }

  /**
   * Pelota muerta sin batazo: strike cantado (en zona, sin swing), bola (fuera de zona, sin swing),
   * o strike por swing fallido.
   */
  private handleDeadPitchResolution(): void {
    this.ballInPlay = false

    const swung = this.swingAttemptedThisPitch
    this.swingAttemptedThisPitch = false

    if (!swung) {
      if (this.pitchTargetInZone) {
        this.registerStrike()
        this.resetBall()
      } else {
        this.registerBallFromDeadPitch()
      }
    } else {
      this.registerStrike()
      this.resetBall()
    }
  }

  private registerStrike(): void {
    this.strikes++
    if (this.strikes >= 3) {
      this.resetAtBatCount()
      this.registerOut()
    } else {
      this.refreshStrikeOutHud()
    }
  }

  /** Falta con menos de 2 strikes suma strike; con 2 strikes se mantiene (regla MLB). */
  private registerStrikeOnFoul(): void {
    if (this.strikes < 2) {
      this.registerStrike()
    } else {
      this.refreshStrikeOutHud()
    }
  }

  private registerOut(): void {
    this.outs++
    if (this.outs >= 3) {
      this.showInningOverBanner()
      this.outs = 0
      this.strikes = 0
      this.balls = 0
      this.runners = [false, false, false]
      this.refreshMiniDiamond()
      this.refreshBallsHud()
    }
    this.refreshStrikeOutHud()
  }

  private showInningOverBanner(): void {
    this.showBigCenterPlayResult('INNING_OVER')
  }

  private createStrikeOutHud(): void {
    const rightX = GAME_WIDTH - 20
    const dotSpacing = 14
    const startX = rightX - 3 * dotSpacing - 4

    this.add
      .text(rightX - 62, 86, 'B', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 4; i++) {
      const c = this.add.circle(startX + i * dotSpacing, 96, 4.5, 0x1e2820, 1)
      c.setStrokeStyle(1, 0x3a6a58, 0.45)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.ballDots.push(c)
    }

    this.add
      .text(rightX - 62, 108, 'S', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 3; i++) {
      const c = this.add.circle(startX + i * dotSpacing, 118, 5, 0x2a2a2a, 1)
      c.setStrokeStyle(1, 0x4a4240, 0.85)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.strikeDots.push(c)
    }

    this.add
      .text(rightX - 62, 128, 'O', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 3; i++) {
      const c = this.add.circle(startX + i * dotSpacing, 138, 5, 0x1e1e22, 1)
      c.setStrokeStyle(1, 0x8a7a58, 0.4)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.outDots.push(c)
    }

    this.refreshStrikeOutHud()
    this.refreshBallsHud()
  }

  private refreshBallsHud(): void {
    for (let i = 0; i < 4; i++) {
      const on = this.balls > i
      this.ballDots[i].setFillStyle(on ? 0x2ecc9f : 0x1e2820, 1)
      this.ballDots[i].setStrokeStyle(1, on ? 0x5ee8d0 : 0x3a6a58, on ? 0.95 : 0.45)
    }
  }

  /** Pone bolas y strikes a 0 y actualiza el HUD (fin de turno al bate). */
  private resetAtBatCount(): void {
    this.balls = 0
    this.strikes = 0
    this.refreshBallsHud()
    this.refreshStrikeOutHud()
  }

  private registerBallFromDeadPitch(): void {
    this.balls++
    this.refreshBallsHud()
    if (this.balls >= 4) {
      this.executeWalk()
    } else {
      this.showBolBannerThenResetPitch()
    }
  }

  private executeWalk(): void {
    const scored = this.advanceRunnersForFairKind('SINGLE')
    this.runsScored += scored
    this.resetAtBatCount()
    this.refreshMiniDiamond()
    this.refreshRunsHud()
    this.showBigCenterPlayResult('WALK')
    this.time.delayedCall(1380, () => {
      this.resetBall()
    })
  }

  private showBolBannerThenResetPitch(): void {
    const label = this.add
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

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: 1.02,
      duration: 180,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          scale: 1.08,
          duration: 420,
          delay: 280,
          ease: Phaser.Math.Easing.Cubic.In,
          onComplete: () => {
            label.destroy()
            this.resetBall()
          },
        })
      },
    })
  }

  private refreshStrikeOutHud(): void {
    for (let i = 0; i < 3; i++) {
      const strikeOn = this.strikes > i
      this.strikeDots[i].setFillStyle(strikeOn ? 0xdc3333 : 0x2a2a2a, 1)
      this.strikeDots[i].setStrokeStyle(1, strikeOn ? 0xff6666 : 0x4a4240, strikeOn ? 0.95 : 0.55)

      const outOn = this.outs > i
      this.outDots[i].setFillStyle(outOn ? 0xf8edd4 : 0x1e1e22, 1)
      this.outDots[i].setStrokeStyle(1, outOn ? 0xffe8b0 : 0xc4a96a, outOn ? 0.95 : 0.4)
    }
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
    if (this.lastBannerKind === 'MEGA_HR') {
      xp += 18
    }
    this.addXp(xp)
  }

  private isPointInStrikeZone(px: number, py: number): boolean {
    if (py < STRIKE_ZONE_TOP || py > STRIKE_ZONE_BOT) {
      return false
    }
    const u = (py - STRIKE_ZONE_TOP) / (STRIKE_ZONE_BOT - STRIKE_ZONE_TOP)
    const half = STRIKE_HALF_W_TOP + (STRIKE_HALF_W_BOT - STRIKE_HALF_W_TOP) * u
    return Math.abs(px - PLATE_X) <= half - 2
  }

  private pickRandomOutsideStrikeTarget(): { x: number; y: number } {
    for (let attempt = 0; attempt < 20; attempt++) {
      const y = Phaser.Math.FloatBetween(STRIKE_ZONE_TOP - 42, STRIKE_ZONE_BOT + 38)
      const x = Phaser.Math.FloatBetween(PLATE_X - 120, PLATE_X + 120)
      if (!this.isPointInStrikeZone(x, y)) {
        return { x, y }
      }
    }
    return { x: PLATE_X + 75, y: STRIKE_ZONE_TOP - 20 }
  }

  private pickRandomStrikeTarget(): { x: number; y: number; inZone: boolean } {
    if (Phaser.Math.FloatBetween(0, 1) < 0.3) {
      const o = this.pickRandomOutsideStrikeTarget()
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

  private applyFlyOutVelocity(ballBody: Phaser.Physics.Arcade.Body): void {
    const dir = Phaser.Math.FloatBetween(0, 1) < 0.5 ? -1 : 1
    ballBody.setVelocity(
      dir * Phaser.Math.FloatBetween(140, 240),
      Phaser.Math.FloatBetween(-400, -560),
    )
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

  private showImpactForFairHit(
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

    if (kind === 'HR') {
      this.playCrowdOvacion()
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

  private showBigCenterPlayResult(kind: PlayBannerKind): void {
    const text = this.bannerTextForKind(kind)
    const foul = kind === 'FOUL'
    const mega = kind === 'MEGA_HR'
    const inningEnd = kind === 'INNING_OVER'
    const walk = kind === 'WALK'
    const airOut = kind === 'FLY_OUT' || kind === 'OUT'
    const label = this.add
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

    this.tweens.add({
      targets: label,
      alpha: 1,
      scale: foul ? 1 : inningEnd ? 1.02 : walk ? 1.03 : airOut ? 1.04 : 1.05,
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

  private ensureBatContactSparkTexture(): void {
    if (this.textures.exists(BAT_CONTACT_SPARK_KEY)) {
      return
    }
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 0.95)
    g.fillCircle(5, 5, 5)
    g.fillStyle(0xffe2a0, 0.55)
    g.fillCircle(5, 5, 2.5)
    g.generateTexture(BAT_CONTACT_SPARK_KEY, 10, 10)
    g.destroy()
  }

  /**
   * Explosión de partículas en el impacto (solo fair).
   * Home run: más partículas, vida más larga y disparo omnidireccional más violento.
   */
  private spawnBatContactParticles(
    x: number,
    y: number,
    kind: FairHitKind,
    goldenMega = false,
  ): void {
    this.ensureBatContactSparkTexture()

    if (goldenMega) {
      const burst = (count: number, smin: number, smax: number, life: number, sc: number): void => {
        const emitter = this.add.particles(x, y, BAT_CONTACT_SPARK_KEY, {
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
        this.time.delayedCall(life + 120, () => emitter.destroy())
      }
      burst(95, 380, 920, 900, 1.35)
      this.time.delayedCall(40, () => {
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

    const emitter = this.add.particles(x, y, BAT_CONTACT_SPARK_KEY, {
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
    this.time.delayedCall(cleanupMs, () => {
      emitter.destroy()
    })
  }

  /** Ráfaga adicional dorada en el impacto MEGA (Golden Swing). */
  private spawnMegaGoldenImpactBurst(x: number, y: number): void {
    this.ensureHrSparkTexture()
    const emitter = this.add.particles(x, y, HR_SPARK_TEXTURE_KEY, {
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
    this.time.delayedCall(760, () => emitter.destroy())
  }

  private showMegaHomeRunImpactLabel(x: number, y: number): void {
    const label = this.add
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

    this.tweens.add({
      targets: label,
      scale: 1.12,
      alpha: 1,
      duration: 220,
      ease: Phaser.Math.Easing.Back.Out,
      onComplete: () => {
        this.tweens.add({
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
    this.pitchReleased = false
    this.hidePitchTargetMarker()
    this.stopBallTrail()
    this.stopGoldenMegaBattedTrail()
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
    this.tweens.killTweensOf(this.pitcherPrepTweenTarget)
    p.setFillStyle(PITCHER_FILL_DEFAULT, 1)
    p.setStrokeStyle(2, PITCHER_STROKE_DEFAULT, 0.95)
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
            this.runPitcherPreparationCue(onRelease)
          },
        },
      ],
    })
  }

  /** Interpola dos colores RGB empaquetados (0xRRGGBB). */
  private lerpColor(c0: number, c1: number, t: number): number {
    const u = Phaser.Math.Clamp(t, 0, 1)
    const r0 = (c0 >> 16) & 0xff
    const g0 = (c0 >> 8) & 0xff
    const b0 = c0 & 0xff
    const r1 = (c1 >> 16) & 0xff
    const g1 = (c1 >> 8) & 0xff
    const b1 = c1 & 0xff
    const r = Math.round(r0 + (r1 - r0) * u)
    const g = Math.round(g0 + (g1 - g0) * u)
    const b = Math.round(b0 + (b1 - b0) * u)
    return (r << 16) | (g << 8) | b
  }

  /**
   * Tras el windup: elipse en dorado suave con leve pulso (parpadeo) 500 ms,
   * luego se lanza la bola y se restaura el color del montículo.
   */
  private runPitcherPreparationCue(onRelease: () => void): void {
    const p = this.pitcherMound
    this.tweens.killTweensOf(this.pitcherPrepTweenTarget)
    this.pitcherPrepTweenTarget.progress = 0

    this.tweens.add({
      targets: this.pitcherPrepTweenTarget,
      progress: 1,
      duration: PITCHER_PREP_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => {
        const pr = this.pitcherPrepTweenTarget.progress
        const pulse = Math.sin(pr * Math.PI * 5) * 0.2
        const mix = Phaser.Math.Clamp(pr * 0.88 + pulse, 0, 1)
        p.setFillStyle(this.lerpColor(PITCHER_FILL_DEFAULT, PITCHER_FILL_GOLD, mix), 1)
        p.setStrokeStyle(
          2,
          this.lerpColor(PITCHER_STROKE_DEFAULT, PITCHER_STROKE_GOLD, mix),
          0.95,
        )
      },
      onComplete: () => {
        p.setFillStyle(PITCHER_FILL_DEFAULT, 1)
        p.setStrokeStyle(2, PITCHER_STROKE_DEFAULT, 0.95)
        onRelease()
      },
    })
  }

  private startBallFlight(): void {
    const t = this.pickRandomStrikeTarget()
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
    this.syncBallBodyRadius()

    this.showPitchTargetMarker()
    this.startBallTrail()
  }

  /**
   * Escala la pelota según su avance de fondo a frente (hacia la cámara)
   * y ajusta el círculo físico para que el contacto coincida con el dibujo.
   */
  private updateBallApproachScale(): void {
    if (!this.ballInPlay || !this.pitchReleased) {
      return
    }

    const vx = this.pitchTargetX - PITCHER_X
    const vy = this.pitchTargetY - PITCHER_Y
    const totalLen = Math.hypot(vx, vy) || 1
    const elapsed = (this.time.now - this.pitchReleaseTime) / 1000
    const s = elapsed * this.currentPitchSpeed
    const t = Phaser.Math.Clamp(s / totalLen, 0, 1)
    const scale = Phaser.Math.Linear(BALL_SCALE_FAR, BALL_SCALE_NEAR, t)
    this.ball.setScale(scale)
    this.syncBallBodyRadius()
  }

  /**
   * Trayectoria con ligera curvatura lateral (senoidal) sobre la línea base
   * lanzador → objetivo; la pelota se coloca en cada frame (v = 0).
   */
  private applyPitchCurveMotion(): void {
    if (!this.pitchReleased) {
      return
    }
    const dx = this.pitchTargetX - PITCHER_X
    const dy = this.pitchTargetY - PITCHER_Y
    const totalLen = Math.hypot(dx, dy) || 1
    const ux = dx / totalLen
    const uy = dy / totalLen
    const px = -uy
    const py = ux
    const elapsed = (this.time.now - this.pitchReleaseTime) / 1000
    const s = elapsed * this.currentPitchSpeed
    const lateral =
      this.pitchCurveAmp *
      Math.sin((s / totalLen) * Math.PI * this.pitchCurveWaves + this.pitchCurvePhase)
    const x = PITCHER_X + ux * s + px * lateral
    const y = PITCHER_Y + uy * s + py * lateral
    this.ball.setPosition(x, y)
    this.getBallBody().setVelocity(0, 0)
  }

  private ensureBallTrailTexture(): void {
    if (this.textures.exists(BALL_TRAIL_TEXTURE_KEY)) {
      return
    }
    const g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 0.92)
    g.fillCircle(4, 4, 3)
    g.generateTexture(BALL_TRAIL_TEXTURE_KEY, 8, 8)
    g.destroy()
  }

  private createPitchTargetMarker(): void {
    this.pitchTargetMarker = this.add.circle(PLATE_X, PLATE_Y, 9, 0x000000, 0)
    this.pitchTargetMarker.setStrokeStyle(2, 0xfff2d0, 0.42)
    this.pitchTargetMarker.setDepth(15)
    this.pitchTargetMarker.setVisible(false)
  }

  private createBallTrailEmitter(): void {
    this.ensureBallTrailTexture()
    const emitter = this.add.particles(0, 0, BALL_TRAIL_TEXTURE_KEY, {
      follow: this.ball,
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

  private showPitchTargetMarker(): void {
    this.pitchTargetMarker.setPosition(this.pitchTargetX, this.pitchTargetY)
    this.pitchTargetMarker.setVisible(true)
  }

  private hidePitchTargetMarker(): void {
    this.pitchTargetMarker.setVisible(false)
  }

  private startBallTrail(): void {
    this.ballTrailEmitter.start()
  }

  private stopBallTrail(): void {
    this.ballTrailEmitter.stop()
  }

  private createGoldenMegaBattedEmitter(): void {
    this.ensureBatContactSparkTexture()
    const emitter = this.add.particles(0, 0, BAT_CONTACT_SPARK_KEY, {
      follow: this.ball,
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

  private startGoldenMegaBattedTrail(): void {
    this.goldenMegaBattedEmitter.start()
  }

  private stopGoldenMegaBattedTrail(): void {
    this.goldenMegaBattedEmitter.stop()
  }

  /**
   * Hit-stop + flash + CRACK!; tras la pausa aplica el batazo con `onAfterFreeze`.
   */
  private playPerfectHitJuice(
    impactX: number,
    impactY: number,
    onAfterFreeze: () => void,
  ): void {
    this.physics.world.pause()
    this.tweens.pauseAll()

    const flash = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH + 16,
        GAME_HEIGHT + 16,
        0xffffff,
        0.1,
      )
      .setDepth(378)

    const crack = this.add
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
      this.physics.world.resume()
      this.tweens.resumeAll()
      this.tweens.add({
        targets: crack,
        scale: 1.18,
        duration: 72,
        ease: Phaser.Math.Easing.Back.Out,
        onComplete: () => {
          this.tweens.add({
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

  /** Colores de camisetas / público para los puntos del graderío. */
  private pickRandomCrowdColor(): number {
    const palette = [
      0xffffff, 0xffe4e4, 0xff6b6b, 0xff9f43, 0xfeca57, 0x48dbfb, 0x1dd1a1, 0x5f27cd,
      0xff9ff3, 0x54a0ff, 0xee5a6f, 0xc8d6e5, 0xffd32a, 0x26de81, 0x3867d6, 0xf368e0,
    ]
    return palette[Phaser.Math.Between(0, palette.length - 1)]
  }

  /**
   * Gradas simples en el horizonte y puntos de público.
   * Los puntos guardan posición base para la ovación en HR.
   */
  private createGrandstandAndCrowd(): void {
    const stand = this.add.graphics()
    stand.setDepth(1)

    const cx = GAME_WIDTH / 2
    const bottomY = HORIZON_GRASS_Y - 2

    const tiers: { y0: number; y1: number; halfB: number; halfT: number; fill: number }[] = [
      { y0: bottomY, y1: 96, halfB: 402, halfT: 312, fill: 0x221f1c },
      { y0: 96, y1: 72, halfB: 308, halfT: 248, fill: 0x2c2722 },
      { y0: 72, y1: 48, halfB: 246, halfT: 178, fill: 0x383028 },
    ]

    for (const t of tiers) {
      stand.fillStyle(t.fill, 1)
      stand.beginPath()
      stand.moveTo(cx - t.halfB, t.y0)
      stand.lineTo(cx + t.halfB, t.y0)
      stand.lineTo(cx + t.halfT, t.y1)
      stand.lineTo(cx - t.halfT, t.y1)
      stand.closePath()
      stand.fillPath()

      stand.lineStyle(1, 0x4a4238, 0.55)
      stand.beginPath()
      stand.moveTo(cx - t.halfB, t.y0)
      stand.lineTo(cx + t.halfB, t.y0)
      stand.strokePath()

      stand.lineStyle(1, 0x5c5346, 0.35)
      stand.beginPath()
      stand.moveTo(cx - t.halfT, t.y1)
      stand.lineTo(cx + t.halfT, t.y1)
      stand.strokePath()
    }

    // Pasillos / pilares simples
    stand.lineStyle(1, 0x141210, 0.5)
    for (let col = -5; col <= 5; col++) {
      const x = cx + col * 74
      stand.beginPath()
      stand.moveTo(x, bottomY - 1)
      stand.lineTo(x + col * 1.2, 44)
      stand.strokePath()
    }

    // Barandilla frontal inferior
    stand.lineStyle(2, 0x6a5f52, 0.65)
    stand.beginPath()
    stand.moveTo(18, bottomY - 1)
    stand.lineTo(GAME_WIDTH - 18, bottomY - 1)
    stand.strokePath()

    const crowdTiers = [
      { y0: bottomY, y1: 98, halfB: 396, halfT: 302, count: 120 },
      { y0: 96, y1: 74, halfB: 300, halfT: 238, count: 100 },
      { y0: 72, y1: 50, halfB: 238, halfT: 172, count: 85 },
    ]

    for (const t of crowdTiers) {
      const span = t.y0 - t.y1
      for (let i = 0; i < t.count; i++) {
        const y = t.y1 + Phaser.Math.FloatBetween(5, Math.max(6, span - 4))
        const u = Phaser.Math.Clamp((y - t.y1) / (t.y0 - t.y1 || 1), 0, 1)
        const half = t.halfT + (t.halfB - t.halfT) * u
        const x = cx + Phaser.Math.FloatBetween(-half + 6, half - 6)
        const r = Phaser.Math.FloatBetween(1.1, 2.15)
        const dot = this.add.circle(x, y, r, this.pickRandomCrowdColor(), 1)
        dot.setDepth(2)
        this.crowdSpectators.push({ dot, baseX: x, baseY: y })
      }
    }
  }

  /** Ovación: el público “salta” en vertical con leve desfase. */
  private playCrowdOvacion(): void {
    for (const s of this.crowdSpectators) {
      this.tweens.killTweensOf(s.dot)
      s.dot.setPosition(s.baseX, s.baseY)
    }

    const jump = Phaser.Math.FloatBetween(4, 7)
    const duration = Phaser.Math.Between(82, 105)

    for (const s of this.crowdSpectators) {
      this.tweens.add({
        targets: s.dot,
        y: s.baseY - jump,
        duration,
        ease: Phaser.Math.Easing.Sine.InOut,
        yoyo: true,
        repeat: 10,
        delay: Phaser.Math.Between(0, 220),
        onComplete: () => {
          s.dot.setPosition(s.baseX, s.baseY)
        },
      })
    }
  }

  private drawField(): void {
    const g = this.add.graphics()

    // Cielo / horizonte lejano (las gradas se dibujan encima en `createGrandstandAndCrowd`)
    g.fillStyle(0x274a30, 1)
    g.fillRect(0, 0, GAME_WIDTH, HORIZON_GRASS_Y)
    // Pasto general
    g.fillStyle(0x3a8f47, 1)
    g.fillRect(0, HORIZON_GRASS_Y, GAME_WIDTH, GAME_HEIGHT - HORIZON_GRASS_Y)

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

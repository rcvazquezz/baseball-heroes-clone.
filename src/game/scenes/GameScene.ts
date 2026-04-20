import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../gameDimensions'

const BALL_RADIUS = 10
const BALL_SPEED_Y = 260
const BAT_WIDTH = 88
const BAT_HEIGHT = 14
const BAT_BOTTOM_Y = GAME_HEIGHT - 36

/** Duración (ms) de la fase de ataque del swing (coincide con el tween de ida). */
const SWING_ATTACK_MS = 130
/** Ventana de timing “perfecto” dentro de esa fase (estilo Baseball Heroes). */
const PERFECT_WINDOW_START_MS = 48
const PERFECT_WINDOW_END_MS = 82

const HIT_VY_PULL_OPPO = -420
const HIT_VY_PERFECT = -620
const HIT_VX_PULL = -380
const HIT_VX_OPPO = 380

/** Vibración de cámara en home run (muy breve y sutil). */
const HR_SHAKE_DURATION_MS = 85
const HR_SHAKE_INTENSITY = 0.0035

/** Cámara en home run: zoom out ligero y seguimiento con lerp. */
const HR_CAMERA_ZOOM = 0.88
const HR_CAMERA_ZOOM_IN_MS = 450
const HR_CAMERA_RESTORE_MS = 560
const HR_CAMERA_FOLLOW_LERP_X = 0.1
const HR_CAMERA_FOLLOW_LERP_Y = 0.1
/** Márgenes del mundo para permitir pan/zoom al seguir la pelota. */
const HR_WORLD_PAD_X = 360
const HR_WORLD_PAD_TOP = 520
const HR_WORLD_PAD_BOTTOM = 220

const XP_PER_HIT = 10
const XP_PER_LEVEL = 100
/** Suma a la velocidad vertical del lanzamiento por cada nivel ganado. */
const PITCH_SPEED_PER_LEVEL = 16

const XP_BAR_PAD_X = 52
/** Banda inferior “Old Money”: línea de progreso y etiqueta. */
const XP_LINE_Y = GAME_HEIGHT - 11
const XP_LABEL_Y = GAME_HEIGHT - 30
const XP_HUD_BAND_H = 42

/** Textura generada para destellos del home run. */
const HR_SPARK_TEXTURE_KEY = 'hr_spark'

/** Lanzador en el montículo (coordenadas del campo). */
const PITCHER_MOUNT_X = 400
const PITCHER_MOUNT_Y = 360
const PITCHER_MOUNT_RADIUS = 18

type HitTiming = 'early' | 'late' | 'perfect'

/** Campo de béisbol (vista cenital simplificada). */
export class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc
  private bat!: Phaser.GameObjects.Rectangle
  /** Círculo del lanzador sobre el montículo (animación de windup). */
  private pitcherMound!: Phaser.GameObjects.Arc
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
  private currentPitchSpeed = BALL_SPEED_Y
  private xpBarFill!: Phaser.GameObjects.Rectangle
  private xpHudText!: Phaser.GameObjects.Text

  /** True mientras la cámara sigue un batazo perfecto (hasta el reinicio de la pelota). */
  private hrCameraActive = false

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.drawField()

    this.pitcherMound = this.add.circle(
      PITCHER_MOUNT_X,
      PITCHER_MOUNT_Y,
      PITCHER_MOUNT_RADIUS,
      0xd4b48c,
      1,
    )
    this.pitcherMound.setStrokeStyle(2, 0x8b6914, 0.95)
    this.pitcherMound.setDepth(8)

    this.ball = this.add.circle(GAME_WIDTH / 2, 48, BALL_RADIUS, 0xf2f2f2, 1)
    this.ball.setStrokeStyle(2, 0xccaa88, 1)
    this.ball.setDepth(20)

    this.bat = this.add.rectangle(
      GAME_WIDTH / 2,
      BAT_BOTTOM_Y,
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
    ballBody.setCircle(BALL_RADIUS)
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

    this.physics.add.overlap(this.ball, this.bat, () => {
      this.handleBallBatOverlap()
    })

    this.setupMainCamera()
    this.ensureHrSparkTexture()
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.swingBat()
    }

    if (this.isBallOutOfBounds()) {
      this.resetBall()
    }

    this.getBatBody().updateFromGameObject()
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

    const timing = this.resolveHitTiming()
    const impactX = this.ball.x
    const impactY = this.ball.y
    const ballBody = this.getBallBody()

    this.ball.y -= 10

    if (timing === 'early') {
      this.showImpactFeedback(impactX, impactY, 'early')
      ballBody.setVelocity(HIT_VX_PULL, HIT_VY_PULL_OPPO)
    } else if (timing === 'late') {
      this.showImpactFeedback(impactX, impactY, 'late')
      ballBody.setVelocity(HIT_VX_OPPO, HIT_VY_PULL_OPPO)
    } else {
      this.showImpactFeedback(impactX, impactY, 'perfect')
      ballBody.setVelocity(0, HIT_VY_PERFECT)
      this.playHomeRunCameraShake()
      this.activateHomeRunCamera()
    }

    this.awardXpForHit()
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

  /** Sigue la pelota con lerp y hace zoom out suave (solo timing perfecto / home run). */
  private activateHomeRunCamera(): void {
    const cam = this.cameras.main
    this.tweens.killTweensOf(cam)

    this.hrCameraActive = true
    cam.startFollow(this.ball, false, HR_CAMERA_FOLLOW_LERP_X, HR_CAMERA_FOLLOW_LERP_Y)

    this.tweens.add({
      targets: cam,
      zoom: HR_CAMERA_ZOOM,
      duration: HR_CAMERA_ZOOM_IN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    })
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

  private awardXpForHit(): void {
    this.playerXp += XP_PER_HIT
    while (this.playerXp >= XP_PER_LEVEL) {
      this.playerXp -= XP_PER_LEVEL
      this.playerLevel += 1
      this.currentPitchSpeed += PITCH_SPEED_PER_LEVEL
      this.showLevelUpToast()
    }
    this.refreshXpHud()
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

  /** Muy pronto = pull (izquierda); tarde = opposite (derecha); perfecto = recto y más rápido. */
  private resolveHitTiming(): HitTiming {
    const elapsed = this.time.now - this.swingAttackStartTime
    if (elapsed < PERFECT_WINDOW_START_MS) {
      return 'early'
    }
    if (elapsed > PERFECT_WINDOW_END_MS) {
      return 'late'
    }
    return 'perfect'
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

  private showImpactFeedback(x: number, y: number, timing: HitTiming): void {
    if (timing === 'perfect') {
      this.spawnHomeRunSparkleBurst(x, y)
      this.showPerfectImpactLabel(x, y)
      return
    }

    const [text, color] =
      timing === 'early' ? (['MUY PRONTO', '#ffb347'] as const) : (['TARDE', '#87ceeb'] as const)

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
    this.ball.setPosition(GAME_WIDTH / 2, 48)
    this.ballInPlay = true
    this.getBallBody().setVelocity(0, 0)
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
    p.setPosition(PITCHER_MOUNT_X, PITCHER_MOUNT_Y)
    p.setScale(1)

    this.tweens.chain({
      tweens: [
        {
          targets: p,
          scale: 1.13,
          x: PITCHER_MOUNT_X - 6,
          duration: 155,
          ease: Phaser.Math.Easing.Sine.Out,
        },
        {
          targets: p,
          scale: 1.06,
          x: PITCHER_MOUNT_X + 7,
          duration: 135,
          ease: Phaser.Math.Easing.Sine.InOut,
        },
        {
          targets: p,
          scale: 1,
          x: PITCHER_MOUNT_X,
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
    const ballBody = this.getBallBody()
    ballBody.setVelocity(0, this.currentPitchSpeed)
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

    g.fillStyle(0x3a8f47, 1)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    g.fillStyle(0xc9a06d, 1)
    g.fillTriangle(400, 530, 565, 375, 400, 210)
    g.fillTriangle(400, 530, 400, 210, 235, 375)

    g.lineStyle(3, 0xf5f5f5, 0.95)
    g.strokeLineShape(new Phaser.Geom.Line(400, 530, 95, 140))
    g.strokeLineShape(new Phaser.Geom.Line(400, 530, 705, 140))

    g.lineStyle(2, 0xffffff, 0.85)
    g.strokeLineShape(new Phaser.Geom.Line(400, 530, 565, 375))
    g.strokeLineShape(new Phaser.Geom.Line(565, 375, 400, 210))
    g.strokeLineShape(new Phaser.Geom.Line(400, 210, 235, 375))
    g.strokeLineShape(new Phaser.Geom.Line(235, 375, 400, 530))

    this.drawBase(g, 565, 375, 14)
    this.drawBase(g, 400, 210, 14)
    this.drawBase(g, 235, 375, 14)
    this.drawHomePlate(g, 400, 530)

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

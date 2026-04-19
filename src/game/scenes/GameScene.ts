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

const XP_PER_HIT = 10
const XP_PER_LEVEL = 100
/** Suma a la velocidad vertical del lanzamiento por cada nivel ganado. */
const PITCH_SPEED_PER_LEVEL = 16

const XP_BAR_PAD_X = 36
const XP_BAR_Y = GAME_HEIGHT - 12

type HitTiming = 'early' | 'late' | 'perfect'

/** Campo de béisbol (vista cenital simplificada). */
export class GameScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc
  private bat!: Phaser.GameObjects.Rectangle
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

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.drawField()

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

    this.startBallFlight()

    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.createXpHud()

    this.physics.add.overlap(this.ball, this.bat, () => {
      this.handleBallBatOverlap()
    })
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
      this.showImpactLabel(impactX, impactY, 'MUY PRONTO', '#ffb347')
      ballBody.setVelocity(HIT_VX_PULL, HIT_VY_PULL_OPPO)
    } else if (timing === 'late') {
      this.showImpactLabel(impactX, impactY, 'TARDE', '#87ceeb')
      ballBody.setVelocity(HIT_VX_OPPO, HIT_VY_PULL_OPPO)
    } else {
      this.showImpactLabel(impactX, impactY, '¡PERFECTO!', '#ffe066')
      ballBody.setVelocity(0, HIT_VY_PERFECT)
      this.playHomeRunCameraShake()
    }

    this.awardXpForHit()
  }

  private playHomeRunCameraShake(): void {
    this.cameras.main.shake(HR_SHAKE_DURATION_MS, HR_SHAKE_INTENSITY)
  }

  private createXpHud(): void {
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const barH = 10

    this.add
      .rectangle(GAME_WIDTH / 2, XP_BAR_Y, maxW + 6, barH + 8, 0x0d1117, 0.88)
      .setStrokeStyle(1, 0x2e3542)
      .setDepth(148)

    this.add
      .rectangle(GAME_WIDTH / 2, XP_BAR_Y, maxW, barH, 0x222831, 1)
      .setDepth(149)

    this.xpBarFill = this.add
      .rectangle(XP_BAR_PAD_X, XP_BAR_Y, 0, barH - 2, 0x6fdc8c, 1)
      .setOrigin(0, 0.5)
      .setDepth(150)

    this.xpHudText = this.add
      .text(XP_BAR_PAD_X, XP_BAR_Y - 22, '', {
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
        fontSize: '13px',
        color: '#c8d0da',
      })
      .setDepth(151)

    this.refreshXpHud()
  }

  private refreshXpHud(): void {
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const ratio = Phaser.Math.Clamp(this.playerXp / XP_PER_LEVEL, 0, 1)
    this.xpBarFill.width = Math.max(0, ratio * maxW)
    this.xpHudText.setText(
      `Nivel ${this.playerLevel}  ·  ${this.playerXp}/${XP_PER_LEVEL} XP`,
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

  private showImpactLabel(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, "Segoe UI", sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(100)

    this.tweens.add({
      targets: label,
      y: y - 56,
      alpha: 0,
      duration: 800,
      ease: Phaser.Math.Easing.Cubic.Out,
      onComplete: () => {
        label.destroy()
      },
    })
  }

  private resetBall(): void {
    this.ball.setPosition(GAME_WIDTH / 2, 48)
    this.ballInPlay = true
    this.startBallFlight()
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

    g.fillStyle(0xd4b48c, 1)
    g.fillCircle(400, 360, 18)

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

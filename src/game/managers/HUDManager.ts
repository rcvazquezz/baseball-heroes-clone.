import Phaser from 'phaser'
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_BALL_DOT_OFF,
  HUD_BALL_DOT_ON,
  HUD_BALL_STROKE_OFF,
  HUD_BALL_STROKE_ON,
  HUD_MINI_BASE_EMPTY,
  HUD_MINI_BASE_FULL,
  HUD_MINI_BASE_STROKE_EMPTY,
  HUD_MINI_HOME,
  HUD_MINI_HOME_STROKE,
  HUD_OUT_DOT_OFF,
  HUD_OUT_DOT_ON,
  HUD_OUT_STROKE_OFF,
  HUD_OUT_STROKE_ON,
  HUD_POWER_FILL,
  HUD_POWER_FRAME_INNER,
  HUD_POWER_FRAME_OUTER,
  HUD_POWER_SHINE_FILL,
  HUD_POWER_SHINE_LINE,
  HUD_POWER_STROKE,
  HUD_STRIKE_DOT_OFF,
  HUD_STRIKE_DOT_ON,
  HUD_STRIKE_STROKE_OFF,
  HUD_STRIKE_STROKE_ON,
  HUD_XP_BAND_BG,
  HUD_XP_BAR_FILL,
  HUD_XP_LINE_DIM,
  POWER_BAR_CY,
  POWER_BAR_H,
  POWER_BAR_W,
  POWER_BAR_X,
  POWER_METER_PER_PERFECT,
  POWER_METER_PER_PRONTO_TARDE,
  XP_BAR_PAD_X,
  XP_HUD_BAND_H,
  XP_LABEL_Y,
  XP_LINE_Y,
  XP_PER_LEVEL,
} from '../constants/GameConfig'
import type { ScoreManager } from './ScoreManager'
import type { SwingTimingClass } from '../types/gameTypes'

/**
 * HUD fijo: XP, power, B/S/O, mini diamante y runs.
 * Se sincroniza con `ScoreManager` vía `syncFromScore()`.
 */
export class HUDManager {
  private xpBarFill!: Phaser.GameObjects.Rectangle
  private xpHudText!: Phaser.GameObjects.Text
  private miniDiamondG!: Phaser.GameObjects.Graphics
  private runsHudText!: Phaser.GameObjects.Text
  private strikeDots: Phaser.GameObjects.Arc[] = []
  private outDots: Phaser.GameObjects.Arc[] = []
  private ballDots: Phaser.GameObjects.Arc[] = []

  private powerMeterFill!: Phaser.GameObjects.Rectangle
  private powerMeterFrameInner!: Phaser.GameObjects.Rectangle
  private powerMeterFrame!: Phaser.GameObjects.Graphics
  private powerMeterShine!: Phaser.GameObjects.Graphics
  private powerMeterReadyTween?: Phaser.Tweens.Tween

  private powerMeter = 0

  private readonly scene: Phaser.Scene
  private readonly getScore: () => ScoreManager
  private readonly getGoldenSwingActive: () => boolean

  constructor(
    scene: Phaser.Scene,
    getScore: () => ScoreManager,
    getGoldenSwingActive: () => boolean,
  ) {
    this.scene = scene
    this.getScore = getScore
    this.getGoldenSwingActive = getGoldenSwingActive
  }

  getPowerMeter(): number {
    return this.powerMeter
  }

  setPowerMeter(value: number): void {
    this.powerMeter = value
    this.refreshPowerMeterHud()
  }

  resetPowerMeter(): void {
    this.powerMeter = 0
    this.refreshPowerMeterHud()
  }

  addPowerFromTiming(timingClass: SwingTimingClass): void {
    if (timingClass === 'perfect') {
      this.powerMeter = Math.min(1, this.powerMeter + POWER_METER_PER_PERFECT)
    } else if (timingClass === 'pronto' || timingClass === 'tardo') {
      this.powerMeter = Math.min(1, this.powerMeter + POWER_METER_PER_PRONTO_TARDE)
    }
    this.refreshPowerMeterHud()
  }

  /** Crea todos los elementos del HUD (llamar una vez en `create`). */
  createAll(): void {
    this.createXpHud()
    this.createPowerMeterHud()
    this.createMiniDiamondHud()
    this.createStrikeOutHud()
  }

  syncFromScore(): void {
    this.refreshStrikeOutHud()
    this.refreshBallsHud()
    this.refreshXpHud()
    this.refreshRunsHud()
  }

  refreshMiniDiamond(runners: [boolean, boolean, boolean]): void {
    const g = this.miniDiamondG
    g.clear()

    const ox = GAME_WIDTH - 46
    const oy = 72
    const s = 8

    const drawRhomb = (cx: number, cy: number, filled: boolean, home: boolean) => {
      g.fillStyle(
        home ? HUD_MINI_HOME : filled ? HUD_MINI_BASE_FULL : HUD_MINI_BASE_EMPTY,
        home ? 0.35 : filled ? 1 : 0.55,
      )
      g.lineStyle(1, home ? HUD_MINI_HOME_STROKE : HUD_MINI_BASE_STROKE_EMPTY, home ? 0.55 : filled ? 0.9 : 0.3)
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
    drawRhomb(ox + hx + 20, oy + hy - 16, runners[0], false)
    drawRhomb(ox + hx, oy + hy - 34, runners[1], false)
    drawRhomb(ox + hx - 20, oy + hy - 16, runners[2], false)
  }

  refreshPowerMeterHud(): void {
    const maxFill = POWER_BAR_H - 6
    const clampedPower = Math.min(1, Math.max(0, this.powerMeter))
    const h = Math.min(maxFill, Math.max(0, maxFill * clampedPower))
    this.powerMeterFill.setOrigin(0.5, 1)
    this.powerMeterFill.height = h
    const bottomY = this.powerMeterFrameInner.getBottomCenter().y
    this.powerMeterFill.setY(bottomY)

    const ready = this.powerMeter >= 1 && !this.getGoldenSwingActive()
    this.refreshPowerMeterReadyShine(ready)
  }

  private createXpHud(): void {
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const bandCy = GAME_HEIGHT - XP_HUD_BAND_H / 2

    this.scene.add
      .rectangle(GAME_WIDTH / 2, bandCy, GAME_WIDTH, XP_HUD_BAND_H, HUD_XP_BAND_BG, 1)
      .setDepth(148)
      .setScrollFactor(0, 0)

    this.scene.add
      .rectangle(GAME_WIDTH / 2, XP_LINE_Y, maxW, 1, HUD_XP_LINE_DIM, 1)
      .setDepth(149)
      .setScrollFactor(0, 0)

    this.xpBarFill = this.scene.add
      .rectangle(XP_BAR_PAD_X, XP_LINE_Y, 0, 2, HUD_XP_BAR_FILL, 1)
      .setOrigin(0, 0.5)
      .setDepth(150)
      .setScrollFactor(0, 0)

    this.xpHudText = this.scene.add
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
    const score = this.getScore()
    const maxW = GAME_WIDTH - XP_BAR_PAD_X * 2
    const xp = score.getXp()
    const level = score.getLevel()
    const ratio = Phaser.Math.Clamp(xp / XP_PER_LEVEL, 0, 1)
    this.xpBarFill.width = Math.max(0, ratio * maxW)
    this.xpHudText.setText(`Nivel ${level}     ${xp} / ${XP_PER_LEVEL}`)
  }

  private createPowerMeterHud(): void {
    const x = POWER_BAR_X
    const cy = POWER_BAR_CY
    const halfH = POWER_BAR_H / 2

    this.scene.add
      .rectangle(x, cy, POWER_BAR_W + 6, POWER_BAR_H + 6, HUD_POWER_FRAME_OUTER, 0.92)
      .setDepth(151)
      .setScrollFactor(0, 0)

    this.powerMeterFrameInner = this.scene.add
      .rectangle(x, cy, POWER_BAR_W - 2, POWER_BAR_H - 4, HUD_POWER_FRAME_INNER, 1)
      .setDepth(151)
      .setScrollFactor(0, 0)

    this.powerMeterFill = this.scene.add
      .rectangle(x, cy + halfH - 2, POWER_BAR_W - 4, 0, HUD_POWER_FILL, 0.95)
      .setOrigin(0.5, 1)
      .setDepth(152)
      .setScrollFactor(0, 0)

    this.powerMeterFrame = this.scene.add.graphics()
    this.powerMeterFrame.setDepth(153)
    this.powerMeterFrame.setScrollFactor(0, 0)
    this.powerMeterFrame.lineStyle(1, HUD_POWER_STROKE, 0.92)
    this.powerMeterFrame.strokeRect(
      x - POWER_BAR_W / 2 - 1,
      cy - halfH - 1,
      POWER_BAR_W + 2,
      POWER_BAR_H + 2,
    )

    this.powerMeterShine = this.scene.add.graphics()
    this.powerMeterShine.setDepth(154)
    this.powerMeterShine.setScrollFactor(0, 0)

    this.scene.add
      .text(x, cy + halfH + 14, 'POWER', {
        font: '300 9px Palatino, "Palatino Linotype", Georgia, serif',
        color: '#7a7268',
      })
      .setOrigin(0.5, 0)
      .setDepth(152)
      .setScrollFactor(0, 0)

    this.refreshPowerMeterHud()
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
      this.powerMeterShine.fillStyle(HUD_POWER_SHINE_FILL, alpha * 0.22)
      this.powerMeterShine.fillRect(x - 2, cy - halfH + 4, 3, POWER_BAR_H - 10)
      this.powerMeterShine.lineStyle(1, HUD_POWER_SHINE_LINE, alpha * 0.85)
      this.powerMeterShine.lineBetween(
        x + POWER_BAR_W / 2 - 3,
        cy - halfH + 6,
        x + POWER_BAR_W / 2 - 3,
        cy + halfH - 6,
      )
    }

    const shineState = { a: 0.4 }
    drawShine(shineState.a)
    this.powerMeterReadyTween = this.scene.tweens.add({
      targets: shineState,
      a: 1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => drawShine(shineState.a),
    })
  }

  private createStrikeOutHud(): void {
    const rightX = GAME_WIDTH - 20
    const dotSpacing = 14
    const startX = rightX - 3 * dotSpacing - 4

    this.scene.add
      .text(rightX - 62, 86, 'B', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 4; i++) {
      const c = this.scene.add.circle(startX + i * dotSpacing, 96, 4.5, HUD_BALL_DOT_OFF, 1)
      c.setStrokeStyle(1, HUD_BALL_STROKE_OFF, 0.45)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.ballDots.push(c)
    }

    this.scene.add
      .text(rightX - 62, 108, 'S', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 3; i++) {
      const c = this.scene.add.circle(startX + i * dotSpacing, 118, 5, HUD_STRIKE_DOT_OFF, 1)
      c.setStrokeStyle(1, HUD_STRIKE_STROKE_OFF, 0.85)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.strikeDots.push(c)
    }

    this.scene.add
      .text(rightX - 62, 128, 'O', {
        font: '600 11px system-ui, "Segoe UI", sans-serif',
        color: '#8a8278',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    for (let i = 0; i < 3; i++) {
      const c = this.scene.add.circle(startX + i * dotSpacing, 138, 5, HUD_OUT_DOT_OFF, 1)
      c.setStrokeStyle(1, HUD_OUT_STROKE_OFF, 0.4)
      c.setDepth(156)
      c.setScrollFactor(0, 0)
      this.outDots.push(c)
    }

    this.refreshStrikeOutHud()
    this.refreshBallsHud()
  }

  private refreshBallsHud(): void {
    const balls = this.getScore().getBalls()
    for (let i = 0; i < 4; i++) {
      const on = balls > i
      this.ballDots[i].setFillStyle(on ? HUD_BALL_DOT_ON : HUD_BALL_DOT_OFF, 1)
      this.ballDots[i].setStrokeStyle(
        1,
        on ? HUD_BALL_STROKE_ON : HUD_BALL_STROKE_OFF,
        on ? 0.95 : 0.45,
      )
    }
  }

  private refreshStrikeOutHud(): void {
    const score = this.getScore()
    const strikes = score.getStrikes()
    const outs = score.getOuts()
    for (let i = 0; i < 3; i++) {
      const strikeOn = strikes > i
      this.strikeDots[i].setFillStyle(strikeOn ? HUD_STRIKE_DOT_ON : HUD_STRIKE_DOT_OFF, 1)
      this.strikeDots[i].setStrokeStyle(
        1,
        strikeOn ? HUD_STRIKE_STROKE_ON : HUD_STRIKE_STROKE_OFF,
        strikeOn ? 0.95 : 0.55,
      )

      const outOn = outs > i
      this.outDots[i].setFillStyle(outOn ? HUD_OUT_DOT_ON : HUD_OUT_DOT_OFF, 1)
      this.outDots[i].setStrokeStyle(
        1,
        outOn ? HUD_OUT_STROKE_ON : HUD_OUT_STROKE_OFF,
        outOn ? 0.95 : 0.4,
      )
    }
  }

  private createMiniDiamondHud(): void {
    const padX = 20
    const padY = 22

    this.runsHudText = this.scene.add
      .text(GAME_WIDTH - padX, padY, 'Runs 0', {
        font: '600 13px system-ui, "Segoe UI", sans-serif',
        color: '#d4c9b0',
      })
      .setOrigin(1, 0)
      .setDepth(156)
      .setScrollFactor(0, 0)

    this.miniDiamondG = this.scene.add.graphics()
    this.miniDiamondG.setScrollFactor(0, 0)
    this.miniDiamondG.setDepth(155)
  }

  private refreshRunsHud(): void {
    this.runsHudText.setText(`Runs ${this.getScore().getRuns()}`)
  }
}

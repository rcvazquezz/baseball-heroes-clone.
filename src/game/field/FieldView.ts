import Phaser from 'phaser'
import {
  CROWD_SHIRT_PALETTE,
  DIRT_BOT_Y,
  DIRT_HALF_W_BOT,
  DIRT_HALF_W_TOP,
  DIRT_TOP_Y,
  DIAMOND_EDGE,
  FIELD_DIRT,
  FIELD_DIRT_SHADOW,
  FIELD_GRASS,
  FIELD_SKY_GRASS,
  FOUL_LINE_COLOR,
  FOUL_LINE_PLATE_DX,
  FOUL_LINE_VANISH_DX,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRANDSTAND_LINE_1,
  GRANDSTAND_LINE_2,
  GRANDSTAND_PILLAR,
  GRANDSTAND_RAIL,
  GRANDSTAND_TIER_FILLS,
  HORIZON_GRASS_Y,
  PERSP_VANISH_X,
  PERSP_VANISH_Y,
  PLATE_X,
  PLATE_Y,
  STRIKE_HALF_W_BOT,
  STRIKE_HALF_W_TOP,
  STRIKE_ZONE_BOT,
  STRIKE_ZONE_FILL,
  STRIKE_ZONE_TOP,
} from '../constants/GameConfig'

export type CrowdSpectator = { dot: Phaser.GameObjects.Arc; baseX: number; baseY: number }

/**
 * Escenario estático: césped, tierra, diamante, gradas y público.
 */
export class FieldView {
  readonly crowdSpectators: CrowdSpectator[] = []
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Dibuja campo + gradas una sola vez al iniciar la escena. */
  create(): void {
    this.drawField()
    this.drawGrandstandAndCrowd()
  }

  /** Animación de ovación en HR (usa puntos del público). */
  playCrowdOvacion(): void {
    for (const s of this.crowdSpectators) {
      this.scene.tweens.killTweensOf(s.dot)
      s.dot.setPosition(s.baseX, s.baseY)
    }

    const jump = Phaser.Math.FloatBetween(4, 7)
    const duration = Phaser.Math.Between(82, 105)

    for (const s of this.crowdSpectators) {
      this.scene.tweens.add({
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

  private pickRandomCrowdColor(): number {
    return CROWD_SHIRT_PALETTE[Phaser.Math.Between(0, CROWD_SHIRT_PALETTE.length - 1)]
  }

  private drawGrandstandAndCrowd(): void {
    const stand = this.scene.add.graphics()
    stand.setDepth(1)

    const cx = GAME_WIDTH / 2
    const bottomY = HORIZON_GRASS_Y - 2

    const tiers: { y0: number; y1: number; halfB: number; halfT: number; fill: number }[] = [
      { y0: bottomY, y1: 96, halfB: 402, halfT: 312, fill: GRANDSTAND_TIER_FILLS[0] },
      { y0: 96, y1: 72, halfB: 308, halfT: 248, fill: GRANDSTAND_TIER_FILLS[1] },
      { y0: 72, y1: 48, halfB: 246, halfT: 178, fill: GRANDSTAND_TIER_FILLS[2] },
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

      stand.lineStyle(1, GRANDSTAND_LINE_1, 0.55)
      stand.beginPath()
      stand.moveTo(cx - t.halfB, t.y0)
      stand.lineTo(cx + t.halfB, t.y0)
      stand.strokePath()

      stand.lineStyle(1, GRANDSTAND_LINE_2, 0.35)
      stand.beginPath()
      stand.moveTo(cx - t.halfT, t.y1)
      stand.lineTo(cx + t.halfT, t.y1)
      stand.strokePath()
    }

    stand.lineStyle(1, GRANDSTAND_PILLAR, 0.5)
    for (let col = -5; col <= 5; col++) {
      const x = cx + col * 74
      stand.beginPath()
      stand.moveTo(x, bottomY - 1)
      stand.lineTo(x + col * 1.2, 44)
      stand.strokePath()
    }

    stand.lineStyle(2, GRANDSTAND_RAIL, 0.65)
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
        const dot = this.scene.add.circle(x, y, r, this.pickRandomCrowdColor(), 1)
        dot.setDepth(2)
        this.crowdSpectators.push({ dot, baseX: x, baseY: y })
      }
    }
  }

  private drawField(): void {
    const g = this.scene.add.graphics()

    g.fillStyle(FIELD_SKY_GRASS, 1)
    g.fillRect(0, 0, GAME_WIDTH, HORIZON_GRASS_Y)
    g.fillStyle(FIELD_GRASS, 1)
    g.fillRect(0, HORIZON_GRASS_Y, GAME_WIDTH, GAME_HEIGHT - HORIZON_GRASS_Y)

    const dirtTopY = DIRT_TOP_Y
    const dirtBotY = DIRT_BOT_Y
    const dirtHalfWTop = DIRT_HALF_W_TOP
    const dirtHalfWBot = DIRT_HALF_W_BOT
    g.fillStyle(FIELD_DIRT, 1)
    g.beginPath()
    g.moveTo(PLATE_X - dirtHalfWBot, dirtBotY)
    g.lineTo(PLATE_X + dirtHalfWBot, dirtBotY)
    g.lineTo(PLATE_X + dirtHalfWTop, dirtTopY)
    g.lineTo(PLATE_X - dirtHalfWTop, dirtTopY)
    g.closePath()
    g.fillPath()

    g.fillStyle(FIELD_DIRT_SHADOW, 0.35)
    g.beginPath()
    g.moveTo(PLATE_X - dirtHalfWTop * 0.72, dirtTopY + 22)
    g.lineTo(PLATE_X + dirtHalfWTop * 0.72, dirtTopY + 22)
    g.lineTo(PLATE_X + dirtHalfWBot * 0.55, dirtBotY - 28)
    g.lineTo(PLATE_X - dirtHalfWBot * 0.55, dirtBotY - 28)
    g.closePath()
    g.fillPath()

    const szTop = STRIKE_ZONE_TOP
    const szBot = STRIKE_ZONE_BOT
    const szHalfTop = STRIKE_HALF_W_TOP
    const szHalfBot = STRIKE_HALF_W_BOT
    g.fillStyle(STRIKE_ZONE_FILL, 0.09)
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

    g.lineStyle(3, FOUL_LINE_COLOR, 0.92)
    g.beginPath()
    g.moveTo(PLATE_X - FOUL_LINE_PLATE_DX, PLATE_Y - 6)
    g.lineTo(PERSP_VANISH_X - FOUL_LINE_VANISH_DX, PERSP_VANISH_Y + 18)
    g.strokePath()
    g.beginPath()
    g.moveTo(PLATE_X + FOUL_LINE_PLATE_DX, PLATE_Y - 6)
    g.lineTo(PERSP_VANISH_X + FOUL_LINE_VANISH_DX, PERSP_VANISH_Y + 18)
    g.strokePath()

    g.lineStyle(2, DIAMOND_EDGE, 0.88)
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
}

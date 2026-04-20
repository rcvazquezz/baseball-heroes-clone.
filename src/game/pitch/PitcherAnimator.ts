import Phaser from 'phaser'
import {
  PITCHER_FILL_DEFAULT,
  PITCHER_FILL_GOLD,
  PITCHER_PREP_MS,
  PITCHER_STROKE_DEFAULT,
  PITCHER_STROKE_GOLD,
  PITCHER_X,
  PITCHER_Y,
} from '../constants/GameConfig'

function lerpColor(c0: number, c1: number, t: number): number {
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
 * Windup del montículo y pulso dorado antes del lanzamiento.
 */
export class PitcherAnimator {
  private readonly scene: Phaser.Scene
  private readonly pitcherMound: Phaser.GameObjects.Ellipse
  private readonly pitcherPrepTweenTarget: { progress: number }

  constructor(
    scene: Phaser.Scene,
    pitcherMound: Phaser.GameObjects.Ellipse,
    pitcherPrepTweenTarget: { progress: number },
  ) {
    this.scene = scene
    this.pitcherMound = pitcherMound
    this.pitcherPrepTweenTarget = pitcherPrepTweenTarget
  }

  windup(onRelease: () => void): void {
    const p = this.pitcherMound
    this.scene.tweens.killTweensOf(p)
    this.scene.tweens.killTweensOf(this.pitcherPrepTweenTarget)
    p.setFillStyle(PITCHER_FILL_DEFAULT, 1)
    p.setStrokeStyle(2, PITCHER_STROKE_DEFAULT, 0.95)
    p.setPosition(PITCHER_X, PITCHER_Y)
    p.setScale(1)

    this.scene.tweens.chain({
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
            this.runPreparationCue(onRelease)
          },
        },
      ],
    })
  }

  private runPreparationCue(onRelease: () => void): void {
    const p = this.pitcherMound
    this.scene.tweens.killTweensOf(this.pitcherPrepTweenTarget)
    this.pitcherPrepTweenTarget.progress = 0

    this.scene.tweens.add({
      targets: this.pitcherPrepTweenTarget,
      progress: 1,
      duration: PITCHER_PREP_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => {
        const pr = this.pitcherPrepTweenTarget.progress
        const pulse = Math.sin(pr * Math.PI * 5) * 0.2
        const mix = Phaser.Math.Clamp(pr * 0.88 + pulse, 0, 1)
        p.setFillStyle(lerpColor(PITCHER_FILL_DEFAULT, PITCHER_FILL_GOLD, mix), 1)
        p.setStrokeStyle(
          2,
          lerpColor(PITCHER_STROKE_DEFAULT, PITCHER_STROKE_GOLD, mix),
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
}

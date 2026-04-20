import Phaser from 'phaser'
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HR_CAMERA_FOLLOW_LERP_X,
  HR_CAMERA_FOLLOW_LERP_Y,
  HR_CAMERA_RESTORE_MS,
  HR_CAMERA_ZOOM,
  HR_CAMERA_ZOOM_IN_MS,
  HR_WORLD_PAD_BOTTOM,
  HR_WORLD_PAD_TOP,
  HR_WORLD_PAD_X,
  LONG_HIT_CAMERA_FOLLOW_LERP_X,
  LONG_HIT_CAMERA_FOLLOW_LERP_Y,
  LONG_HIT_CAMERA_ZOOM,
  LONG_HIT_CAMERA_ZOOM_IN_MS,
} from '../constants/GameConfig'
import type { FairHitKind } from '../types/gameTypes'

/**
 * Pan/zoom al seguir batazos largos y HR.
 */
export class BattedBallCamera {
  private hrCameraActive = false
  private readonly scene: Phaser.Scene
  private readonly shake: () => void

  constructor(scene: Phaser.Scene, shake: () => void) {
    this.scene = scene
    this.shake = shake
  }

  /** Límites de cámara para pan en HR (estado inicial). */
  setupWorldBounds(): void {
    const cam = this.scene.cameras.main
    cam.setBounds(
      -HR_WORLD_PAD_X,
      -HR_WORLD_PAD_TOP,
      GAME_WIDTH + HR_WORLD_PAD_X * 2,
      GAME_HEIGHT + HR_WORLD_PAD_TOP + HR_WORLD_PAD_BOTTOM,
    )
    cam.setZoom(1)
    cam.setScroll(0, 0)
  }

  activate(ball: Phaser.GameObjects.Arc, kind: FairHitKind): void {
    const cam = this.scene.cameras.main
    this.scene.tweens.killTweensOf(cam)
    this.hrCameraActive = true
    const isHr = kind === 'HR'
    const lerpX = isHr ? HR_CAMERA_FOLLOW_LERP_X : LONG_HIT_CAMERA_FOLLOW_LERP_X
    const lerpY = isHr ? HR_CAMERA_FOLLOW_LERP_Y : LONG_HIT_CAMERA_FOLLOW_LERP_Y
    cam.startFollow(ball, false, lerpX, lerpY)
    const zoom = isHr ? HR_CAMERA_ZOOM : LONG_HIT_CAMERA_ZOOM
    const zoomMs = isHr ? HR_CAMERA_ZOOM_IN_MS : LONG_HIT_CAMERA_ZOOM_IN_MS
    this.scene.tweens.add({
      targets: cam,
      zoom,
      duration: zoomMs,
      ease: Phaser.Math.Easing.Sine.Out,
    })
    if (isHr) {
      this.shake()
    }
  }

  restore(): void {
    const cam = this.scene.cameras.main
    cam.stopFollow()
    this.scene.tweens.killTweensOf(cam)
    if (!this.hrCameraActive) {
      cam.setScroll(0, 0)
      cam.setZoom(1)
      return
    }
    this.hrCameraActive = false
    this.scene.tweens.add({
      targets: cam,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      duration: HR_CAMERA_RESTORE_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
    })
  }
}

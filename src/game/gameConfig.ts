import Phaser from 'phaser'
import { Preloader } from './scenes/Preloader'
import { GameScene } from './scenes/GameScene'

export { GAME_WIDTH, GAME_HEIGHT } from './gameDimensions'

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
      },
    },
    scene: [Preloader, GameScene],
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    backgroundColor: '#243428',
  }
}

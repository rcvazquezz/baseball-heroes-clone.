import Phaser from 'phaser'

/** Carga inicial de assets antes de entrar al juego. */
export class Preloader extends Phaser.Scene {
  constructor() {
    super({ key: 'Preloader' })
  }

  preload(): void {
    // Ejemplo: carga con URL resuelta por Vite (sustituye o amplía según tus assets)
    this.load.image('hero', new URL('../../assets/hero.png', import.meta.url).href)
  }

  create(): void {
    this.scene.start('GameScene')
  }
}

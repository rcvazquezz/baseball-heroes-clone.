import './style.css'
import Phaser from 'phaser'
import { createGameConfig } from './game/gameConfig'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) {
  throw new Error('No se encontró el contenedor #app')
}

new Phaser.Game(createGameConfig(root))

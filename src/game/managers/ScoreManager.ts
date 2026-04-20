import {
  BALLS_PER_WALK,
  OUTS_PER_INNING,
  STRIKES_PER_OUT,
  XP_PER_LEVEL,
} from '../constants/GameConfig'

export type ScoreManagerCallbacks = {
  /** Cualquier cambio en conteo, carreras o XP (actualizar HUD). */
  onChanged: () => void
  /** Tercer out del inning: limpiar bases y mostrar fin de inning en la escena. */
  onInningOver: () => void
  /** Subida de nivel (pitch speed, toast, etc.). */
  onLevelUp?: () => void
}

/**
 * Estado del partido: turno al bate, inning y progresión del jugador.
 * La escena reacciona a los callbacks para pintar y aplicar efectos de juego.
 */
export class ScoreManager {
  private readonly callbacks: ScoreManagerCallbacks

  private strikes = 0
  private outs = 0
  private balls = 0
  private runs = 0
  private xp = 0
  private level = 1

  constructor(callbacks: ScoreManagerCallbacks) {
    this.callbacks = callbacks
  }

  getStrikes(): number {
    return this.strikes
  }

  getOuts(): number {
    return this.outs
  }

  getBalls(): number {
    return this.balls
  }

  getRuns(): number {
    return this.runs
  }

  getXp(): number {
    return this.xp
  }

  getLevel(): number {
    return this.level
  }

  /** Strike cantado o swing fallido. */
  registerStrike(): void {
    this.strikes++
    if (this.strikes >= STRIKES_PER_OUT) {
      this.strikes = 0
      this.balls = 0
      this.registerOut()
      return
    }
    this.callbacks.onChanged()
  }

  /** Falta: menos de 2 strikes suma strike; con 2 strikes se mantiene (regla MLB). */
  registerStrikeOnFoul(): void {
    if (this.strikes < 2) {
      this.registerStrike()
    } else {
      this.callbacks.onChanged()
    }
  }

  /**
   * Bola (sin swing, fuera de zona). Devuelve true si hay base por bolas.
   */
  registerBall(): boolean {
    this.balls++
    if (this.balls >= BALLS_PER_WALK) {
      this.balls = 0
      this.strikes = 0
      this.callbacks.onChanged()
      return true
    }
    this.callbacks.onChanged()
    return false
  }

  /** Out (fly-out, robo, etc.): incrementa outs; puede cerrar inning. */
  registerOut(): void {
    this.outs++
    if (this.outs >= OUTS_PER_INNING) {
      this.outs = 0
      this.strikes = 0
      this.balls = 0
      this.callbacks.onChanged()
      this.callbacks.onInningOver()
      return
    }
    this.callbacks.onChanged()
  }

  /** Fin de turno al bate (hit, out, walk ya aplicado en el conteo). */
  resetAtBat(): void {
    this.balls = 0
    this.strikes = 0
    this.callbacks.onChanged()
  }

  addRuns(amount: number): void {
    if (amount === 0) {
      return
    }
    this.runs += amount
    this.callbacks.onChanged()
  }

  addXp(amount: number): void {
    if (amount === 0) {
      return
    }
    this.xp += amount
    while (this.xp >= XP_PER_LEVEL) {
      this.xp -= XP_PER_LEVEL
      this.level++
      this.callbacks.onLevelUp?.()
    }
    this.callbacks.onChanged()
  }
}

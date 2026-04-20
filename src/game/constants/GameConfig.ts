/**
 * Valores fijos de gameplay, física y paleta «Old Money» / HUD.
 * Centraliza constantes para evitar números mágicos en la escena.
 */
import { GAME_HEIGHT, GAME_WIDTH } from '../gameDimensions'

export { GAME_HEIGHT, GAME_WIDTH }

// —— Pelota y bate ——
export const BALL_RADIUS = 10
/** Rapidez del lanzamiento (módulo del vector hacia el home). */
export const BALL_PITCH_SPEED = 260
export const BAT_WIDTH = 92
export const BAT_HEIGHT = 15

/** Perspectiva estilo Baseball Heroes: cámara detrás del home, fondo arriba. */
export const PERSP_VANISH_X = 400
export const PERSP_VANISH_Y = 158

export const PLATE_X = 400
export const PLATE_Y = 496

export const PITCHER_X = 400
export const PITCHER_Y = 152
export const PITCHER_ELLIPSE_W = 30
export const PITCHER_ELLIPSE_H = 13
export const PITCHER_FILL_DEFAULT = 0xd4b48c
export const PITCHER_STROKE_DEFAULT = 0x8b6914
/** Dorado suave durante la señal de «lanzamiento inminente». */
export const PITCHER_FILL_GOLD = 0xe8d9b8
export const PITCHER_STROKE_GOLD = 0xc4a85a
/** Tiempo de aviso visual antes de `startBallFlight()`. */
export const PITCHER_PREP_MS = 500

/** Escala visual de la pelota (lejos → cerca de la cámara). */
export const BALL_SCALE_FAR = 0.36
export const BALL_SCALE_NEAR = 1.06

/** Bate anclado cerca del home, ligeramente por debajo de la punta del plato. */
export const BAT_ANCHOR_Y = PLATE_Y + 26

/** Zona de strike (mismos valores que `drawField`). */
export const STRIKE_ZONE_TOP = PLATE_Y - 58
export const STRIKE_ZONE_BOT = PLATE_Y + 6
export const STRIKE_HALF_W_TOP = 20
export const STRIKE_HALF_W_BOT = 46

/** Duración (ms) de la fase de ataque del swing (coincide con el tween de ida). */
export const SWING_ATTACK_MS = 130
/** Ventana de timing «perfecto» dentro de esa fase (estilo Baseball Heroes). */
export const PERFECT_WINDOW_START_MS = 48
export const PERFECT_WINDOW_END_MS = 82
/** Fuera de esto → foul por timing (MUY PRONTO / MUY TARDE). */
export const SOLID_EARLY_MS = 22
export const SOLID_LATE_MS = 118
/** Contacto en el borde del bate (normalizado respecto al semi-ancho). */
export const BAT_EDGE_FOUL_THRESHOLD = 0.78

export const HIT_VY_HR = -720
export const HIT_VY_TRIPLE = -560
export const HIT_VY_DOUBLE = -480
export const HIT_VY_SINGLE = -380
export const HIT_VY_FOUL = -260
export const HIT_VX_TRIPLE = 320
export const HIT_VX_DOUBLE = 260
export const HIT_VX_SINGLE = 200
export const HIT_VX_FOUL = 640

/** Vibración de cámara en home run (muy breve y sutil). */
export const HR_SHAKE_DURATION_MS = 85
export const HR_SHAKE_INTENSITY = 0.0035

/** Cámara siguiendo batazo largo / HR. */
export const HR_CAMERA_ZOOM = 0.86
export const LONG_HIT_CAMERA_ZOOM = 0.92
export const HR_CAMERA_ZOOM_IN_MS = 450
export const LONG_HIT_CAMERA_ZOOM_IN_MS = 380
export const HR_CAMERA_RESTORE_MS = 560
export const HR_CAMERA_FOLLOW_LERP_X = 0.12
export const HR_CAMERA_FOLLOW_LERP_Y = 0.12
export const LONG_HIT_CAMERA_FOLLOW_LERP_X = 0.14
export const LONG_HIT_CAMERA_FOLLOW_LERP_Y = 0.14
/** Márgenes del mundo para permitir pan/zoom al seguir la pelota. */
export const HR_WORLD_PAD_X = 360
export const HR_WORLD_PAD_TOP = 520
export const HR_WORLD_PAD_BOTTOM = 220

export const XP_PER_FAIR = 10
export const XP_PER_HR = 22
export const XP_PER_LEVEL = 100
/** Suma a la rapidez del lanzamiento por cada nivel ganado. */
export const PITCH_SPEED_PER_LEVEL = 16

export const XP_BAR_PAD_X = 52
/** Línea donde el pasto sustituye al cielo (debajo van las gradas). */
export const HORIZON_GRASS_Y = 118

/** Banda inferior «Old Money»: línea de progreso y etiqueta. */
export const XP_LINE_Y = GAME_HEIGHT - 11
export const XP_LABEL_Y = GAME_HEIGHT - 30
export const XP_HUD_BAND_H = 42

/** Textura generada para destellos del home run. */
export const HR_SPARK_TEXTURE_KEY = 'hr_spark'
/** Partículas blanco/dorado en el contacto bate–pelota (fair). */
export const BAT_CONTACT_SPARK_KEY = 'bat_contact_spark'
/** Estela suave detrás de la pelota en vuelo. */
export const BALL_TRAIL_TEXTURE_KEY = 'ball_trail_pix'

/** Hit-stop en timing perfecto (ms). */
export const PERFECT_HIT_STOP_MS = 50

/** Power meter: llenado por timing sólido (fair, no foul). */
export const POWER_METER_PER_PERFECT = 0.2
export const POWER_METER_PER_PRONTO_TARDE = 0.1

/** Barra vertical de poder (HUD derecho). */
export const POWER_BAR_W = 11
export const POWER_BAR_H = 216
export const POWER_BAR_X = GAME_WIDTH - 26
export const POWER_BAR_CY = GAME_HEIGHT / 2 - 8

// —— Reglas ——
export const STRIKES_PER_OUT = 3
export const OUTS_PER_INNING = 3
export const BALLS_PER_WALK = 4

// —— Campo (drawField) ——
export const FIELD_SKY_GRASS = 0x274a30
export const FIELD_GRASS = 0x3a8f47
export const FIELD_DIRT = 0xc9a06d
export const FIELD_DIRT_SHADOW = 0xb88f5a
export const STRIKE_ZONE_FILL = 0xfff6e8
export const FOUL_LINE_COLOR = 0xf5f5f5
export const DIAMOND_EDGE = 0xffffff

export const DIRT_TOP_Y = 198
export const DIRT_BOT_Y = PLATE_Y + 38
export const DIRT_HALF_W_TOP = 118
export const DIRT_HALF_W_BOT = 298

export const FOUL_LINE_PLATE_DX = 52
export const FOUL_LINE_VANISH_DX = 168

// —— Gradas ——
export const GRANDSTAND_TIER_FILLS = [0x221f1c, 0x2c2722, 0x383028] as const
export const GRANDSTAND_LINE_1 = 0x4a4238
export const GRANDSTAND_LINE_2 = 0x5c5346
export const GRANDSTAND_PILLAR = 0x141210
export const GRANDSTAND_RAIL = 0x6a5f52

/** Paleta de camisetas / público (puntos del graderío). */
export const CROWD_SHIRT_PALETTE = [
  0xffffff, 0xffe4e4, 0xff6b6b, 0xff9f43, 0xfeca57, 0x48dbfb, 0x1dd1a1, 0x5f27cd,
  0xff9ff3, 0x54a0ff, 0xee5a6f, 0xc8d6e5, 0xffd32a, 0x26de81, 0x3867d6, 0xf368e0,
] as const

// —— HUD «Old Money» (hex numérico Phaser) ——
export const HUD_XP_BAND_BG = 0x050505
export const HUD_XP_LINE_DIM = 0x0e0e0e
export const HUD_XP_BAR_FILL = 0xd4c9b0
export const HUD_POWER_FRAME_OUTER = 0x080808
export const HUD_POWER_FRAME_INNER = 0x0c0c0c
export const HUD_POWER_FILL = 0xc4a86a
export const HUD_POWER_STROKE = 0xd4bc7a
export const HUD_POWER_SHINE_FILL = 0xfff8e8
export const HUD_POWER_SHINE_LINE = 0xffe8b0

export const HUD_BALL_DOT_OFF = 0x1e2820
export const HUD_BALL_DOT_ON = 0x2ecc9f
export const HUD_BALL_STROKE_OFF = 0x3a6a58
export const HUD_BALL_STROKE_ON = 0x5ee8d0

export const HUD_STRIKE_DOT_OFF = 0x2a2a2a
export const HUD_STRIKE_DOT_ON = 0xdc3333
export const HUD_STRIKE_STROKE_OFF = 0x4a4240
export const HUD_STRIKE_STROKE_ON = 0xff6666

export const HUD_OUT_DOT_OFF = 0x1e1e22
export const HUD_OUT_DOT_ON = 0xf8edd4
export const HUD_OUT_STROKE_OFF = 0x8a7a58
export const HUD_OUT_STROKE_ON = 0xffe8b0

export const HUD_MINI_BASE_EMPTY = 0x1e1e24
export const HUD_MINI_BASE_FULL = 0xf0cf50
export const HUD_MINI_HOME = 0xf2f2f2
export const HUD_MINI_BASE_STROKE_EMPTY = 0xe8e0c8
export const HUD_MINI_HOME_STROKE = 0xffffff

// —— Pelota / bate visuales ——
export const BALL_FILL = 0xf2f2f2
export const BALL_STROKE = 0xccaa88
export const BAT_FILL = 0x4a3224
export const BAT_STROKE = 0x2a1a12
export const BAT_GOLD_TINT = 0xffc94a

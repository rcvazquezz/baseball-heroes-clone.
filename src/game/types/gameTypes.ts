export type SwingTimingClass = 'muy_pronto' | 'pronto' | 'perfect' | 'tardo' | 'muy_tardo'

export type FairHitKind = 'HR' | 'TRIPLE' | 'DOUBLE' | 'SINGLE'

export type PlayBannerKind =
  | FairHitKind
  | 'FOUL'
  | 'MEGA_HR'
  | 'INNING_OVER'
  | 'WALK'
  | 'FLY_OUT'
  | 'OUT'

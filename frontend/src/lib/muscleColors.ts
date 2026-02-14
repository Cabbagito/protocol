export interface MuscleColor {
  primary: string
  light: string
  bg: string
  border: string
  cardBorder: string
}

const MUSCLE_COLORS: Record<string, MuscleColor> = {
  back: {
    primary: '#14b8a6',
    light: '#2dd4bf',
    bg: 'rgba(20,184,166,0.1)',
    border: 'rgba(20,184,166,0.15)',
    cardBorder: 'rgba(20,184,166,0.35)',
  },
  biceps: {
    primary: '#6366f1',
    light: '#818cf8',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.15)',
    cardBorder: 'rgba(99,102,241,0.35)',
  },
  shoulders: {
    primary: '#a855f7',
    light: '#c084fc',
    bg: 'rgba(168,85,247,0.1)',
    border: 'rgba(168,85,247,0.15)',
    cardBorder: 'rgba(168,85,247,0.35)',
  },
  chest: {
    primary: '#f97316',
    light: '#fb923c',
    bg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.15)',
    cardBorder: 'rgba(249,115,22,0.35)',
  },
  triceps: {
    primary: '#ec4899',
    light: '#f472b6',
    bg: 'rgba(236,72,153,0.1)',
    border: 'rgba(236,72,153,0.15)',
    cardBorder: 'rgba(236,72,153,0.35)',
  },
  quads: {
    primary: '#eab308',
    light: '#facc15',
    bg: 'rgba(234,179,8,0.1)',
    border: 'rgba(234,179,8,0.15)',
    cardBorder: 'rgba(234,179,8,0.35)',
  },
  hamstrings: {
    primary: '#22c55e',
    light: '#4ade80',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.15)',
    cardBorder: 'rgba(34,197,94,0.35)',
  },
  glutes: {
    primary: '#f43f5e',
    light: '#fb7185',
    bg: 'rgba(244,63,94,0.1)',
    border: 'rgba(244,63,94,0.15)',
    cardBorder: 'rgba(244,63,94,0.35)',
  },
  calves: {
    primary: '#06b6d4',
    light: '#22d3ee',
    bg: 'rgba(6,182,212,0.1)',
    border: 'rgba(6,182,212,0.15)',
    cardBorder: 'rgba(6,182,212,0.35)',
  },
  core: {
    primary: '#f59e0b',
    light: '#fbbf24',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.15)',
    cardBorder: 'rgba(245,158,11,0.35)',
  },
  traps: {
    primary: '#8b5cf6',
    light: '#a78bfa',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.15)',
    cardBorder: 'rgba(139,92,246,0.35)',
  },
  forearms: {
    primary: '#64748b',
    light: '#94a3b8',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.15)',
    cardBorder: 'rgba(100,116,139,0.35)',
  },
}

const DEFAULT_COLOR: MuscleColor = {
  primary: '#64748b',
  light: '#94a3b8',
  bg: 'rgba(100,116,139,0.1)',
  border: 'rgba(100,116,139,0.15)',
  cardBorder: 'rgba(100,116,139,0.35)',
}

export function getMuscleColor(muscleGroups: string[]): MuscleColor {
  if (!muscleGroups || !muscleGroups.length) return DEFAULT_COLOR
  const first = muscleGroups[0]
  if (!first) return DEFAULT_COLOR
  const key = first.toLowerCase()
  return MUSCLE_COLORS[key] ?? DEFAULT_COLOR
}

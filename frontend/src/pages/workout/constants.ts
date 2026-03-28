import type { WorkingSet } from '../../types'
export { SET_TYPE_LABELS, STRAIGHT_PILL } from '../../lib/setConstants'

export type SetState = 'pending' | 'logged' | 'exceeded' | 'under'

export function getSetState(set: WorkingSet): SetState {
  if (!set.completed) return 'pending'
  if (set.set_type === 'myorep_match') return 'logged'
  if (set.suggested_weight == null) return 'logged'
  if (set.target_reps == null) return 'logged'  // No target yet — no judgment
  if ((set.reps ?? 0) > set.target_reps) return 'exceeded'
  if ((set.reps ?? 0) < set.target_reps) return 'under'
  return 'logged'
}

export const SET_STYLES: Record<SetState, { inputBg: string; inputBorder: string; textColor: string }> = {
  pending: {
    inputBg: 'var(--input)',
    inputBorder: 'var(--border)',
    textColor: 'var(--text-2)',
  },
  logged: {
    inputBg: 'rgba(var(--accent-rgb),0.08)',
    inputBorder: 'rgba(var(--accent-rgb),0.2)',
    textColor: 'var(--accent-l)',
  },
  exceeded: {
    inputBg: 'rgba(168,85,247,0.08)',
    inputBorder: 'rgba(168,85,247,0.2)',
    textColor: '#c084fc',
  },
  under: {
    inputBg: 'rgba(239,68,68,0.06)',
    inputBorder: 'rgba(239,68,68,0.15)',
    textColor: '#f87171',
  },
}

export const SET_ANIM_CONFIG: Record<Exclude<SetState, 'pending'>, { bg: string; spinner: string; ripple: string; iconPath: string; strokeWidth: number }> = {
  logged:   { bg: 'var(--accent-d)', spinner: 'var(--accent)', ripple: 'var(--accent)', iconPath: 'M5 13l4 4L19 7',   strokeWidth: 3 },
  exceeded: { bg: '#7c3aed', spinner: '#a855f7', ripple: '#a855f7', iconPath: 'M5 15l7-7 7 7',    strokeWidth: 2.5 },
  under:    { bg: '#dc2626', spinner: '#ef4444', ripple: '#ef4444', iconPath: 'M19 9l-7 7-7-7',   strokeWidth: 2.5 },
}

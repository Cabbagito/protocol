// Common types for Protocol

export interface Exercise {
  id: string
  name: string
  muscle_groups: string[]
  equipment_type: EquipmentType
}

export type EquipmentType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

export interface ApiError {
  detail: string
}

// Splits & Sessions

export interface SessionExercise {
  id: string
  exercise_id: string
  exercise_name: string
  order: number
  sets: number
  rep_min: number
  rep_max: number
}

export interface Session {
  id: string
  name: string
  day_order: number
  is_rest_day: boolean
  exercises: SessionExercise[]
}

export interface Split {
  id: string
  name: string
  sessions: Session[]
}

export interface SplitListItem {
  id: string
  name: string
  session_count: number
}

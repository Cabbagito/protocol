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

// Mesocycles

export interface MesocycleListItem {
  id: string
  name: string
  split_name: string
  total_weeks: number
  current_week: number
  is_active: boolean
  started_at: string
}

export interface Mesocycle {
  id: string
  name: string
  split_id: string
  split_name: string
  total_weeks: number
  rir_scheme: number[]
  current_week: number
  current_rir: number
  is_active: boolean
  started_at: string
  workouts_completed: number
}

// Workouts

export interface ExerciseInSession {
  exercise_id: string
  exercise_name: string
  order: number
  target_sets: number
  target_rep_min: number
  target_rep_max: number
  last_weight: number | null
  suggested_weight: number | null
  progression_note: string | null
}

export interface WorkoutTemplate {
  session_id: string
  session_name: string
  week_number: number
  target_rir: number
  exercises: ExerciseInSession[]
}

export interface SetData {
  exercise_id: string
  exercise_name?: string
  set_num: number
  weight: number
  reps: number
  rir?: number | null
  completed: boolean
}

export interface WorkoutLog {
  id: string
  mesocycle_id: string
  session_id: string | null
  session_name: string | null
  week_number: number
  date: string
  notes: string | null
  sets: SetData[]
}

export interface WorkoutListItem {
  id: string
  session_name: string | null
  week_number: number
  date: string
  total_sets: number
  total_volume: number
}

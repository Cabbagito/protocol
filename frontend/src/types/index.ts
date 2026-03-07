// Common types for Protocol

export interface Exercise {
  id: string
  name: string
  muscle_group: string
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
  color: string | null
  sessions: Session[]
}

export interface SplitListItem {
  id: string
  name: string
  color: string | null
  session_count: number
  exercise_count: number
}

// Mesocycles

export interface MesocycleListItem {
  id: string
  name: string
  split_name: string
  split_color: string | null
  total_weeks: number
  current_week: number
  current_rir: number
  is_active: boolean
  started_at: string
  workouts_completed: number
  total_workouts: number
}

// Mesocycle structure types

export type SetType = 'straight' | 'myorep' | 'myorep_match'

export interface MesoSet {
  set_num: number
  weight: number | null
  reps: number | null
  target_reps: number
  suggested_weight: number | null
  rir: number | null
  logged: boolean
  set_type?: SetType
}

export interface MesoExercise {
  exercise_id: string
  exercise_name: string
  muscle_group: string
  equipment_type: string
  skipped?: boolean
  sets: MesoSet[]
}

export interface MesoSession {
  session_name: string
  day_order: number
  date: string | null
  notes: string | null
  exercises: MesoExercise[]
}

export interface MesoWeek {
  week_number: number
  rir: number
  sessions: MesoSession[]
}

export interface MesoStructure {
  weeks: MesoWeek[]
  exercise_notes?: Record<string, string>
}

export interface Mesocycle {
  id: string
  name: string
  split_id: string
  split_name: string
  split_color: string | null
  total_weeks: number
  rir_scheme: number[]
  current_week: number
  current_rir: number
  is_active: boolean
  started_at: string
  workouts_completed: number
  structure: MesoStructure
}

// Workout template (from /workouts/template endpoint)

export interface WorkoutTemplate {
  session_name: string
  week_number: number
  target_rir: number
  week_index: number
  session_index: number
  exercises: MesoExercise[]
  exercise_notes?: Record<string, string>
}

// Workout history item

export interface WorkoutHistoryItem {
  week_index: number
  session_index: number
  session_name: string
  week_number: number
  date: string | null
  total_sets: number
  total_volume: number
}

// Workout detail (viewing a logged session)

export interface WorkoutDetailResponse {
  session_name: string
  week_number: number
  date: string | null
  notes: string | null
  exercises: MesoExercise[]
  exercise_notes?: Record<string, string>
}

// Exercise progress

export interface ProgressEntry {
  date: string
  week_number: number
  max_weight: number
  best_e1rm: number
  total_reps: number
  total_sets: number
  volume: number
}

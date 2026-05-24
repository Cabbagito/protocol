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

// Splits & Days

export interface DayExercise {
  id: string
  exercise_id: string
  exercise_name: string
  muscle_group: string
  order: number
}

export interface SplitDay {
  id: string
  name: string
  day_order: number
  exercises: DayExercise[]
}

export interface Split {
  id: string
  name: string
  color: string | null
  days: SplitDay[]
}

export interface SplitListItem {
  id: string
  name: string
  color: string | null
  day_count: number
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
  target_reps: number | null
  suggested_weight: number | null
  logged: boolean
  set_type?: SetType
  skipped?: boolean
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
  current_week: number
  is_active: boolean
  started_at: string
  workouts_completed: number
  structure: MesoStructure
}

// Workout template (from /workouts/template endpoint)

export interface WorkoutTemplate {
  session_name: string
  week_number: number
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

// Working set (extends MesoSet with workout-specific fields)

export interface WorkingSet extends MesoSet {
  exercise_id: string
  exercise_name: string
  completed: boolean
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

// Diet

export interface FoodItem {
  id: string
  name: string
  brand: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  default_serving_g: number | null
}

export interface FoodLog {
  id: string
  logged_on: string
  food_item_id: string | null
  name: string
  quantity_g: number | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  created_at: string
}

export interface FoodLogCreate {
  logged_on: string
  food_item_id?: string | null
  quantity_g?: number | null
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface DailyTotals {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface DailyLog {
  date: string
  totals: DailyTotals
  entries: FoodLog[]
}

export interface DailyTargets {
  protein_g: number
  carbs_g: number
  fat_g: number
  kcal: number
}

export interface DailyTargetsUpdate {
  protein_g: number
  carbs_g: number
  fat_g: number
}

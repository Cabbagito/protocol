// Common types for Protocol

export interface Exercise {
  id: string
  name: string
  muscle_group: string
  equipment_type: EquipmentType
  /** Owner; null for the shared, seeded exercises. */
  user_id: string | null
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
  /** Owner; null for the seeded templates shared by everyone (read-only). */
  user_id: string | null
  days: SplitDay[]
}

export interface SplitListItem {
  id: string
  name: string
  color: string | null
  /** Owner; null for the seeded templates shared by everyone (read-only). */
  user_id: string | null
  day_count: number
  exercise_count: number
}

// Mesocycles

export interface MesocycleListItem {
  id: string
  name: string
  // null once the source split has been deleted
  split_name: string | null
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
  /** Logged value, or a value typed in but not logged yet. */
  weight: number | null
  reps: number | null
  logged: boolean
  set_type?: SetType | null
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
  skipped?: boolean
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
  // null once the source split has been deleted
  split_id: string | null
  split_name: string | null
  split_color: string | null
  total_weeks: number
  current_week: number
  is_active: boolean
  started_at: string
  workouts_completed: number
  structure: MesoStructure
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
  barcode: string | null
  // Owner of a custom food; null for seeded and barcode (shared) foods,
  // which the API refuses to modify (403).
  user_id: string | null
  seeded: boolean
}

export interface FoodDraft {
  barcode: string
  name: string | null
  brand: string | null
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  default_serving_g: number | null
}

export interface BarcodeLookup {
  status: 'found' | 'draft'
  food: FoodItem | null
  draft: FoodDraft | null
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

export interface WeightLog {
  id: string
  logged_on: string
  weight_kg: number
}

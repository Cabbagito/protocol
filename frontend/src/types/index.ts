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

export interface FoodUnit {
  id: string
  name: string
  grams: number
  // null: the food's own unit; a user id: that user's personal unit.
  user_id: string | null
}

/** How much of a food the user logged the last time. */
export interface LastUsed {
  unit_name: string | null
  unit_quantity: number | null
  quantity_g: number | null
}

export interface FoodItem {
  id: string
  name: string
  brand: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  barcode: string | null
  // Owner of a custom food; null for seeded and barcode (shared) foods.
  user_id: string | null
  seeded: boolean
  // Seeded foods are read-only; custom foods and barcode products aren't.
  editable: boolean
  units: FoodUnit[]
  // Only in search results, for foods the user has logged.
  last_used: LastUsed | null
}

export interface FoodUnitInput {
  name: string
  grams: number
}

export interface FoodInput {
  name: string
  brand: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  units: FoodUnitInput[]
}

/** A product as far as it is known: from Open Food Facts or the pack photos. */
export interface FoodDraft {
  barcode: string | null
  name: string | null
  brand: string | null
  kcal_per_100g: number | null
  protein_per_100g: number | null
  carbs_per_100g: number | null
  fat_per_100g: number | null
  units: FoodUnitInput[]
}

export interface BarcodeLookup {
  status: 'found' | 'draft'
  food: FoodItem | null
  draft: FoodDraft | null
}

export interface MacroTotals {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface MealItem extends MacroTotals {
  id?: string
  food_item_id: string | null
  name: string
  // How the amount was entered: unit_quantity of unit_name (null = grams).
  unit_name: string | null
  unit_quantity: number | null
  quantity_g: number | null
}

/** A line of the timeline card: a label for some items, by index. */
export interface SummaryLine {
  text: string
  items: number[]
}

export interface Meal {
  id: string
  eaten_on: string
  eaten_at: string // HH:MM
  // null until Claude has named the current items (or without Claude).
  name: string | null
  name_source: 'auto' | 'user'
  summary: SummaryLine[] | null
  // Claude is naming and summarizing the current items right now.
  naming: boolean
  totals: MacroTotals
  items: MealItem[]
}

/** PUT /meals/{id}: the full snapshot. A name is the user's; null is Claude's. */
export interface MealSnapshot {
  eaten_on: string
  eaten_at: string
  name: string | null
  items: MealItem[]
}

export interface DietDay {
  date: string
  totals: MacroTotals
  targets: DailyTargets
  meals: Meal[]
}

export interface DayKcal {
  date: string
  kcal: number
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

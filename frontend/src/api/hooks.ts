import { useCallback } from 'react'
import { queryOptions, useQuery, useQueries, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api } from './client'
import type {
  Exercise,
  EquipmentType,
  Split,
  SplitListItem,
  Mesocycle,
  MesocycleListItem,
  BarcodeLookup,
  DayKcal,
  DietDay,
  FoodDraft,
  FoodInput,
  FoodItem,
  FoodUnitInput,
  Meal,
  MealSnapshot,
  DailyTargets,
  DailyTargetsUpdate,
  WeightLog,
} from '../types'
import type { ExerciseSessionHistory } from '../lib/exerciseHistory'
import { getUserId } from '../lib/auth'
import { todayIso } from '../lib/dates'
import { sumMacros } from '../lib/diet'
import { overlayDrafts } from '../lib/workoutSession'
import { useSyncStatus, workoutSync } from '../lib/workoutSync'

// --- Query Keys ---

export const queryKeys = {
  exercises: {
    all: ['exercises'] as const,
    history: (exerciseId: string) => ['exercises', 'history', exerciseId] as const,
  },
  splits: {
    all: ['splits'] as const,
    detail: (id: string) => ['splits', id] as const,
  },
  mesocycles: {
    all: ['mesocycles'] as const,
    active: ['mesocycles', 'active'] as const,
    detail: (id: string) => ['mesocycles', id] as const,
  },
  foods: {
    all: ['foods'] as const,
    search: (q: string) => ['foods', 'search', q] as const,
    detail: (id: string) => ['foods', 'detail', id] as const,
  },
  diet: {
    all: ['diet'] as const,
    day: (date: string) => ['diet', 'day', date] as const,
    days: (from: string, to: string) => ['diet', 'days', from, to] as const,
    meal: (id: string) => ['diet', 'meal', id] as const,
  },
  dailyTargets: ['daily-targets'] as const,
  weightLogs: ['weight-logs'] as const,
}

// --- Exercise Hooks ---

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.all,
    queryFn: () => api.get<Exercise[]>('/exercises'),
  })
}

export function exerciseHistoryQuery(exerciseId: string) {
  return queryOptions({
    queryKey: queryKeys.exercises.history(exerciseId),
    queryFn: () => api.get<ExerciseSessionHistory[]>(`/exercises/${exerciseId}/history`),
  })
}

export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    ...exerciseHistoryQuery(exerciseId ?? 'none'),
    enabled: !!exerciseId,
  })
}

/** Server history of several exercises, in the order of `ids` (undefined until loaded). */
export function useExerciseHistories(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => exerciseHistoryQuery(id)),
    combine: combineExerciseHistories,
  })
}

// Module-level so useQueries can memoize the combined result between renders.
function combineExerciseHistories(results: UseQueryResult<ExerciseSessionHistory[]>[]) {
  return results.map((r) => r.data)
}

export function mesocycleQuery(id: string) {
  return queryOptions({
    queryKey: queryKeys.mesocycles.detail(id),
    queryFn: () => api.get<Mesocycle>(`/mesocycles/${id}`),
  })
}

export interface ExercisePayload {
  name: string
  muscle_group: string
  equipment_type: EquipmentType
}

export function useCreateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ExercisePayload) => api.post<Exercise>('/exercises', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
    },
  })
}

export function useUpdateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExercisePayload }) =>
      api.put<Exercise>(`/exercises/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
      // Split details join the exercise name / muscle group.
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

/** Rejected with status 409 while a split or mesocycle still uses the exercise. */
export function useDeleteExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/exercises/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
    },
  })
}

// --- Split Hooks ---

export function useSplits() {
  return useQuery({
    queryKey: queryKeys.splits.all,
    queryFn: () => api.get<SplitListItem[]>('/splits'),
  })
}

export function useSplit(id: string) {
  return useQuery({
    queryKey: queryKeys.splits.detail(id),
    queryFn: () => api.get<Split>(`/splits/${id}`),
    enabled: !!id,
  })
}

export function useCreateSplit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      color?: string | null
      days: { name: string; exercises: { exercise_id: string }[] }[]
    }) => api.post<Split>('/splits', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

export function useUpdateSplit(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      color?: string | null
      days: { name: string; exercises: { exercise_id: string }[] }[]
    }) => api.put(`/splits/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
    },
  })
}

export function useDeleteSplit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/splits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.splits.all })
      // Mesocycles built from the split survive but their list items show its name.
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

// --- Mesocycle Hooks ---

export function useMesocycles() {
  return useQuery({
    queryKey: queryKeys.mesocycles.all,
    queryFn: () => api.get<MesocycleListItem[]>('/mesocycles'),
  })
}

/**
 * Mesocycle data as the user should see it: server state plus any workout
 * changes still waiting to sync from this phone.
 */
function useDraftOverlay() {
  const { version } = useSyncStatus()
  return useCallback(<T extends Mesocycle | null>(m: T): T => {
    void version // re-run when local drafts change
    const userId = getUserId()
    if (!m || !userId) return m
    return overlayDrafts(m, workoutSync.drafts(userId), todayIso()) as T
  }, [version])
}

export function useActiveMesocycle() {
  const select = useDraftOverlay()
  return useQuery({
    queryKey: queryKeys.mesocycles.active,
    queryFn: () => api.get<Mesocycle | null>('/mesocycles/active'),
    select,
  })
}

export function useMesocycle(id: string) {
  const select = useDraftOverlay()
  return useQuery({
    ...mesocycleQuery(id),
    enabled: !!id,
    select,
  })
}

/** Full details (incl. structure) of several mesocycles, e.g. all of them for Progress. */
export function useMesocycleDetails(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => mesocycleQuery(id)),
    combine: combineMesocycleDetails,
  })
}

// Module-level so useQueries can memoize the combined result between renders.
function combineMesocycleDetails(results: UseQueryResult<Mesocycle>[]) {
  return {
    data: results.flatMap((r) => (r.data ? [r.data] : [])),
    isLoading: results.some((r) => r.isLoading),
  }
}

export function useCreateMesocycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; split_id: string; total_weeks: number }) =>
      api.post('/mesocycles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

export function useUpdateMesocycle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; is_active?: boolean }) =>
      api.put<Mesocycle>(`/mesocycles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

export function useDeleteMesocycle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/mesocycles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    },
  })
}

// --- Workout Hooks ---

export function useUpdateExerciseNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { mesocycle_id: string; exercise_id: string; note: string | null }) =>
      api.patch('/workouts/exercise-note', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useReplaceExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      exercise_index: number
      old_exercise_id: string
      new_exercise_id: string
      apply_to_future: boolean
    }) => api.post('/workouts/replace-exercise', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useAddExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      exercise_id: string
      apply_to_future: boolean
    }) => api.post('/workouts/add-exercise', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useReorderExercises() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      /** Full new order of the session's exercises. */
      exercise_ids: string[]
      apply_to_future: boolean
    }) => api.post('/workouts/reorder-exercises', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useSkipSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      skipped: boolean
    }) => api.post('/workouts/skip-session', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useRemoveExerciseFromSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      exercise_id: string
      apply_to_future: boolean
    }) => api.post('/workouts/remove-exercise', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

// --- Diet Hooks ---

export function useDietDay(date: string) {
  return useQuery({
    queryKey: queryKeys.diet.day(date),
    queryFn: () => api.get<DietDay>(`/meals?date=${date}`),
    staleTime: 0,
  })
}

/** Kcal per day with meals, for the week strip and the calendar. */
export function useDietDays(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.diet.days(from, to),
    queryFn: () => api.get<DayKcal[]>(`/meals/days?from=${from}&to=${to}`),
    staleTime: 0,
  })
}

export function useMeal(id: string, enabled = true) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.diet.meal(id),
    queryFn: () => api.get<Meal>(`/meals/${id}`),
    enabled,
    // Opened from the timeline: show the day's copy while it loads.
    initialData: () => {
      for (const [, day] of queryClient.getQueriesData<DietDay>({ queryKey: ['diet', 'day'] })) {
        const meal = day?.meals.find((m) => m.id === id)
        if (meal) return meal
      }
      return undefined
    },
    initialDataUpdatedAt: 0,
  })
}

function sameItems(a: Meal['items'], b: Meal['items']): boolean {
  const key = (items: Meal['items']) =>
    JSON.stringify(items.map((i) => [i.name, i.unit_name, i.unit_quantity, i.quantity_g]))
  return key(a) === key(b)
}

/** What the server will answer, so the screen updates before it does. */
function optimisticMeal(id: string, snapshot: MealSnapshot, previous: Meal | undefined): Meal {
  const unchanged = !!previous && sameItems(previous.items, snapshot.items)
  return {
    id,
    eaten_on: snapshot.eaten_on,
    eaten_at: snapshot.eaten_at,
    name: snapshot.name ?? (unchanged && previous?.name_source === 'auto' ? previous.name : null),
    name_source: snapshot.name ? 'user' : 'auto',
    summary: unchanged ? (previous?.summary ?? null) : null,
    totals: sumMacros(snapshot.items),
    items: snapshot.items,
  }
}

function withMeal(day: DietDay, meal: Meal | null, id: string): DietDay {
  const others = day.meals.filter((m) => m.id !== id)
  const meals = meal ? [...others, meal].sort((a, b) => a.eaten_at.localeCompare(b.eaten_at)) : others
  return { ...day, meals, totals: sumMacros(meals.map((m) => m.totals)) }
}

// Newest save per meal: an older save's answer must not overwrite a newer
// snapshot already on screen.
const latestSave = new Map<string, number>()
let saveCounter = 0
// Claude names a meal in the background, a moment after the save answers.
const NAME_REFRESH_MS = 3000

export function useSaveMeal() {
  const queryClient = useQueryClient()

  const putInCaches = useCallback(
    (meal: Meal) => {
      queryClient.setQueryData(queryKeys.diet.meal(meal.id), meal)
      queryClient.setQueryData<DietDay>(queryKeys.diet.day(meal.eaten_on), (day) =>
        day ? withMeal(day, meal, meal.id) : day,
      )
    },
    [queryClient],
  )

  return useMutation({
    // One at a time, in order: each save is a full snapshot.
    scope: { id: 'save-meal' },
    mutationFn: ({ id, snapshot }: { id: string; snapshot: MealSnapshot }) =>
      api.put<Meal>(`/meals/${id}`, snapshot),
    onMutate: ({ id, snapshot }) => {
      const version = ++saveCounter
      latestSave.set(id, version)
      const previous = queryClient.getQueryData<Meal>(queryKeys.diet.meal(id))
      putInCaches(optimisticMeal(id, snapshot, previous))
      return { version }
    },
    onSuccess: (meal, { id }, context) => {
      if (latestSave.get(id) !== context?.version) return
      putInCaches(meal)
      queryClient.invalidateQueries({ queryKey: ['diet', 'days'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
      if (meal.name === null || meal.summary === null) {
        setTimeout(() => {
          if (latestSave.get(id) !== context?.version) return
          queryClient.invalidateQueries({ queryKey: queryKeys.diet.meal(id) })
          queryClient.invalidateQueries({ queryKey: queryKeys.diet.day(meal.eaten_on) })
        }, NAME_REFRESH_MS)
      }
    },
    onError: (_err, { id, snapshot }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diet.meal(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diet.day(snapshot.eaten_on) })
    },
  })
}

export function useDeleteMeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) => api.delete(`/meals/${id}`),
    onMutate: ({ id, date }) => {
      latestSave.delete(id)
      queryClient.setQueryData<DietDay>(queryKeys.diet.day(date), (day) =>
        day ? withMeal(day, null, id) : day,
      )
    },
    onSettled: (_result, _err, { id, date }) => {
      queryClient.removeQueries({ queryKey: queryKeys.diet.meal(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.diet.day(date) })
      queryClient.invalidateQueries({ queryKey: ['diet', 'days'] })
    },
  })
}

export function useFoods(q: string) {
  return useQuery({
    queryKey: queryKeys.foods.search(q),
    queryFn: () => api.get<FoodItem[]>(`/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })
}

export function useFood(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.foods.detail(id ?? ''),
    queryFn: () => api.get<FoodItem>(`/foods/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

function useFoodMutation<V>(mutationFn: (vars: V) => Promise<FoodItem>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (food) => {
      queryClient.setQueryData(queryKeys.foods.detail(food.id), food)
      queryClient.invalidateQueries({ queryKey: ['foods', 'search'] })
    },
  })
}

export function useCreateFood() {
  return useFoodMutation((data: FoodInput & { barcode: string | null }) =>
    api.post<FoodItem>('/foods', data),
  )
}

export function useUpdateFood() {
  return useFoodMutation(({ id, data }: { id: string; data: FoodInput }) =>
    api.put<FoodItem>(`/foods/${id}`, data),
  )
}

/** A personal unit ("my bowl" = 320 g); answers with the food. */
export function useAddUnit() {
  return useFoodMutation(({ foodId, unit }: { foodId: string; unit: FoodUnitInput }) =>
    api.post<FoodItem>(`/foods/${foodId}/units`, unit),
  )
}

export function useBarcodeLookup() {
  const queryClient = useQueryClient()
  return useMutation({
    // A lookup can create a shared food server-side (Open Food Facts hit),
    // so it's modeled as a mutation and invalidates the food cache.
    mutationFn: (barcode: string) => api.get<BarcodeLookup>(`/foods/by-barcode/${barcode}`),
    onSuccess: (result) => {
      if (result.food) queryClient.setQueryData(queryKeys.foods.detail(result.food.id), result.food)
      queryClient.invalidateQueries({ queryKey: ['foods', 'search'] })
    },
  })
}

/** Claude reads name, brand, per-100 g values and units from pack photos. */
export function useReadLabel() {
  return useMutation({
    mutationFn: (images: { media_type: string; data: string }[]) =>
      api.post<FoodDraft>('/foods/read-label', { images }, { timeoutMs: 90_000 }),
  })
}

export function useDailyTargets() {
  return useQuery({
    queryKey: queryKeys.dailyTargets,
    queryFn: () => api.get<DailyTargets>('/me/daily-targets'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useWeightLogs() {
  return useQuery({
    queryKey: queryKeys.weightLogs,
    queryFn: () => api.get<WeightLog[]>('/weight-logs'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useLogWeight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { logged_on: string; weight_kg: number }) =>
      api.post<WeightLog>('/weight-logs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLogs })
    },
  })
}

export function useDeleteWeightLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/weight-logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLogs })
    },
  })
}

export function useUpdateDailyTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: DailyTargetsUpdate) =>
      api.put<DailyTargets>('/me/daily-targets', data),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.dailyTargets, result)
      queryClient.invalidateQueries({ queryKey: queryKeys.diet.all })
    },
  })
}

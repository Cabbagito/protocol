import { useCallback, useMemo } from 'react'
import {
  queryOptions,
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { api, NetworkError } from './client'
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
  DailyTargets,
  DailyTargetsUpdate,
  WeightLog,
} from '../types'
import type { ExerciseSessionHistory } from '../lib/exerciseHistory'
import { getUserId } from '../lib/auth'
import { todayIso } from '../lib/dates'
import { matchFoods } from '../lib/diet'
import { mealSync, overlayDay, overlayDays, overlayMeal, useMealSyncStatus, type MealDraft } from '../lib/mealSync'
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

/** Meal changes saved on this phone and not yet (or just) confirmed by the server. */
function useMealDrafts(): MealDraft[] {
  const { version } = useMealSyncStatus()
  return useMemo(() => {
    void version // re-read when local drafts change
    const userId = getUserId()
    return userId ? mealSync.drafts(userId) : []
  }, [version])
}

/**
 * A day as the user should see it: server data plus meals still waiting to
 * sync. `offline` when the server's copy can't be loaded.
 */
export function useDietDay(date: string) {
  const drafts = useMealDrafts()
  const query = useQuery({
    queryKey: queryKeys.diet.day(date),
    queryFn: () => api.get<DietDay>(`/meals?date=${date}`),
    staleTime: 0,
  })
  const server = query.data
  const data = useMemo(() => overlayDay(date, server, drafts), [date, server, drafts])
  return { data, isLoading: query.isLoading, offline: isOffline(query) && server === undefined }
}

/** Kcal per day with meals, for the week strip and the calendar. */
export function useDietDays(from: string, to: string) {
  const drafts = useMealDrafts()
  const { data: server } = useQuery({
    queryKey: queryKeys.diet.days(from, to),
    queryFn: () => api.get<DayKcal[]>(`/meals/days?from=${from}&to=${to}`),
    staleTime: 0,
  })
  const data = useMemo(() => overlayDays(from, to, server, drafts), [from, to, server, drafts])
  return { data }
}

/**
 * One meal as the user should see it. `deleted` when it was deleted on this
 * phone; a meal made here and not synced yet isn't asked for.
 */
export function useMeal(id: string, enabled = true) {
  const queryClient = useQueryClient()
  const drafts = useMealDrafts()
  const draft = drafts.find((d) => d.id === id) ?? null
  const query = useQuery({
    queryKey: queryKeys.diet.meal(id),
    queryFn: () => api.get<Meal>(`/meals/${id}`),
    enabled: enabled && !(draft && !draft.server),
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
  const data = useMemo(() => overlayMeal(id, query.data, draft), [id, query.data, draft])
  return { data, draft, deleted: !!draft && !draft.snapshot, isLoading: query.isLoading, error: query.error }
}

/** Every food in the query cache (search results and details), each once. */
function cachedFoods(queryClient: QueryClient): FoodItem[] {
  const byId = new Map<string, FoodItem>()
  // Recent foods first: they carry last_used.
  const lists = queryClient.getQueriesData<FoodItem[]>({ queryKey: ['foods', 'search'] })
  lists.sort(([a], [b]) => Number(b[2] === '') - Number(a[2] === ''))
  for (const [, foods] of lists) for (const f of foods ?? []) if (!byId.has(f.id)) byId.set(f.id, f)
  for (const [, food] of queryClient.getQueriesData<FoodItem>({ queryKey: ['foods', 'detail'] })) {
    if (food && !byId.has(food.id)) byId.set(food.id, food)
  }
  return [...byId.values()]
}

function isOffline(query: { isPaused: boolean; error: Error | null }): boolean {
  return query.isPaused || query.error instanceof NetworkError
}

/**
 * Food search. Without a connection it falls back to the foods already on the
 * phone (`offline`), since search itself needs the server.
 */
export function useFoods(q: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.foods.search(q),
    queryFn: () => api.get<FoodItem[]>(`/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    staleTime: 1000 * 60 * 5,
    placeholderData: (previous) => previous,
  })
  const offline = isOffline(query) && (query.data === undefined || query.isPlaceholderData)
  const local = useMemo(
    () => (offline ? matchFoods(cachedFoods(queryClient), q) : undefined),
    [offline, queryClient, q],
  )
  return { data: local ?? query.data, isFetching: query.isFetching, offline }
}

export function useFood(id: string | null | undefined) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.foods.detail(id ?? ''),
    queryFn: () => api.get<FoodItem>(`/foods/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    // A food from search results is complete enough to measure, offline too.
    initialData: () => cachedFoods(queryClient).find((f) => f.id === id),
    initialDataUpdatedAt: 0,
  })
  return { ...query, offline: isOffline(query) && query.data === undefined }
}

function useFoodMutation<V>(mutationFn: (vars: V) => Promise<FoodItem>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    // Fail with a NetworkError offline instead of waiting for a connection.
    networkMode: 'always',
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
    networkMode: 'always',
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

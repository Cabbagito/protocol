import { useQuery, useQueries, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api } from './client'
import type {
  Exercise,
  EquipmentType,
  Split,
  SplitListItem,
  Mesocycle,
  MesocycleListItem,
  MesoSet,
  WorkoutTemplate,
  WorkoutHistoryItem,
  WorkoutDetailResponse,
  BarcodeLookup,
  FoodItem,
  FoodLog,
  FoodLogCreate,
  DailyLog,
  DailyTargets,
  DailyTargetsUpdate,
  WeightLog,
} from '../types'
import type { ExerciseSessionHistory } from '../lib/exerciseHistory'

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
  workouts: {
    all: ['workouts'] as const,
    template: (mesocycleId: string) => ['workouts', 'template', mesocycleId] as const,
    specificTemplate: (mesocycleId: string, weekIndex: number, sessionIndex: number) =>
      ['workouts', 'template', mesocycleId, weekIndex, sessionIndex] as const,
    history: (mesocycleId: string) => ['workouts', 'history', mesocycleId] as const,
    detail: (mesocycleId: string, weekIndex: number, sessionIndex: number) =>
      ['workouts', 'detail', mesocycleId, weekIndex, sessionIndex] as const,
  },
  foods: {
    all: ['foods'] as const,
    search: (q: string) => ['foods', 'search', q] as const,
  },
  foodLogs: {
    all: ['food-logs'] as const,
    day: (date: string) => ['food-logs', date] as const,
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

export function useExerciseHistory(exerciseId: string | undefined) {
  return useQuery({
    queryKey: exerciseId ? queryKeys.exercises.history(exerciseId) : ['exercises', 'history', 'none'],
    queryFn: () => api.get<ExerciseSessionHistory[]>(`/exercises/${exerciseId}/history`),
    enabled: !!exerciseId,
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

export function useActiveMesocycle() {
  return useQuery({
    queryKey: queryKeys.mesocycles.active,
    queryFn: () => api.get<Mesocycle | null>('/mesocycles/active'),
  })
}

export function useMesocycle(id: string) {
  return useQuery({
    queryKey: queryKeys.mesocycles.detail(id),
    queryFn: () => api.get<Mesocycle>(`/mesocycles/${id}`),
    enabled: !!id,
  })
}

/** Full details (incl. structure) of several mesocycles, e.g. all of them for Progress. */
export function useMesocycleDetails(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.mesocycles.detail(id),
      queryFn: () => api.get<Mesocycle>(`/mesocycles/${id}`),
    })),
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

export function useWorkoutTemplate(mesocycleId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.template(mesocycleId),
    queryFn: () => api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
}

export function useSpecificTemplate(mesocycleId: string, weekIndex: number, sessionIndex: number) {
  return useQuery({
    queryKey: queryKeys.workouts.specificTemplate(mesocycleId, weekIndex, sessionIndex),
    queryFn: () =>
      api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${weekIndex}/${sessionIndex}`),
    enabled: !!mesocycleId,
  })
}

export function useWorkoutHistory(mesocycleId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.history(mesocycleId),
    queryFn: () => api.get<WorkoutHistoryItem[]>(`/workouts/history/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
}

export function useWorkoutDetail(mesocycleId: string, weekIndex: number, sessionIndex: number) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(mesocycleId, weekIndex, sessionIndex),
    queryFn: () =>
      api.get<WorkoutDetailResponse>(`/workouts/detail/${mesocycleId}/${weekIndex}/${sessionIndex}`),
    enabled: !!mesocycleId,
  })
}

export function useLogSets() {
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      logged_on?: string
      sets: { exercise_id: string; set_num: number; weight: number; reps: number; set_type?: string | null }[]
      notes?: string | null
      exercise_updates?: { exercise_id: string; skipped?: boolean }[] | null
      skipped_sets?: { exercise_id: string; set_num: number }[] | null
      draft_sets?: { exercise_id: string; set_num: number; weight?: number | null; reps?: number | null }[] | null
      complete?: boolean
    }) => api.post('/workouts/log', data),
  })
}

export function useModifySets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      mesocycle_id: string
      week_index: number
      session_index: number
      exercise_id: string
      action: 'add' | 'remove'
      set_num?: number
    }) => api.post<{ status: string; sets: MesoSet[]; exercise_id: string }>('/workouts/modify-sets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

export function useUpdateExerciseNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { mesocycle_id: string; exercise_id: string; note: string | null }) =>
      api.patch('/workouts/exercise-note', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    },
  })
}

// --- Diet Hooks ---

export function useFoods(q: string) {
  return useQuery({
    queryKey: queryKeys.foods.search(q),
    queryFn: () =>
      api.get<FoodItem[]>(`/foods${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    staleTime: 1000 * 60 * 5,
  })
}

export interface FoodItemPayload {
  name: string
  brand?: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  default_serving_g?: number | null
}

export function useCreateFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: FoodItemPayload & { barcode?: string | null }) =>
      api.post<FoodItem>('/foods', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
    },
  })
}

export function useUpdateFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FoodItemPayload }) =>
      api.put<FoodItem>(`/foods/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
    },
  })
}

export function useBarcodeLookup() {
  const queryClient = useQueryClient()
  return useMutation({
    // A lookup can create a shared food server-side (Open Food Facts hit),
    // so it's modeled as a mutation and invalidates the food cache.
    mutationFn: (barcode: string) =>
      api.get<BarcodeLookup>(`/foods/by-barcode/${barcode}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
    },
  })
}

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: queryKeys.foodLogs.day(date),
    queryFn: () => api.get<DailyLog>(`/food-logs?date=${date}`),
    staleTime: 0,
  })
}

export function useCreateLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: FoodLogCreate) => api.post<FoodLog>('/food-logs', data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodLogs.day(variables.logged_on) })
    },
  })
}

export function useDeleteLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; date: string }) =>
      api.delete(`/food-logs/${id}`),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foodLogs.day(variables.date) })
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.foodLogs.all })
    },
  })
}
